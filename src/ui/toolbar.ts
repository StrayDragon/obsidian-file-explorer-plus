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

        const buttonContainer = this.containerEl.createDiv({
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
    }
}