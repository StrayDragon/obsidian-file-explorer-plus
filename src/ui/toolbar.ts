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
            cls: ['fep-toolbar-row']
        });

        const buttonContainer = toolbarRow.createDiv({
            cls: ['fep-toolbar-button-container']
        });

        const workspaceButtons: HTMLButtonElement[] = [];
        const workspaceFocusEnabled = this.plugin.settings.workspaceFocus.enabled;

        const updateWorkspaceButtons = () => {
            const activeIndex = this.plugin.settings.workspaceFocus.activeIndex;
            workspaceButtons.forEach((button, index) => {
                button.classList.toggle('is-active', activeIndex === index);
            });
        };

        // hidden switch
        const hiddenSwitchBtn = buttonContainer.createEl('button', {
            cls: ['fep-toolbar-button'],
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
            cls: ['fep-toolbar-button'],
            attr: { 'aria-label': 'switch focus mode' }
        });

        const updateFocusButton = () => {
            setIcon(
                focusSwitchBtn,
                this.plugin.settings.focusMode.active ? 'square-mouse-pointer' : 'square-dashed-mouse-pointer'
            );
        };

        updateFocusButton();

        focusSwitchBtn.addEventListener('click', () => {
            const shouldEnableFocus = !this.plugin.settings.focusMode.active;
            this.plugin.settings.focusMode.active = shouldEnableFocus;

            if (shouldEnableFocus) {
                this.plugin.settings.workspaceFocus.activeIndex = null;
            }
            this.plugin.saveSettings();

            updateFocusButton();
            updateWorkspaceButtons();

            this.plugin.getFileExplorer()?.requestSort();
        });

        const workspaceButtonContainer = toolbarRow.createDiv({
            cls: ['fep-toolbar-button-container', 'fep-toolbar-button-container--workspace']
        });

        this.plugin.settings.workspaceFocus.groups.forEach((group, index) => {
            const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${index + 1}`;
            const tooltip = group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${index + 1}`;

            const workspaceBtn = workspaceButtonContainer.createEl('button', {
                cls: ['fep-toolbar-button', 'fep-workspace-button'],
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
                    updateFocusButton();
                });
            }

            workspaceButtons.push(workspaceBtn);
        });

        updateWorkspaceButtons();
    }
}
