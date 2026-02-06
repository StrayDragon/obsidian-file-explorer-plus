import { Menu, setIcon } from "obsidian";

import type FileExplorerPlusPlugin from "../main";

const WORKSPACE_SHORTCUT_COUNT = 3;

export class FileExplorerToolbar {
  private containerEl: HTMLElement;
  private hidden = false;
  private plugin: FileExplorerPlusPlugin;

  constructor(plugin: FileExplorerPlusPlugin, containerEl: HTMLElement) {
    this.plugin = plugin;
    this.containerEl = containerEl;
    this.hidden = this.plugin.settings.hideFilters.active;
    this.display();
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.addClass("file-explorer-plus");
    this.containerEl.addClass("file-explorer-toolbar");

    const toolbarRow = this.containerEl.createDiv({
      cls: ["fep-toolbar-row"],
    });

    const buttonContainer = toolbarRow.createDiv({
      cls: ["fep-toolbar-button-container"],
    });

    const workspaceFocusEnabled = this.plugin.settings.workspaceFocus.enabled;

    const hiddenSwitchBtn = buttonContainer.createEl("button", {
      cls: ["fep-toolbar-button"],
      attr: { "aria-label": "Show/hide hidden files and folders" },
    });

    setIcon(hiddenSwitchBtn, this.hidden ? "eye-off" : "eye");

    hiddenSwitchBtn.addEventListener("click", () => {
      this.plugin.settings.hideFilters.active = !this.hidden;
      this.plugin.saveSettings();

      this.hidden = this.plugin.settings.hideFilters.active;
      setIcon(hiddenSwitchBtn, this.hidden ? "eye-off" : "eye");

      this.plugin.getFileExplorer()?.requestSort();
    });

    const focusSwitchBtn = buttonContainer.createEl("button", {
      cls: ["fep-toolbar-button"],
      attr: { "aria-label": "Toggle focus mode" },
    });

    const updateFocusButton = () => {
      setIcon(
        focusSwitchBtn,
        this.plugin.settings.focusMode.active ? "square-mouse-pointer" : "square-dashed-mouse-pointer",
      );
    };

    updateFocusButton();

    focusSwitchBtn.addEventListener("click", () => {
      const shouldEnableFocus = !this.plugin.settings.focusMode.active;
      this.plugin.settings.focusMode.active = shouldEnableFocus;

      if (shouldEnableFocus) {
        this.plugin.settings.workspaceFocus.activeGroupId = null;
      }

      this.plugin.saveSettings();
      updateFocusButton();
      this.plugin.refreshToolbar();
      this.plugin.getFileExplorer()?.requestSort();
    });

    const workspaceButtonContainer = toolbarRow.createDiv({
      cls: ["fep-toolbar-button-container", "fep-toolbar-button-container--workspace"],
    });

    const displayGroups = this.plugin.getWorkspaceFocusDisplayGroups();
    const shortcutGroups = displayGroups.slice(0, WORKSPACE_SHORTCUT_COUNT);
    const overflowGroups = displayGroups.slice(WORKSPACE_SHORTCUT_COUNT);
    const shortcutButtons = new Map<string, HTMLButtonElement>();

    const updateShortcutButtons = () => {
      shortcutButtons.forEach((button, groupId) => {
        button.classList.toggle("is-active", this.plugin.isWorkspaceFocusGroupActive(groupId));
      });
    };

    shortcutGroups.forEach((group, index) => {
      const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${index + 1}`;
      const tooltip =
        group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${index + 1}`;

      const workspaceBtn = workspaceButtonContainer.createEl("button", {
        cls: ["fep-toolbar-button", "fep-workspace-button"],
        attr: {
          "aria-label": tooltip,
          title: tooltip,
          "data-tooltip-position": "top",
        },
      });

      workspaceBtn.setText(emoji);
      workspaceBtn.classList.toggle("is-active", this.plugin.isWorkspaceFocusGroupActive(group.id));
      shortcutButtons.set(group.id, workspaceBtn);

      if (!workspaceFocusEnabled) {
        workspaceBtn.disabled = true;
        workspaceBtn.classList.add("is-disabled");
        workspaceBtn.setAttribute("aria-disabled", "true");
      } else {
        workspaceBtn.addEventListener("click", () => {
          this.plugin.toggleWorkspaceFocusById(group.id, {
            promoteRecent: this.plugin.settings.workspaceFocus.reorderOnShortcutClick,
            refreshToolbar: this.plugin.settings.workspaceFocus.reorderOnShortcutClick,
          });
          updateFocusButton();
          updateShortcutButtons();
        });
      }
    });

    if (overflowGroups.length > 0) {
      const overflowButton = workspaceButtonContainer.createEl("button", {
        cls: ["fep-toolbar-button", "fep-workspace-button", "fep-workspace-overflow-button"],
        attr: {
          "aria-label": "More workspaces",
          title: "More workspaces",
          "data-tooltip-position": "top",
        },
      });
      overflowButton.setText("…");

      if (!workspaceFocusEnabled) {
        overflowButton.disabled = true;
        overflowButton.classList.add("is-disabled");
        overflowButton.setAttribute("aria-disabled", "true");
      } else {
        overflowButton.addEventListener("click", (event) => {
          const menu = new Menu();

          displayGroups.forEach((group, index) => {
            const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${index + 1}`;
            const tooltip =
              group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${index + 1}`;
            const label = `${emoji} ${tooltip}`;

            menu.addItem((item) => {
              item
                .setTitle(label)
                .setIcon(this.plugin.isWorkspaceFocusGroupActive(group.id) ? "check" : "chevrons-right-left")
                .onClick(() => {
                  this.plugin.toggleWorkspaceFocusById(group.id, {
                    promoteRecent: true,
                    refreshToolbar: true,
                  });
                  updateFocusButton();
                });
            });
          });

          menu.showAtPosition({ x: event.clientX, y: event.clientY });
        });
      }
    }
  }
}
