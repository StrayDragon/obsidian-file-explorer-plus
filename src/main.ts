import { Plugin, TAbstractFile, FileExplorerView, WorkspaceLeaf, PathVirtualElement } from "obsidian";
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

export default class FileExplorerPlusPlugin extends Plugin {
  settings: FileExplorerPlusPluginSettings;
  private workspaceFocusSnapshot: Set<string> | null = null;
  private workspaceFocusRestorePaths: Set<string> | null = null;

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

            if (plugin.workspaceFocusRestorePaths && plugin.workspaceFocusRestorePaths.size > 0) {
              sortedChildren = sortedChildren.filter((vEl) => {
                if (plugin.workspaceFocusRestorePaths?.has(vEl.file.path)) {
                  vEl.info.hidden = true;
                  return false;
                }

                return true;
              });

              plugin.workspaceFocusRestorePaths = null;
            }

            const activeWorkspace = plugin.getActiveWorkspaceFocusGroup();
            if (activeWorkspace) {
              const workspacePathsToHide = plugin.getPathsToHideForWorkspace(paths, activeWorkspace);

              const workspacePathsToHideLookup = workspacePathsToHide.reduce(
                (acc, path) => {
                  acc[path.path] = true;
                  return acc;
                },
                {} as { [key: string]: boolean },
              );

              sortedChildren = sortedChildren.filter((vEl) => {
                if (workspacePathsToHideLookup[vEl.file.path]) {
                  vEl.info.hidden = true;
                  return false;
                } else {
                  vEl.info.hidden = false;
                  return true;
                }
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
          filterNames: [...group.filterNames],
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
          filterNames: [...group.filterNames],
        }));
      this.settings.workspaceFocus.groups = existingGroups.concat(missingGroups);
    }

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

  getPathsToHideForWorkspace(paths: (TAbstractFile | null)[], workspace: WorkspaceFocusGroup): TAbstractFile[] {
    const filterNames = new Set(
      workspace.filterNames.map((name) => name.trim()).filter((name) => name.length > 0),
    );

    if (filterNames.size === 0) {
      return [];
    }

    const pathFilters = this.settings.hideFilters.paths.filter((filter) =>
      filterNames.has(filter.name) || filterNames.has(filter.pattern),
    );
    const tagFilters = this.settings.hideFilters.tags.filter((filter) =>
      filterNames.has(filter.name) || filterNames.has(filter.pattern),
    );
    const frontMatterFilters = this.settings.hideFilters.frontMatter.filter((filter) =>
      filterNames.has(filter.name) || filterNames.has(filter.pattern),
    );

    return paths.filter((path) => {
      if (!path) {
        return false;
      }

      const pathFilterActivated = pathFilters.some((filter) => checkPathFilter(filter, path));
      if (pathFilterActivated) {
        return true;
      }

      const tagFilterActivated = tagFilters.some((filter) => checkTagFilter(filter, path));
      if (tagFilterActivated) {
        return true;
      }

      const frontMatterFilterActivated = frontMatterFilters.some((filter) =>
        checkFrontMatterFilter(filter, path),
      );
      if (frontMatterFilterActivated) {
        return true;
      }

      return false;
    }) as TAbstractFile[];
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

    fileExplorer.containerEl.querySelector(".file-explorer-plus.file-explorer-toolbar")?.remove();
    const toolbarContainer = fileExplorer.containerEl.createDiv();
    new FileExplorerToolbar(this, toolbarContainer);
  }

  setWorkspaceFocusEnabled(enabled: boolean) {
    this.settings.workspaceFocus.enabled = enabled;

    if (!enabled) {
      this.workspaceFocusRestorePaths = this.workspaceFocusSnapshot ? new Set(this.workspaceFocusSnapshot) : null;
      this.workspaceFocusSnapshot = null;
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
      this.workspaceFocusRestorePaths = this.workspaceFocusSnapshot ? new Set(this.workspaceFocusSnapshot) : null;
      this.workspaceFocusSnapshot = null;
      this.settings.workspaceFocus.activeIndex = null;
      this.saveSettings();
      this.getFileExplorer()?.requestSort();
      return;
    }

    if (activeIndex === null || activeIndex === undefined) {
      this.workspaceFocusSnapshot = this.captureHiddenSnapshot();
    } else if (this.workspaceFocusSnapshot) {
      this.workspaceFocusRestorePaths = new Set(this.workspaceFocusSnapshot);
    }

    this.settings.workspaceFocus.activeIndex = index;
    this.saveSettings();
    this.getFileExplorer()?.requestSort();
  }

  private captureHiddenSnapshot(): Set<string> {
    const fileExplorer = this.getFileExplorer();
    if (!fileExplorer) {
      return new Set();
    }

    const hiddenPaths = Object.values(fileExplorer.fileItems)
      .filter((item) => item.info.hidden)
      .map((item) => item.file.path);

    return new Set(hiddenPaths);
  }
}
