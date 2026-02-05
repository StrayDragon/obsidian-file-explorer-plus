import { Menu, TAbstractFile, TFile } from "obsidian";

import FileExplorerPlusPlugin from "./main";
import { InputFilterNameModal } from "./ui/modals";
import { checkTagFilter } from "./utils";
import { normalizeWorkspaceMemberPath, normalizeWorkspaceMemberPaths } from "./workspace";

export function addCommands(plugin: FileExplorerPlusPlugin) {
  plugin.addCommand({
    id: "toggle-pin-filter",
    name: "Toggle pin filter",
    callback: () => {
      new InputFilterNameModal(plugin, "PIN").open();
    },
  });

  plugin.addCommand({
    id: "toggle-hide-filter",
    name: "Toggle hide filter",
    callback: () => {
      new InputFilterNameModal(plugin, "HIDE").open();
    },
  });

  plugin.addCommand({
    id: "toggle-global-pin-filters",
    name: "Toggle all pin filters",
    callback: () => {
      plugin.settings.pinFilters.active = !plugin.settings.pinFilters.active;

      plugin.saveSettings();
      plugin.getFileExplorer()?.requestSort();
    },
  });

  plugin.addCommand({
    id: "toggle-global-hide-filters",
    name: "Toggle all hide filters",
    callback: () => {
      plugin.settings.hideFilters.active = !plugin.settings.hideFilters.active;

      plugin.saveSettings();
      plugin.getFileExplorer()?.requestSort();
    },
  });
}

export function addOnTagChange(plugin: FileExplorerPlusPlugin) {
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (path, data, cache) => {
      const isPinned = plugin.getFileExplorer()!.fileItems[path.path].info.pinned;
      const isHidden = plugin.getFileExplorer()!.fileItems[path.path].info.hidden;

      const shouldBePinned = plugin.settings.pinFilters.tags.some((filter) => checkTagFilter(filter, path));
      const shouldBeHidden = plugin.settings.hideFilters.tags.some((filter) => checkTagFilter(filter, path));

      if (isPinned !== shouldBePinned && !shouldBeHidden) {
        plugin.getFileExplorer()?.requestSort();

        return;
      }

      if (isHidden !== shouldBeHidden) {
        plugin.getFileExplorer()?.requestSort();
      }
    }),
  );
}

export function addOnRename(plugin: FileExplorerPlusPlugin) {
  plugin.registerEvent(
    plugin.app.vault.on("rename", (path, oldPath) => {
      const oldNormalizedPath = normalizeWorkspaceMemberPath(oldPath);
      const newNormalizedPath = normalizeWorkspaceMemberPath(path.path);

      if (oldNormalizedPath.length > 0 && newNormalizedPath.length > 0) {
        plugin.settings.workspaceFocus.groups.forEach((group) => {
          group.members = normalizeWorkspaceMemberPaths(
            group.members.map((member) => {
              if (member === oldNormalizedPath) {
                return newNormalizedPath;
              }
              if (member.startsWith(oldNormalizedPath + "/")) {
                return newNormalizedPath + member.slice(oldNormalizedPath.length);
              }
              return member;
            }),
          );

          group.legacyBindings = normalizeWorkspaceMemberPaths(
            group.legacyBindings.map((binding) => {
              if (binding === oldNormalizedPath) {
                return newNormalizedPath;
              }
              if (binding.startsWith(oldNormalizedPath + "/")) {
                return newNormalizedPath + binding.slice(oldNormalizedPath.length);
              }
              return binding;
            }),
          );
        });
      }

      const hideFilterPreviousIndex = plugin.settings.hideFilters.paths.findIndex((pathFilter) => {
        if (pathFilter.patternType === "STRICT" && pathFilter.pattern === oldPath) {
          return true;
        }

        return false;
      });

      if (hideFilterPreviousIndex !== -1) {
        plugin.settings.hideFilters.paths[hideFilterPreviousIndex].pattern = path.path;
      }

      const pinFilterPreviousIndex = plugin.settings.pinFilters.paths.findIndex((pathFilter) => {
        if (pathFilter.patternType === "STRICT" && pathFilter.pattern === oldPath) {
          return true;
        }

        return false;
      });

      if (pinFilterPreviousIndex !== -1) {
        plugin.settings.pinFilters.paths[pinFilterPreviousIndex].pattern = path.path;
      }

      plugin.saveSettings();

      if (plugin.settings.workspaceFocus.enabled && plugin.settings.workspaceFocus.activeIndex !== null) {
        plugin.getFileExplorer()?.requestSort();
      }
    }),
  );
}

export function addOnDelete(plugin: FileExplorerPlusPlugin) {
  plugin.registerEvent(
    plugin.app.vault.on("delete", (path) => {
      const removedPrefix = normalizeWorkspaceMemberPath(path.path);
      if (removedPrefix.length > 0) {
        plugin.settings.workspaceFocus.groups.forEach((group) => {
          group.members = normalizeWorkspaceMemberPaths(
            group.members.filter((member) => member !== removedPrefix && !member.startsWith(removedPrefix + "/")),
          );
          group.legacyBindings = normalizeWorkspaceMemberPaths(
            group.legacyBindings.filter((binding) => binding !== removedPrefix && !binding.startsWith(removedPrefix + "/")),
          );
        });
      }

      const hideFilterPreviousIndex = plugin.settings.hideFilters.paths.findIndex((pathFilter) => {
        if (pathFilter.patternType === "STRICT" && pathFilter.pattern === path.path) {
          return true;
        }

        return false;
      });

      if (hideFilterPreviousIndex !== -1) {
        plugin.settings.hideFilters.paths.splice(hideFilterPreviousIndex, 1);
      }

      const pinFilterPreviousIndex = plugin.settings.pinFilters.paths.findIndex((pathFilter) => {
        if (pathFilter.patternType === "STRICT" && pathFilter.pattern === path.path) {
          return true;
        }

        return false;
      });

      if (pinFilterPreviousIndex !== -1) {
        plugin.settings.pinFilters.paths.splice(pinFilterPreviousIndex, 1);
      }

      plugin.saveSettings();

      if (plugin.settings.workspaceFocus.enabled && plugin.settings.workspaceFocus.activeIndex !== null) {
        plugin.getFileExplorer()?.requestSort();
      }
    }),
  );
}

function AddFocusMenu(plugin: FileExplorerPlusPlugin, menu: Menu, paths: TAbstractFile[]) {
  menu.addItem((item) => {
    if (!plugin.settings.focusMode.active) {
      item
        .setTitle("focus on")
        .setIcon("square-mouse-pointer")
        .onClick(() => {
          plugin.settings.workspaceFocus.activeIndex = null;
          plugin.settings.focusMode.active = true;
          plugin.settings.focusMode.focusedPaths = paths.map((path) =>
            path instanceof TFile ? path.path : path.path + "/",
          );
          plugin.saveSettings();
          plugin.getFileExplorer()?.requestSort();
        });
    } else {
      item
        .setTitle("focus off")
        .setIcon("square-dashed-mouse-pointer")
        .onClick(() => {
          plugin.settings.focusMode.active = false;
          plugin.settings.focusMode.focusedPaths = [];
          plugin.saveSettings();
          plugin.getFileExplorer()?.requestSort();
        });
    }
  });
}

function AddWorkspaceFocusMenu(plugin: FileExplorerPlusPlugin, menu: Menu, paths: TAbstractFile[]) {
  const workspaceFocus = plugin.settings.workspaceFocus;
  if (!workspaceFocus?.groups || workspaceFocus.groups.length === 0) {
    return;
  }

  const normalizedPaths = normalizeWorkspaceMemberPaths(paths.map((path) => path.path));
  if (normalizedPaths.length === 0) {
    return;
  }

  workspaceFocus.groups.slice(0, 3).forEach((group, index) => {
    const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${index + 1}`;
    const tooltip = group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${index + 1}`;
    const label = `${emoji} ${tooltip}`;

    const existing = new Set(normalizeWorkspaceMemberPaths((group as any).members));
    const allIncluded = normalizedPaths.every((path) => existing.has(path));

    menu.addItem((item) => {
      item
        .setTitle(`${allIncluded ? "Remove from" : "Add to"} ${label}`)
        .setIcon(allIncluded ? "minus" : "plus")
        .onClick(() => {
          const next = new Set(existing);
          normalizedPaths.forEach((path) => {
            const normalized = normalizeWorkspaceMemberPath(path);
            if (normalized.length === 0) {
              return;
            }
            if (allIncluded) {
              next.delete(normalized);
            } else {
              next.add(normalized);
            }
          });

          plugin.settings.workspaceFocus.groups[index].members = Array.from(next);
          plugin.saveSettings();
          plugin.getFileExplorer()?.requestSort();
        });
    });
  });
}

export function addCommandsToFileMenu(plugin: FileExplorerPlusPlugin) {
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu, path) => {
      const thisPluginMenu = menu.addSeparator();

      if (path instanceof TFile) {
        thisPluginMenu
          .addItem((item) => {
            const index = plugin.settings.pinFilters.paths.findIndex(
              (filter) => filter.patternType === "STRICT" && filter.type === "FILES" && filter.pattern === path.path,
            );

            if (index === -1 || !plugin.settings.pinFilters.paths[index].active) {
              item
                .setTitle("Pin File")
                .setIcon("pin")
                .onClick(() => {
                  if (index === -1) {
                    plugin.settings.pinFilters.paths.push({
                      name: "",
                      active: true,
                      type: "FILES",
                      pattern: path.path,
                      patternType: "STRICT",
                    });
                  } else {
                    plugin.settings.pinFilters.paths[index].active = true;
                  }

                  plugin.saveSettings();
                  if (plugin.settings.pinFilters.active) {
                    plugin.getFileExplorer()?.requestSort();
                  }
                });
            } else {
              item
                .setTitle("Unpin File")
                .setIcon("pin-off")
                .onClick(() => {
                  plugin.settings.pinFilters.paths.splice(index, 1);

                  plugin.saveSettings();
                  plugin.getFileExplorer()?.requestSort();
                });
            }
          })
          .addItem((item) => {
            const index = plugin.settings.hideFilters.paths.findIndex(
              (filter) => filter.patternType === "STRICT" && filter.type === "FILES" && filter.pattern === path.path,
            );

            if (index === -1 || !plugin.settings.hideFilters.paths[index].active) {
              item
                .setTitle("Hide File")
                .setIcon("eye-off")
                .onClick(() => {
                  if (index === -1) {
                    plugin.settings.hideFilters.paths.push({
                      name: "",
                      active: true,
                      type: "FILES",
                      pattern: path.path,
                      patternType: "STRICT",
                    });
                  } else {
                    plugin.settings.hideFilters.paths[index].active = true;
                  }

                  plugin.saveSettings();
                  if (plugin.settings.hideFilters.active) {
                    plugin.getFileExplorer()?.requestSort();
                  }
                });
            } else {
              item
                .setTitle("Unhide File")
                .setIcon("eye")
                .onClick(() => {
                  plugin.settings.hideFilters.paths.splice(index, 1);

                  plugin.saveSettings();
                  plugin.getFileExplorer()?.requestSort();
                });
            }
          });
      } else {
        thisPluginMenu
          .addItem((item) => {
            const index = plugin.settings.pinFilters.paths.findIndex(
              (filter) =>
                filter.patternType === "STRICT" && filter.type === "DIRECTORIES" && filter.pattern === path.path,
            );

            if (index === -1 || !plugin.settings.pinFilters.paths[index].active) {
              item
                .setTitle("Pin Folder")
                .setIcon("pin")
                .onClick(() => {
                  if (index === -1) {
                    plugin.settings.pinFilters.paths.push({
                      name: "",
                      active: true,
                      type: "DIRECTORIES",
                      pattern: path.path,
                      patternType: "STRICT",
                    });
                  } else {
                    plugin.settings.pinFilters.paths[index].active = true;
                  }

                  plugin.saveSettings();
                  if (plugin.settings.pinFilters.active) {
                    plugin.getFileExplorer()?.requestSort();
                  }
                });
            } else {
              item
                .setTitle("Unpin Folder")
                .setIcon("pin-off")
                .onClick(() => {
                  plugin.settings.pinFilters.paths.splice(index, 1);

                  plugin.saveSettings();
                  plugin.getFileExplorer()?.requestSort();
                });
            }
          })
          .addItem((item) => {
            const index = plugin.settings.hideFilters.paths.findIndex(
              (filter) =>
                filter.patternType === "STRICT" && filter.type === "DIRECTORIES" && filter.pattern === path.path,
            );

            if (index === -1 || !plugin.settings.hideFilters.paths[index].active) {
              item
                .setTitle("Hide Folder")
                .setIcon("eye-off")
                .onClick(() => {
                  if (index === -1) {
                    plugin.settings.hideFilters.paths.push({
                      name: "",
                      active: true,
                      type: "DIRECTORIES",
                      pattern: path.path,
                      patternType: "STRICT",
                    });
                  } else {
                    plugin.settings.hideFilters.paths[index].active = true;
                  }

                  plugin.saveSettings();
                  if (plugin.settings.hideFilters.active) {
                    plugin.getFileExplorer()?.requestSort();
                  }
                });
            } else {
              item
                .setTitle("Unhide Folder")
                .setIcon("eye")
                .onClick(() => {
                  plugin.settings.hideFilters.paths.splice(index, 1);

                  plugin.saveSettings();
                  plugin.getFileExplorer()?.requestSort();
                });
            }
          });
      }

      AddFocusMenu(plugin, thisPluginMenu, [path]);
      AddWorkspaceFocusMenu(plugin, thisPluginMenu, [path]);
    }),
  );

  plugin.registerEvent(
    plugin.app.workspace.on("files-menu", (menu, paths) => {
      const thisPluginMenu = menu.addSeparator();
      AddFocusMenu(plugin, thisPluginMenu, paths);
      AddWorkspaceFocusMenu(plugin, thisPluginMenu, paths);
    }),
  );
}
