import { setIcon } from 'obsidian';
import type FileExplorerPlusPlugin from '../main';

export class FileExplorerToolbar {
    private containerEl: HTMLElement;
    private hidden: boolean = false;
    private plugin: FileExplorerPlusPlugin;

    constructor(
        plugin: FileExplorerPlusPlugin,
        containerEl: HTMLElement
    ) {
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
            cls: ['toolbar-row']
        });

        const buttonContainer = toolbarRow.createDiv({
            cls: ['toolbar-button-container']
        });

        // hidden switch
        const hiddenSwitchBtn = buttonContainer.createEl('button', {
            cls: ['toolbar-button'],
            attr: { 'aria-label': 'show/hide hidden files/dirs' }
        });

        setIcon(hiddenSwitchBtn, this.hidden ? 'eye-off' : 'eye');

        hiddenSwitchBtn.addEventListener('click', () => {
            this.plugin.settings.hideFilters.active = !this.hidden;
            this.plugin.saveSettings();

            this.hidden = this.plugin.settings.hideFilters.active;
            setIcon(hiddenSwitchBtn, this.hidden ? 'eye-off' : 'eye');

            this.plugin.getFileExplorer()?.requestSort();
        });

        // focus switch
        const focusSwitchBtn = buttonContainer.createEl('button', {
            cls: ['toolbar-button'],
            attr: { 'aria-label': 'switch focus mode' }
        });

        setIcon(focusSwitchBtn, this.plugin.settings.focusMode.active ? 'square-mouse-pointer' : 'square-dashed-mouse-pointer');

        focusSwitchBtn.addEventListener('click', () => {
            this.plugin.settings.focusMode.active = !this.plugin.settings.focusMode.active;
            this.plugin.saveSettings();

            setIcon(focusSwitchBtn, this.plugin.settings.focusMode.active ? 'square-mouse-pointer' : 'square-dashed-mouse-pointer');

            this.plugin.getFileExplorer()?.requestSort();
        });

        const workspaceButtonContainer = toolbarRow.createDiv({
            cls: ['toolbar-button-container', 'toolbar-button-container--workspace']
        });

        const workspaceButtons: HTMLButtonElement[] = [];
        const workspaceFocusEnabled = this.plugin.settings.workspaceFocus.enabled;

        const updateWorkspaceButtons = () => {
            const activeIndex = this.plugin.settings.workspaceFocus.activeIndex;
            workspaceButtons.forEach((button, index) => {
                button.classList.toggle('is-active', activeIndex === index);
            });
        };

        this.plugin.settings.workspaceFocus.groups.forEach((group, index) => {
            const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${index + 1}`;
            const tooltip = group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${index + 1}`;

            const workspaceBtn = workspaceButtonContainer.createEl('button', {
                cls: ['toolbar-button', 'workspace-button'],
                attr: {
                    'aria-label': tooltip,
                    'data-tooltip-position': 'top'
                }
            });

            workspaceBtn.setText(emoji);

            if (!workspaceFocusEnabled) {
                workspaceBtn.disabled = true;
                workspaceBtn.classList.add('is-disabled');
                workspaceBtn.setAttribute('aria-disabled', 'true');
            } else {
                workspaceBtn.addEventListener('click', () => {
                    this.plugin.toggleWorkspaceFocus(index);
                    updateWorkspaceButtons();
                });
            }

            workspaceButtons.push(workspaceBtn);
        });

        updateWorkspaceButtons();
    }
}
