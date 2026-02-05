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
        activeIndex: FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.activeIndex,
        groups: FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.groups.map((group) => ({
          ...group,
          members: [...group.members],
          legacyBindings: [...group.legacyBindings],
        })),
      };
    }

    if (typeof this.settings.workspaceFocus.enabled !== "boolean") {
      this.settings.workspaceFocus.enabled = FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.enabled;
    }

    if (!this.settings.workspaceFocus.groups || this.settings.workspaceFocus.groups.length < 3) {
      const existingGroups = this.settings.workspaceFocus.groups || [];
      const missingGroups = FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.groups
        .slice(existingGroups.length, 3)
        .map((group) => ({
          ...group,
          members: [...group.members],
          legacyBindings: [...group.legacyBindings],
        }));
      this.settings.workspaceFocus.groups = existingGroups.concat(missingGroups);
    }

    this.migrateWorkspaceFocusBindings();

    if (
      this.settings.workspaceFocus.activeIndex !== null &&
      (this.settings.workspaceFocus.activeIndex < 0 ||
        this.settings.workspaceFocus.activeIndex >= this.settings.workspaceFocus.groups.length)
    ) {
      this.settings.workspaceFocus.activeIndex = null;
    }

    if (!this.settings.workspaceFocus.enabled) {
      this.settings.workspaceFocus.activeIndex = null;
    }
  }

  private migrateWorkspaceFocusBindings() {
    const workspaceFocus = this.settings.workspaceFocus;
    if (!workspaceFocus?.groups || workspaceFocus.groups.length === 0) {
      return;
    }

    const vaultPaths = new Set(this.app.vault.getAllLoadedFiles().map((file) => file.path));

    workspaceFocus.groups = workspaceFocus.groups.slice(0, 3).map((group, index) => {
      const defaultGroup = FILE_EXPLORER_PLUS_DEFAULT_SETTINGS.workspaceFocus.groups[index];

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
        emoji: group.emoji ?? defaultGroup.emoji,
        tooltip: group.tooltip ?? defaultGroup.tooltip,
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

    const activeIndex = this.settings.workspaceFocus.activeIndex;
    if (activeIndex === null || activeIndex === undefined) {
      return null;
    }

    return this.settings.workspaceFocus.groups[activeIndex] ?? null;
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
      this.settings.workspaceFocus.activeIndex = null;
    }

    this.saveSettings();
    this.refreshToolbar();
    this.getFileExplorer()?.requestSort();
  }

  toggleWorkspaceFocus(index: number) {
    if (!this.settings.workspaceFocus.enabled) {
      return;
    }

    const activeIndex = this.settings.workspaceFocus.activeIndex;

    if (activeIndex === index) {
      this.settings.workspaceFocus.activeIndex = null;
      this.saveSettings();
      this.getFileExplorer()?.requestSort();
      return;
    }

    if (this.settings.focusMode.active) {
      this.settings.focusMode.active = false;
    }

    this.settings.workspaceFocus.activeIndex = index;
    this.saveSettings();
    this.getFileExplorer()?.requestSort();
  }
}

type WorkspaceIncludeMatcher = {
  isVisible: (path: string) => boolean;
};
