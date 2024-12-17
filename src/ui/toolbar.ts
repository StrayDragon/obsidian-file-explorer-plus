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

        const button = buttonContainer.createEl('button', {
            cls: ['toolbar-button'],
            attr: { 'aria-label': 'show/hide hidden files' }
        });

        setIcon(button, this.hidden ? 'eye-off' : 'eye');

        button.addEventListener('click', () => {
            this.hidden = !this.hidden;
            setIcon(button, this.hidden ? 'eye-off' : 'eye');

            this.plugin.settings.hideFilters.active = this.hidden;
            this.plugin.saveSettings();

            this.plugin.getFileExplorer()?.requestSort();
        });
    }
}