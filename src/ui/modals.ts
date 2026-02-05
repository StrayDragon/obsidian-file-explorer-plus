import { FuzzySuggestModal, Modal, Setting, TAbstractFile, TFile, TFolder } from "obsidian";

import FileExplorerPlusPlugin from "src/main";
import { Filter, TagFilter, PathFilter, FrontMatterFilter } from "src/settings";
import { checkFrontMatterFilter, checkPathFilter, checkTagFilter } from "src/utils";
import { PathSuggest } from "src/ui/suggest";
import { normalizeWorkspaceMemberPath, normalizeWorkspaceMemberPaths } from "src/workspace";

export class InputFilterNameModal extends FuzzySuggestModal<Filter> {
  constructor(
    private plugin: FileExplorerPlusPlugin,
    private actionType: "PIN" | "HIDE",
  ) {
    super(plugin.app);
    this.setPlaceholder("Type name of a filter...");
  }

  getItems(): Filter[] {
    let filters: any[] = [];

    if (this.actionType === "PIN") {
      filters = filters.concat(this.plugin.settings?.pinFilters.tags || []);
      filters = filters.concat(this.plugin.settings?.pinFilters.paths || []);
      filters = filters.concat(this.plugin.settings?.pinFilters.frontMatter || []);
    } else if (this.actionType === "HIDE") {
      filters = filters.concat(this.plugin.settings?.hideFilters.tags || []);
      filters = filters.concat(this.plugin.settings?.hideFilters.paths || []);
      filters = filters.concat(this.plugin.settings?.hideFilters.frontMatter || []);
    }

    filters = filters.filter((x) => x.name !== "");

    filters = [...new Set(filters)];

    return filters;
  }

  getItemText(filter: Filter): string {
    return `${filter.name} (${filter.active ? "Enabled" : "Disabled"})`;
  }

  onChooseItem(chosenFilter: Filter): void {
    if (this.actionType === "PIN") {
      this.plugin.settings.pinFilters.tags = this.plugin.settings.pinFilters.tags.map((filter) => {
        if (filter.name === chosenFilter.name) {
          filter.active = !filter.active;
        }

        return filter;
      });

      this.plugin.settings.pinFilters.paths = this.plugin.settings.pinFilters.paths.map((filter) => {
        if (filter.name === chosenFilter.name) {
          filter.active = !filter.active;
        }

        return filter;
      });

      this.plugin.settings.pinFilters.frontMatter = this.plugin.settings.pinFilters.frontMatter.map((filter) => {
        if (filter.name === chosenFilter.name) {
          filter.active = !filter.active;
        }

        return filter;
      });
    } else if (this.actionType === "HIDE") {
      this.plugin.settings.hideFilters.tags = this.plugin.settings.hideFilters.tags.map((filter) => {
        if (filter.name === chosenFilter.name) {
          filter.active = !filter.active;
        }

        return filter;
      });

      this.plugin.settings.hideFilters.paths = this.plugin.settings.hideFilters.paths.map((filter) => {
        if (filter.name === chosenFilter.name) {
          filter.active = !filter.active;
        }

        return filter;
      });

      this.plugin.settings.hideFilters.frontMatter = this.plugin.settings.hideFilters.frontMatter.map((filter) => {
        if (filter.name === chosenFilter.name) {
          filter.active = !filter.active;
        }

        return filter;
      });
    }

    this.plugin.getFileExplorer()?.requestSort();
  }
}

export class PathsActivatedModal extends Modal {
  constructor(
    private plugin: FileExplorerPlusPlugin,
    private actionType: "PIN" | "HIDE",
    private specificFilter?: Filter,
    private filterType?: "PATH" | "TAG" | "FRONTMATTER",
  ) {
    super(plugin.app);
  }

  onOpen() {
    const { contentEl } = this;
    const files = this.app.vault.getAllLoadedFiles();

    let pathsActivated;
    let pathFilters: PathFilter[];
    let tagFilters: TagFilter[];
    let frontMatterFilters: FrontMatterFilter[];

    if (this.actionType === "HIDE") {
      pathFilters = this.plugin.settings.hideFilters.paths;
      tagFilters = this.plugin.settings.hideFilters.tags;
      frontMatterFilters = this.plugin.settings.hideFilters.frontMatter;
    } else if (this.actionType === "PIN") {
      pathFilters = this.plugin.settings.pinFilters.paths;
      tagFilters = this.plugin.settings.pinFilters.tags;
      frontMatterFilters = this.plugin.settings.pinFilters.frontMatter;
    }

    if (this.specificFilter) {
      pathsActivated = files.filter((file) => {
        if (this.filterType === "PATH") {
          return checkPathFilter(this.specificFilter as PathFilter, file);
        } else if (this.filterType === "TAG") {
          return checkTagFilter(this.specificFilter as TagFilter, file);
        } else if (this.filterType === "FRONTMATTER") {
          return checkFrontMatterFilter(this.specificFilter as FrontMatterFilter, file);
        }

        return false;
      });
    } else {
      pathsActivated =
        this.actionType === "HIDE" ? this.plugin.getPathsToHide(files) : this.plugin.getPathsToPin(files);
    }

    pathsActivated = pathsActivated.map((file) => {
      const pathFiltersActivated = pathFilters
        .map((filter) => {
          if (checkPathFilter(filter, file)) {
            if (filter.name && filter.name !== "") {
              return filter.name;
            } else {
              return filter.pattern;
            }
          }

          return undefined;
        })
        .filter((x) => !!x);

      const tagFiltersActivated = tagFilters
        .map((filter) => {
          if (checkTagFilter(filter, file)) {
            if (filter.name && filter.name !== "") {
              return filter.name;
            } else {
              return filter.pattern;
            }
          }

          return undefined;
        })
        .filter((x) => !!x);

      const frontMatterFiltersActivated = frontMatterFilters
        .map((filter) => {
          if (checkFrontMatterFilter(filter, file)) {
            if (filter.name && filter.name !== "") {
              return filter.name;
            } else {
              return filter.pattern;
            }
          }

          return undefined;
        })
        .filter((x) => !!x);

      (file as any).filtersActivated =
        pathFiltersActivated.join(", ") + tagFiltersActivated.join(", ") + frontMatterFiltersActivated.join(", ");

      return file;
    });

    contentEl.addClasses(["file-explorer-plus", "filters-activated-modal"]);

    const data = [["Path", "Type", "Filters"]];

    for (const path of pathsActivated) {
      const row = [];
      if (path instanceof TFile) {
        const link = contentEl.createEl("a");
        link.onClickEvent(() => {
          this.app.workspace.getLeaf("tab").openFile(path);
        });
        link.textContent = path.path;
        row.push(link);
      } else {
        row.push(path.path);
      }

      if (path instanceof TFile) {
        row.push("File");
      } else if (path instanceof TFolder) {
        row.push("Folder");
      } else {
        row.push("Unknown");
      }

      row.push((path as any).filtersActivated);

      data.push(row);
    }

    const table = generateTable(data);
    contentEl.appendChild(table);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ManageWorkspacesModal extends Modal {
  private activeWorkspaceIndex = 0;
  private selectedMembers = new Set<string>();
  private lastSelectedIndex: number | null = null;
  private pathToAdd = "";

  constructor(private plugin: FileExplorerPlusPlugin) {
    super(plugin.app);
  }

  onOpen() {
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.addClass("file-explorer-plus");
    contentEl.addClass("fep-manage-workspaces-modal");
    contentEl.createEl("h2", { text: "Manage workspaces" });

    const groups = this.plugin.settings.workspaceFocus.groups.slice(0, 3);
    const groupLabels = groups.map((group, index) => {
      const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${index + 1}`;
      const tooltip = group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${index + 1}`;
      return `${emoji} ${tooltip}`;
    });

    new Setting(contentEl)
      .setName("Workspace")
      .addDropdown((dropdown) => {
        groupLabels.forEach((label, index) => {
          dropdown.addOption(String(index), label);
        });
        dropdown.setValue(String(this.activeWorkspaceIndex));
        dropdown.onChange((value) => {
          this.activeWorkspaceIndex = Number(value);
          this.selectedMembers.clear();
          this.lastSelectedIndex = null;
          this.pathToAdd = "";
          this.render();
        });
      });

    const group = groups[this.activeWorkspaceIndex];
    const members = normalizeWorkspaceMemberPaths(group.members);
    group.members = members;
    const legacyBindings = normalizeWorkspaceMemberPaths(group.legacyBindings);
    group.legacyBindings = legacyBindings;

    const membersSet = new Set(members);
    this.selectedMembers.forEach((memberPath) => {
      if (!membersSet.has(memberPath)) {
        this.selectedMembers.delete(memberPath);
      }
    });

    const memberInfos = members.map((memberPath) => {
      const af = this.app.vault.getAbstractFileByPath(memberPath);
      const exists = !!af;
      const type = af instanceof TFile ? "File" : af instanceof TFolder ? "Folder" : "Missing";
      return { path: memberPath, exists, type, af: af as TAbstractFile | null };
    });

    const missingCount = memberInfos.filter((info) => !info.exists).length;
    contentEl.createEl("p", {
      text: `Members: ${members.length}${missingCount > 0 ? ` (missing: ${missingCount})` : ""}`,
    });

    const selectionBar = contentEl.createDiv({ cls: ["fep-workspace-selection-bar"] });
    const selectAllLabel = selectionBar.createEl("label", { cls: ["fep-workspace-select-all"] });
    const selectAllCheckbox = selectAllLabel.createEl("input", { type: "checkbox" });
    selectAllLabel.appendText(" Select all");

    const selectionMeta = selectionBar.createDiv({ cls: ["fep-workspace-selection-meta"] });
    const selectionActions = selectionBar.createDiv({ cls: ["fep-workspace-selection-actions"] });
    const clearSelectionButton = selectionActions.createEl("button", { text: "Clear selection" });
    const removeSelectedButton = selectionActions.createEl("button", {
      text: "Remove selected",
      cls: ["mod-cta"],
    });

    const rowRefs = new Map<string, { rowEl: HTMLDivElement; checkboxEl: HTMLInputElement }>();

    const updateSelectionUI = () => {
      const selectedCount = this.selectedMembers.size;
      selectionMeta.setText(`${selectedCount}/${members.length} selected`);

      selectAllCheckbox.checked = members.length > 0 && selectedCount === members.length;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < members.length;

      const hasSelection = selectedCount > 0;
      clearSelectionButton.disabled = !hasSelection;
      removeSelectedButton.disabled = !hasSelection;

      rowRefs.forEach((ref, memberPath) => {
        const selected = this.selectedMembers.has(memberPath);
        ref.checkboxEl.checked = selected;
        ref.rowEl.classList.toggle("is-selected", selected);
        ref.rowEl.setAttribute("aria-selected", selected ? "true" : "false");
      });
    };

    const setMemberSelection = (index: number, desiredSelected: boolean, extendRange: boolean) => {
      const lastIndex = this.lastSelectedIndex;

      if (extendRange && lastIndex !== null && lastIndex >= 0 && lastIndex < members.length) {
        const start = Math.min(lastIndex, index);
        const end = Math.max(lastIndex, index);
        for (let i = start; i <= end; i++) {
          const memberPath = members[i];
          if (desiredSelected) {
            this.selectedMembers.add(memberPath);
          } else {
            this.selectedMembers.delete(memberPath);
          }
        }
      } else {
        const memberPath = members[index];
        if (desiredSelected) {
          this.selectedMembers.add(memberPath);
        } else {
          this.selectedMembers.delete(memberPath);
        }
      }

      this.lastSelectedIndex = index;
      updateSelectionUI();
    };

    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        this.selectedMembers = new Set(members);
      } else {
        this.selectedMembers.clear();
      }
      this.lastSelectedIndex = null;
      updateSelectionUI();
    });

    clearSelectionButton.addEventListener("click", () => {
      this.selectedMembers.clear();
      this.lastSelectedIndex = null;
      updateSelectionUI();
    });

    removeSelectedButton.addEventListener("click", () => {
      group.members = normalizeWorkspaceMemberPaths(members.filter((p) => !this.selectedMembers.has(p)));
      this.selectedMembers.clear();
      this.lastSelectedIndex = null;
      this.plugin.saveSettings();
      if (this.plugin.settings.workspaceFocus.activeIndex === this.activeWorkspaceIndex) {
        this.plugin.getFileExplorer()?.requestSort();
      }
      this.render();
    });

    new Setting(contentEl)
      .setName("Cleanup")
      .addButton((button) => {
        button.setButtonText("Remove missing").onClick(() => {
          group.members = normalizeWorkspaceMemberPaths(
            members.filter((memberPath) => !!this.app.vault.getAbstractFileByPath(memberPath)),
          );
          this.selectedMembers.clear();
          this.lastSelectedIndex = null;
          this.plugin.saveSettings();
          if (this.plugin.settings.workspaceFocus.activeIndex === this.activeWorkspaceIndex) {
            this.plugin.getFileExplorer()?.requestSort();
          }
          this.render();
        });
      })
      .addButton((button) => {
        button.setButtonText("Deduplicate").onClick(() => {
          group.members = members;
          this.lastSelectedIndex = null;
          this.plugin.saveSettings();
          this.render();
        });
      });

    new Setting(contentEl)
      .setName("Add member")
      .setDesc("Add a file or folder path to the current workspace.")
      .addSearch((search) => {
        new PathSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("path/to/file.md")
          .setValue(this.pathToAdd)
          .onChange((value) => {
            this.pathToAdd = value;
          });
      })
      .addButton((button) => {
        button.setButtonText("Add").setCta().onClick(() => {
          const normalized = normalizeWorkspaceMemberPath(this.pathToAdd);
          if (normalized.length === 0) {
            return;
          }

          group.members = normalizeWorkspaceMemberPaths(members.concat(normalized));
          this.pathToAdd = "";
          this.lastSelectedIndex = null;
          this.plugin.saveSettings();
          if (this.plugin.settings.workspaceFocus.activeIndex === this.activeWorkspaceIndex) {
            this.plugin.getFileExplorer()?.requestSort();
          }
          this.render();
        });
      });

    contentEl.createEl("h3", { text: "Members" });

    if (memberInfos.length === 0) {
      contentEl.createEl("p", { text: "No members yet." });
    } else {
      const listEl = contentEl.createDiv({ cls: ["fep-workspace-member-list"] });
      memberInfos.forEach((info, index) => {
        const row = listEl.createDiv({ cls: ["fep-workspace-member-row"] });
        row.tabIndex = 0;
        row.setAttribute("role", "option");
        row.classList.toggle("is-selected", this.selectedMembers.has(info.path));
        row.classList.toggle("is-missing", !info.exists);
        row.setAttribute("aria-selected", this.selectedMembers.has(info.path) ? "true" : "false");

        const checkbox = row.createEl("input", {
          type: "checkbox",
          cls: ["fep-workspace-member-checkbox"],
        });
        checkbox.checked = this.selectedMembers.has(info.path);

        checkbox.addEventListener("click", (event) => {
          event.stopPropagation();
          setMemberSelection(index, checkbox.checked, event.shiftKey);
        });

        const pathEl = row.createDiv({ cls: ["fep-workspace-member-path"] });
        if (info.af instanceof TFile) {
          const link = pathEl.createEl("a", { text: info.path });
          link.onClickEvent(() => {
            this.app.workspace.getLeaf("tab").openFile(info.af as TFile);
          });
        } else {
          pathEl.setText(info.path);
        }

        const meta = row.createDiv({ cls: ["fep-workspace-member-meta"] });
        meta.setText(`${info.type}${info.exists ? "" : " (missing)"}`);

        row.addEventListener("click", (event) => {
          const target = event.target as HTMLElement;
          if (target.closest("a")) {
            return;
          }
          if (target.tagName === "INPUT") {
            return;
          }
          setMemberSelection(index, !this.selectedMembers.has(info.path), event.shiftKey);
        });

        row.addEventListener("keydown", (event) => {
          if (event.key !== " " && event.key !== "Enter") {
            return;
          }
          event.preventDefault();
          setMemberSelection(index, !this.selectedMembers.has(info.path), event.shiftKey);
        });

        rowRefs.set(info.path, { rowEl: row, checkboxEl: checkbox });
      });
    }

    updateSelectionUI();

    if (legacyBindings.length > 0) {
      contentEl.createEl("h3", { text: "Legacy / unresolved" });
      contentEl.createEl("p", {
        text: "These entries were migrated from the old workspace hide rules but could not be resolved to real paths.",
      });

      new Setting(contentEl).addButton((button) => {
        button.setButtonText("Clear legacy").onClick(() => {
          group.legacyBindings = [];
          this.lastSelectedIndex = null;
          this.plugin.saveSettings();
          this.render();
        });
      });

      legacyBindings.forEach((binding, bindingIndex) => {
        new Setting(contentEl).setName(binding).addExtraButton((button) => {
          button
            .setIcon("cross")
            .setTooltip("Remove")
            .onClick(() => {
              group.legacyBindings = normalizeWorkspaceMemberPaths(
                legacyBindings.filter((_binding, index) => index !== bindingIndex),
              );
              this.lastSelectedIndex = null;
              this.plugin.saveSettings();
              this.render();
            });
        });
      });
    }
  }
}

type WorkspacePickerNode =
  | { kind: "folder"; path: string; name: string; folder: TFolder; children: WorkspacePickerNode[] }
  | { kind: "file"; path: string; name: string; file: TFile };

export class WorkspaceMemberPickerModal extends Modal {
  private filterText = "";
  private selectedPaths = new Set<string>();
  private collapsedFolders = new Set<string>();
  private visibleSelectablePaths: string[] = [];

  constructor(
    private plugin: FileExplorerPlusPlugin,
    private workspaceIndex: number,
    private onApply?: () => void,
  ) {
    super(plugin.app);
  }

  onOpen() {
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.addClass("file-explorer-plus");
    contentEl.addClass("fep-workspace-picker-modal");

    const group = this.plugin.settings.workspaceFocus.groups[this.workspaceIndex];
    const emoji = group.emoji && group.emoji.trim().length > 0 ? group.emoji.trim() : `${this.workspaceIndex + 1}`;
    const tooltip = group.tooltip && group.tooltip.trim().length > 0 ? group.tooltip.trim() : `Workspace ${this.workspaceIndex + 1}`;
    contentEl.createEl("h2", { text: `Select members — ${emoji} ${tooltip}` });

    const normalizedMembers = normalizeWorkspaceMemberPaths(group.members);
    group.members = normalizedMembers;
    const memberSet = new Set(normalizedMembers);

    this.visibleSelectablePaths = [];

    const headerEl = contentEl.createDiv({ cls: ["fep-tree-picker-header"] });
    const filterInput = headerEl.createEl("input", {
      type: "text",
      cls: ["fep-tree-picker-filter"],
      attr: { placeholder: "Filter paths…" },
    });
    filterInput.value = this.filterText;
    filterInput.addEventListener("input", () => {
      this.filterText = filterInput.value;
      this.render();
    });

    const actionsEl = headerEl.createDiv({ cls: ["fep-tree-picker-actions"] });
    const selectedCountEl = actionsEl.createDiv({ cls: ["fep-tree-picker-count"] });
    const selectAllButton = actionsEl.createEl("button", { text: "Select all" });
    const clearButton = actionsEl.createEl("button", { text: "Clear" });
    const addButton = actionsEl.createEl("button", { text: "Add selected", cls: ["mod-cta"] });

    const listEl = contentEl.createDiv({ cls: ["fep-tree-picker-list"] });
    const rowRefs = new Map<string, { rowEl: HTMLDivElement; checkboxEl: HTMLInputElement }>();

    const queryLower = this.filterText.trim().toLowerCase();
    const root = this.app.vault.getRoot();
    const nodes = this.buildNodes(root, queryLower);

    const updateHeader = () => {
      selectedCountEl.setText(`${this.selectedPaths.size} selected`);
      const hasSelection = this.selectedPaths.size > 0;
      clearButton.disabled = !hasSelection;
      addButton.disabled = !hasSelection;
      selectAllButton.disabled = this.visibleSelectablePaths.length === 0;
    };

    const togglePathSelection = (path: string, desiredSelected?: boolean) => {
      if (memberSet.has(path)) {
        return;
      }

      const currentlySelected = this.selectedPaths.has(path);
      const nextSelected = desiredSelected ?? !currentlySelected;
      if (nextSelected) {
        this.selectedPaths.add(path);
      } else {
        this.selectedPaths.delete(path);
      }

      const ref = rowRefs.get(path);
      if (ref) {
        ref.rowEl.classList.toggle("is-selected", nextSelected);
        ref.rowEl.setAttribute("aria-selected", nextSelected ? "true" : "false");
        ref.checkboxEl.checked = nextSelected;
      }

      updateHeader();
    };

    const renderNode = (node: WorkspacePickerNode, depth: number) => {
      if (node.kind === "folder") {
        const shouldCollapse = queryLower.length === 0 && this.collapsedFolders.has(node.path);
        const row = listEl.createDiv({
          cls: ["fep-tree-node", "is-folder"],
          attr: { "data-fep-path": node.path, role: "option" },
        });
        row.style.paddingLeft = `${depth * 16}px`;

        const twist = row.createEl("button", {
          cls: ["fep-tree-twist"],
          text: shouldCollapse ? "▸" : "▾",
          attr: { "aria-label": shouldCollapse ? "Expand folder" : "Collapse folder" },
        });
        twist.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.collapsedFolders.has(node.path)) {
            this.collapsedFolders.delete(node.path);
          } else {
            this.collapsedFolders.add(node.path);
          }
          this.render();
        });

        const checkbox = row.createEl("input", { type: "checkbox" });
        checkbox.checked = this.selectedPaths.has(node.path) || memberSet.has(node.path);
        checkbox.disabled = memberSet.has(node.path);
        checkbox.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        checkbox.addEventListener("change", () => {
          togglePathSelection(node.path, checkbox.checked);
        });

        const title = row.createDiv({ cls: ["fep-tree-title"] });
        title.createDiv({ cls: ["fep-tree-name"], text: node.name });
        title.createDiv({ cls: ["fep-tree-path"], text: node.path || "/" });

        row.classList.toggle("is-selected", this.selectedPaths.has(node.path));
        row.classList.toggle("is-already-member", memberSet.has(node.path));
        row.setAttribute("aria-selected", this.selectedPaths.has(node.path) ? "true" : "false");

        if (!memberSet.has(node.path)) {
          this.visibleSelectablePaths.push(node.path);
        }

        row.addEventListener("click", (event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === "BUTTON" || target.tagName === "INPUT") {
            return;
          }
          togglePathSelection(node.path);
        });

        row.tabIndex = 0;
        row.addEventListener("keydown", (event) => {
          if (event.key !== " " && event.key !== "Enter") {
            return;
          }
          event.preventDefault();
          togglePathSelection(node.path);
        });

        rowRefs.set(node.path, { rowEl: row, checkboxEl: checkbox });

        if (!shouldCollapse) {
          node.children.forEach((child) => renderNode(child, depth + 1));
        }
        return;
      }

      const row = listEl.createDiv({
        cls: ["fep-tree-node", "is-file"],
        attr: { "data-fep-path": node.path, role: "option" },
      });
      row.style.paddingLeft = `${depth * 16 + 20}px`;

      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedPaths.has(node.path) || memberSet.has(node.path);
      checkbox.disabled = memberSet.has(node.path);
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      checkbox.addEventListener("change", () => {
        togglePathSelection(node.path, checkbox.checked);
      });

      const title = row.createDiv({ cls: ["fep-tree-title"] });
      title.createDiv({ cls: ["fep-tree-name"], text: node.name });
      title.createDiv({ cls: ["fep-tree-path"], text: node.path });

      row.classList.toggle("is-selected", this.selectedPaths.has(node.path));
      row.classList.toggle("is-already-member", memberSet.has(node.path));
      row.setAttribute("aria-selected", this.selectedPaths.has(node.path) ? "true" : "false");

      if (!memberSet.has(node.path)) {
        this.visibleSelectablePaths.push(node.path);
      }

      row.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT") {
          return;
        }
        togglePathSelection(node.path);
      });

      row.tabIndex = 0;
      row.addEventListener("keydown", (event) => {
        if (event.key !== " " && event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        togglePathSelection(node.path);
      });

      rowRefs.set(node.path, { rowEl: row, checkboxEl: checkbox });
    };

    nodes.forEach((node) => renderNode(node, 0));

    selectAllButton.addEventListener("click", () => {
      this.selectedPaths = new Set(this.visibleSelectablePaths);
      rowRefs.forEach(({ rowEl, checkboxEl }, path) => {
        if (memberSet.has(path)) {
          return;
        }
        const selected = this.selectedPaths.has(path);
        rowEl.classList.toggle("is-selected", selected);
        rowEl.setAttribute("aria-selected", selected ? "true" : "false");
        checkboxEl.checked = selected;
      });
      updateHeader();
    });

    clearButton.addEventListener("click", () => {
      this.selectedPaths.clear();
      updateHeader();
      rowRefs.forEach(({ rowEl, checkboxEl }, path) => {
        if (memberSet.has(path)) {
          return;
        }
        rowEl.classList.remove("is-selected");
        rowEl.setAttribute("aria-selected", "false");
        checkboxEl.checked = false;
      });
    });

    addButton.addEventListener("click", () => {
      if (this.selectedPaths.size === 0) {
        return;
      }

      group.members = normalizeWorkspaceMemberPaths(normalizedMembers.concat([...this.selectedPaths]));
      this.plugin.saveSettings();
      if (this.plugin.settings.workspaceFocus.activeIndex === this.workspaceIndex) {
        this.plugin.getFileExplorer()?.requestSort();
      }
      this.onApply?.();
      this.close();
    });

    updateHeader();
  }

  private buildNodes(folder: TFolder, queryLower: string): WorkspacePickerNode[] {
    const children = folder.children.slice();
    children.sort((a, b) => {
      const aIsFolder = a instanceof TFolder;
      const bIsFolder = b instanceof TFolder;
      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const nodes: WorkspacePickerNode[] = [];
    for (const child of children) {
      if (child instanceof TFolder) {
        const childNodes = this.buildNodes(child, queryLower);
        const matchesSelf = queryLower.length === 0 || child.path.toLowerCase().includes(queryLower);
        if (queryLower.length === 0 || matchesSelf || childNodes.length > 0) {
          nodes.push({
            kind: "folder",
            path: child.path,
            name: child.name,
            folder: child,
            children: childNodes,
          });
        }
        continue;
      }

      if (!(child instanceof TFile)) {
        continue;
      }

      if (queryLower.length > 0 && !child.path.toLowerCase().includes(queryLower)) {
        continue;
      }

      nodes.push({
        kind: "file",
        path: child.path,
        name: child.name,
        file: child,
      });
    }

    return nodes;
  }
}

export function generateTable(data: (string | HTMLElement)[][]): HTMLElement {
  const table = document.createElement("table", {});
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  table.appendChild(thead);
  table.appendChild(tbody);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    const tableRow = document.createElement("tr");

    if (i === 0) {
      thead.appendChild(tableRow);
    } else {
      tbody.appendChild(tableRow);
    }

    for (let j = 0; j < row.length; j++) {
      let cell;
      if (i === 0) {
        cell = document.createElement("th");
        cell.textContent = data[i][j] as string;
      } else {
        cell = document.createElement("td");
        if (typeof data[i][j] === "string") {
          cell.textContent = data[i][j] as string;
        } else {
          cell.appendChild(data[i][j] as HTMLElement);
        }
      }

      tableRow.appendChild(cell);
    }
  }

  return table;
}
