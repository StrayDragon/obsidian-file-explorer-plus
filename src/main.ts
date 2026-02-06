import { Plugin, TAbstractFile, FileExplorerView, WorkspaceLeaf, PathVirtualElement, TFolder } from "obsidian";
import { around } from "monkey-around";

import FileExplorerPlusSettingTab, {
  FileExplorerPlusPluginSettings,
  FILE_EXPLORER_PLUS_DEFAULT_SETTINGS,
  WorkspaceFocusGroup,
} from "./settings";
import { addCommandsToFileMenu, addOnRename, addOnDelete, addOnTagChange, addCommands } from "./handlers";
import {
  checkPathFilter,
  checkTagFilter,
  changeVirtualElementPin,
  checkFrontMatterFilter,
  shouldHideInFocusMode,
} from "./utils";
import { FileExplorerToolbar } from "./ui/toolbar";
import { normalizeWorkspaceMemberPaths } from "./workspace";

export default class FileExplorerPlusPlugin extends Plugin {
  settings: FileExplorerPlusPluginSettings;
  private workspaceIncludeMatcherCache: { key: string; matcher: WorkspaceIncludeMatcher } | null = null;

  createWorkspaceFocusGroup(): WorkspaceFocusGroup {
    const groups = this.settings?.workspaceFocus?.groups ?? [];
    const id = this.getNextWorkspaceFocusGroupId(groups);
    const nextNumber = groups.length + 1;

    return {
      id,
      emoji: String(nextNumber),
      tooltip: `Workspace ${nextNumber}`,
      members: [],
      legacyBindings: [],
    };
  }

  ensureWorkspaceFocusSettings() {
    const workspaceFocusAny = (this.settings as any).workspaceFocus as any;
    const defaults = FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus;

    const rawGroups = Array.isArray(workspaceFocusAny?.groups) ? workspaceFocusAny.groups : [];
    let groups: WorkspaceFocusGroup[] = rawGroups.map((group: any, index: number) =>
      this.normalizeWorkspaceFocusGroup(group, index),
    );

    if (groups.length === 0) {
      groups = defaults.groups.map((group: WorkspaceFocusGroup) => ({
        ...group,
        members: [...group.members],
        legacyBindings: [...group.legacyBindings],
      }));
    }

    const seenIds = new Set<string>();
    groups = groups.map((group: WorkspaceFocusGroup) => {
      if (!group.id || seenIds.has(group.id)) {
        group.id = this.getNextWorkspaceFocusGroupId(groups, seenIds);
      }
      seenIds.add(group.id);
      return group;
    });

    const enabled = typeof workspaceFocusAny?.enabled === "boolean" ? workspaceFocusAny.enabled : defaults.enabled;

    const reorderOnShortcutClick =
      typeof workspaceFocusAny?.reorderOnShortcutClick === "boolean"
        ? workspaceFocusAny.reorderOnShortcutClick
        : defaults.reorderOnShortcutClick;

    let activeGroupId: string | null =
      typeof workspaceFocusAny?.activeGroupId === "string" && workspaceFocusAny.activeGroupId.length > 0
        ? workspaceFocusAny.activeGroupId
        : null;

    if (!activeGroupId && typeof workspaceFocusAny?.activeIndex === "number") {
      const fromIndex = groups[workspaceFocusAny.activeIndex];
      activeGroupId = fromIndex?.id ?? null;
    }

    if (activeGroupId && !groups.some((group: WorkspaceFocusGroup) => group.id === activeGroupId)) {
      activeGroupId = null;
    }

    if (!enabled) {
      activeGroupId = null;
    }

    const rawRecent = Array.isArray(workspaceFocusAny?.recentGroupIds) ? workspaceFocusAny.recentGroupIds : [];
    const recentGroupIds: string[] = [];
    const knownIds = new Set(groups.map((group: WorkspaceFocusGroup) => group.id));
    for (const id of rawRecent) {
      if (typeof id !== "string" || id.length === 0 || !knownIds.has(id) || recentGroupIds.includes(id)) {
        continue;
      }
      recentGroupIds.push(id);
    }

    if (activeGroupId) {
      const activeIndex = recentGroupIds.indexOf(activeGroupId);
      if (activeIndex !== -1) {
        recentGroupIds.splice(activeIndex, 1);
      }
      recentGroupIds.unshift(activeGroupId);
    }

    this.settings.workspaceFocus = {
      enabled,
      reorderOnShortcutClick,
      activeGroupId,
      recentGroupIds,
      groups,
    };
  }

  removeWorkspaceFocusGroup(groupId: string) {
    const groups = this.settings.workspaceFocus.groups;
    const removeIndex = groups.findIndex((group) => group.id === groupId);
    if (removeIndex === -1) {
      return;
    }

    groups.splice(removeIndex, 1);
    if (groups.length === 0) {
      groups.push(this.createWorkspaceFocusGroup());
    }

    if (this.settings.workspaceFocus.activeGroupId === groupId) {
      this.settings.workspaceFocus.activeGroupId = null;
    }

    this.settings.workspaceFocus.recentGroupIds = this.settings.workspaceFocus.recentGroupIds.filter(
      (id) => id !== groupId,
    );
  }

  isWorkspaceFocusGroupActive(groupId: string): boolean {
    return this.settings.workspaceFocus.activeGroupId === groupId;
  }

  getWorkspaceFocusDisplayGroups(): WorkspaceFocusGroup[] {
    const groups = this.settings.workspaceFocus.groups;
    const groupIndexById = new Map<string, number>();
    groups.forEach((group, index) => {
      groupIndexById.set(group.id, index);
    });

    const recentIndexById = new Map<string, number>();
    this.settings.workspaceFocus.recentGroupIds.forEach((id, index) => {
      recentIndexById.set(id, index);
    });

    return groups.slice().sort((a, b) => {
      const aRecent = recentIndexById.get(a.id);
      const bRecent = recentIndexById.get(b.id);

      if (aRecent !== undefined && bRecent !== undefined) {
        return aRecent - bRecent;
      }

      if (aRecent !== undefined) {
        return -1;
      }

      if (bRecent !== undefined) {
        return 1;
      }

      return (groupIndexById.get(a.id) ?? 0) - (groupIndexById.get(b.id) ?? 0);
    });
  }

  toggleWorkspaceFocusById(groupId: string, options: ToggleWorkspaceFocusOptions = {}) {
    if (!this.settings.workspaceFocus.enabled) {
      return;
    }

    const shouldPromoteRecent = options.promoteRecent ?? true;
    const shouldRefreshToolbar = options.refreshToolbar ?? true;

    const hasGroup = this.settings.workspaceFocus.groups.some((group) => group.id === groupId);
    if (!hasGroup) {
      return;
    }

    if (this.settings.workspaceFocus.activeGroupId === groupId) {
      this.settings.workspaceFocus.activeGroupId = null;
      this.saveSettings();
      if (shouldRefreshToolbar) {
        this.refreshToolbar();
      }
      this.getFileExplorer()?.requestSort();
      return;
    }

    if (this.settings.focusMode.active) {
      this.settings.focusMode.active = false;
    }

    this.settings.workspaceFocus.activeGroupId = groupId;
    if (shouldPromoteRecent) {
      this.settings.workspaceFocus.recentGroupIds = [
        groupId,
        ...this.settings.workspaceFocus.recentGroupIds.filter((id) => id !== groupId),
      ];
    }

    this.saveSettings();
    if (shouldRefreshToolbar) {
      this.refreshToolbar();
    }
    this.getFileExplorer()?.requestSort();
  }

  private getNextWorkspaceFocusGroupId(groups: WorkspaceFocusGroup[], reservedIds: Set<string> = new Set()): string {
    const existingIds = new Set(groups.map((group) => group.id));
    let index = 1;
    while (existingIds.has(`workspace-${index}`) || reservedIds.has(`workspace-${index}`)) {
      index += 1;
    }
    return `workspace-${index}`;
  }

  private normalizeWorkspaceFocusGroup(group: any, index: number): WorkspaceFocusGroup {
    const defaultGroup = FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.groups[index];
    const fallbackEmoji = defaultGroup?.emoji ?? String(index + 1);
    const fallbackTooltip = defaultGroup?.tooltip ?? `Workspace ${index + 1}`;

    const id = typeof group?.id === "string" && group.id.trim().length > 0 ? group.id.trim() : "";

    return {
      id,
      emoji: typeof group?.emoji === "string" ? group.emoji : fallbackEmoji,
      tooltip: typeof group?.tooltip === "string" ? group.tooltip : fallbackTooltip,
      members: normalizeWorkspaceMemberPaths((group as any)?.members),
      legacyBindings: normalizeWorkspaceMemberPaths((group as any)?.legacyBindings),
    };
  }

  async onload() {
    await this.loadSettings();

    addCommandsToFileMenu(this);
    addOnRename(this);
    addOnDelete(this);
    addOnTagChange(this);
    addCommands(this);

    this.addSettingTab(new FileExplorerPlusSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.patchFileExplorer();

      const fileExplorer = this.getFileExplorer();
      if (fileExplorer?.requestSort) {
        fileExplorer.requestSort();
      }
    });

    this.app.workspace.on("layout-change", () => {
      if (!this.getFileExplorer()?.fileExplorerPlusPatched) {
        this.patchFileExplorer();

        const fileExplorer = this.getFileExplorer();
        if (fileExplorer?.requestSort) {
          fileExplorer.requestSort();
        }
      }
    });
  }

  getFileExplorerContainer(): WorkspaceLeaf | undefined {
    return this.app.workspace.getLeavesOfType("file-explorer")?.first();
  }

  getFileExplorer(): FileExplorerView | undefined {
    const fileExplorerContainer = this.getFileExplorerContainer();
    return fileExplorerContainer?.view as FileExplorerView;
  }

  patchFileExplorer() {
    const fileExplorer = this.getFileExplorer();

    if (!fileExplorer) {
      throw Error("Could not find file explorer");
    }

    const plugin = this;
    const leaf = this.app.workspace.getLeaf(true);

    this.refreshToolbar();

    this.register(
      around(Object.getPrototypeOf(fileExplorer), {
        getSortedFolderItems(old: any) {
          return function (...args: any[]) {
            let sortedChildren: PathVirtualElement[] = old.call(this, ...args);

            sortedChildren.forEach((vEl) => {
              vEl.info.hidden = false;
            });

            let paths = sortedChildren.map((el) => el.file);

            if (plugin.settings.hideFilters.active) {
              const pathsToHide = plugin.getPathsToHide(paths);

              const pathsToHideLookUp = pathsToHide.reduce(
                (acc, path) => {
                  acc[path.path] = true;
                  return acc;
                },
                {} as { [key: string]: boolean },
              );

              sortedChildren = sortedChildren.filter((vEl) => {
                if (pathsToHideLookUp[vEl.file.path]) {
                  vEl.info.hidden = true;
                  return false;
                } else {
                  vEl.info.hidden = false;
                  return true;
                }
              });
            }

            const activeWorkspace = plugin.getActiveWorkspaceFocusGroup();
            if (activeWorkspace) {
              sortedChildren = sortedChildren.filter((vEl) => {
                const isVisible = plugin.getWorkspaceIncludeMatcher(activeWorkspace).isVisible(vEl.file.path);
                vEl.info.hidden = !isVisible;
                return isVisible;
              });
            }
            // only get visible vChildren
            paths = sortedChildren.map((el) => el.file);

            if (plugin.settings.pinFilters.active) {
              const pathsToPin = plugin.getPathsToPin(paths);

              const pathsToPinLookUp = pathsToPin.reduce(
                (acc, path) => {
                  acc[path.path] = true;
                  return acc;
                },
                {} as { [key: string]: boolean },
              );

              const pinnedVirtualElements = sortedChildren.filter((vEl) => {
                if (pathsToPinLookUp[vEl.file.path]) {
                  vEl = changeVirtualElementPin(vEl, true);
                  vEl.info.pinned = true;
                  return true;
                } else {
                  vEl = changeVirtualElementPin(vEl, false);
                  vEl.info.pinned = false;
                  return false;
                }
              });
              const notPinnedVirtualElements = sortedChildren.filter((vEl) => {
                if (pathsToPinLookUp[vEl.file.path]) {
                  return false;
                } else {
                  return true;
                }
              });

              sortedChildren = pinnedVirtualElements.concat(notPinnedVirtualElements);
            } else {
              sortedChildren = sortedChildren.map((vEl) => changeVirtualElementPin(vEl, false));
            }

            if (plugin.settings.focusMode.active) {
              sortedChildren = sortedChildren.filter((vEl) => {
                const shouldHide = shouldHideInFocusMode(vEl.file, plugin.settings);
                vEl.info.hidden = shouldHide;
                return !shouldHide;
              });
            }

            return sortedChildren;
          };
        },
      }),
    );

    leaf.detach();

    fileExplorer.fileExplorerPlusPatched = true;
  }

  onunload() {
    const fileExplorer = this.getFileExplorer();

    if (!fileExplorer) {
      return;
    }

    for (const path in fileExplorer!.fileItems) {
      fileExplorer!.fileItems[path] = changeVirtualElementPin(fileExplorer!.fileItems[path], false);
    }

    if (fileExplorer?.requestSort) {
      fileExplorer.requestSort();
    }
    fileExplorer.fileExplorerPlusPatched = false;
  }

  async loadSettings() {
    this.settings = Object.assign({}, FILE_EXPLORER_PLUS_DEFAULT_SETTINGS, await this.loadData());

    if (!this.settings.workspaceFocus) {
      this.settings.workspaceFocus = {
        enabled: FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.enabled,
        reorderOnShortcutClick: FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.reorderOnShortcutClick,
        activeGroupId: FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.activeGroupId,
        recentGroupIds: [...FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.recentGroupIds],
        groups: FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.groups.map((group) => ({
          ...group,
          members: [...group.members],
          legacyBindings: [...group.legacyBindings],
        })),
      };
    }

    this.ensureWorkspaceFocusSettings();
    this.migrateWorkspaceFocusBindings();
    this.ensureWorkspaceFocusSettings();
  }

  private migrateWorkspaceFocusBindings() {
    const workspaceFocus = this.settings.workspaceFocus;
    if (!workspaceFocus?.groups || workspaceFocus.groups.length === 0) {
      return;
    }

    const vaultPaths = new Set(this.app.vault.getAllLoadedFiles().map((file) => file.path));

    workspaceFocus.groups = workspaceFocus.groups.map((group, index) => {
      const members =
        (group as any).members === undefined
          ? []
          : normalizeWorkspaceMemberPaths((group as any).members);

      const legacyBindings = normalizeWorkspaceMemberPaths((group as any).legacyBindings);

      const hasNewModel = (group as any).members !== undefined;
      const oldBindings = hasNewModel ? [] : normalizeWorkspaceMemberPaths((group as any).filterNames);

      const migratedMembers = [...members];
      const migratedLegacy = [...legacyBindings];

      for (const binding of oldBindings) {
        if (vaultPaths.has(binding)) {
          migratedMembers.push(binding);
        } else {
          migratedLegacy.push(binding);
        }
      }

      return {
        id: group.id,
        emoji: group.emoji,
        tooltip: group.tooltip,
        members: normalizeWorkspaceMemberPaths(migratedMembers),
        legacyBindings: normalizeWorkspaceMemberPaths(migratedLegacy),
      };
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getPathsToPin(paths: (TAbstractFile | null)[]): TAbstractFile[] {
    return paths.filter((path) => {
      if (!path) {
        return false;
      }

      const pathFilterActivated = this.settings.pinFilters.paths.some((filter) => checkPathFilter(filter, path));
      if (pathFilterActivated) {
        return true;
      }

      const tagFilterActivated = this.settings.pinFilters.tags.some((filter) => checkTagFilter(filter, path));
      if (tagFilterActivated) {
        return true;
      }

      const frontMatterFilterActivated = this.settings.pinFilters.frontMatter?.some((filter) =>
        checkFrontMatterFilter(filter, path),
      );
      if (frontMatterFilterActivated) {
        return true;
      }

      return false;
    }) as TAbstractFile[];
  }

  getPathsToHide(paths: (TAbstractFile | null)[]): TAbstractFile[] {
    return paths.filter((path) => {
      if (!path) {
        return false;
      }

      const pathFilterActivated = this.settings.hideFilters.paths.some((filter) => checkPathFilter(filter, path));
      if (pathFilterActivated) {
        return true;
      }

      const tagFilterActivated = this.settings.hideFilters.tags.some((filter) => checkTagFilter(filter, path));
      if (tagFilterActivated) {
        return true;
      }

      const frontMatterFilterActivated = this.settings.hideFilters.frontMatter?.some((filter) =>
        checkFrontMatterFilter(filter, path),
      );
      if (frontMatterFilterActivated) {
        return true;
      }

      return false;
    }) as TAbstractFile[];
  }

  private getWorkspaceIncludeMatcher(workspace: WorkspaceFocusGroup): WorkspaceIncludeMatcher {
    const normalizedMembers = normalizeWorkspaceMemberPaths(workspace.members);
    const key = normalizedMembers.join("\n");

    if (this.workspaceIncludeMatcherCache?.key === key) {
      return this.workspaceIncludeMatcherCache.matcher;
    }

    const includeFiles = new Set<string>();
    const includeFolders = new Set<string>();
    const ancestorFolders = new Set<string>();

    for (const memberPath of normalizedMembers) {
      const af = this.app.vault.getAbstractFileByPath(memberPath);
      if (af instanceof TFolder) {
        includeFolders.add(memberPath);
      } else {
        includeFiles.add(memberPath);
      }

      let parent = memberPath;
      while (parent.includes("/")) {
        parent = parent.substring(0, parent.lastIndexOf("/"));
        ancestorFolders.add(parent);
      }
    }

    const matcher: WorkspaceIncludeMatcher = {
      isVisible: (path: string) => {
        if (normalizedMembers.length === 0) {
          return false;
        }

        if (includeFiles.has(path) || includeFolders.has(path) || ancestorFolders.has(path)) {
          return true;
        }

        let parent = path;
        while (parent.includes("/")) {
          parent = parent.substring(0, parent.lastIndexOf("/"));
          if (includeFolders.has(parent)) {
            return true;
          }
        }

        return false;
      },
    };

    this.workspaceIncludeMatcherCache = { key, matcher };
    return matcher;
  }

  getActiveWorkspaceFocusGroup(): WorkspaceFocusGroup | null {
    if (!this.settings.workspaceFocus.enabled) {
      return null;
    }

    const activeGroupId = this.settings.workspaceFocus.activeGroupId;
    if (!activeGroupId) {
      return null;
    }

    return this.settings.workspaceFocus.groups.find((group) => group.id === activeGroupId) ?? null;
  }

  refreshToolbar() {
    const fileExplorer = this.getFileExplorer();
    if (!fileExplorer) {
      return;
    }

    fileExplorer.containerEl.classList.add("file-explorer-plus-root");
    fileExplorer.containerEl.querySelector(".file-explorer-plus.file-explorer-toolbar")?.remove();
    const toolbarContainer = fileExplorer.containerEl.createDiv();
    new FileExplorerToolbar(this, toolbarContainer);
  }

  setWorkspaceFocusEnabled(enabled: boolean) {
    this.settings.workspaceFocus.enabled = enabled;

    if (!enabled) {
      this.settings.workspaceFocus.activeGroupId = null;
    }

    this.saveSettings();
    this.refreshToolbar();
    this.getFileExplorer()?.requestSort();
  }

  toggleWorkspaceFocus(index: number) {
    const group = this.settings.workspaceFocus.groups[index];
    if (!group) {
      return;
    }

    this.toggleWorkspaceFocusById(group.id, {
      promoteRecent: this.settings.workspaceFocus.reorderOnShortcutClick,
      refreshToolbar: this.settings.workspaceFocus.reorderOnShortcutClick,
    });
  }
}

type ToggleWorkspaceFocusOptions = {
  promoteRecent?: boolean;
  refreshToolbar?: boolean;
};

type WorkspaceIncludeMatcher = {
  isVisible: (path: string) => boolean;
};
