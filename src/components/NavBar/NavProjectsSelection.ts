import { DropdownComponent, App, Notice } from "obsidian";
import { NewProjectModal } from "../../modals/NewProjectModal";
import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";
import { createProject } from "../../core/update/createProject";

const NEW_FOLDER_VALUE = "__NEW_FOLDER__";

export class NavProjectsSelection {
    private element: HTMLElement;
    private dropdown: DropdownComponent | null = null;
    private app: App;
    private appStateManager: AppStateManager;

    constructor(app: App, appStateManager: AppStateManager) {
        this.element = document.createElement("div");
        this.element.className = "nav-projects";
        this.app = app;
        this.appStateManager = appStateManager;
        
        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateProjectsDone, () => this.render());
        this.appStateManager.getEvents().on(PluginEvent.ProjectSelected, () => this.updateSelectedProject());
        this.appStateManager.getEvents().on(PluginEvent.AppStateUpdated, () => this.updateSelectedProject());
    }

    private render(): void {
        const state = this.appStateManager.getState();
        const projects = state.volatile.availableProjects || ["All Projects"];
        const currentProject = state.persistent.currentProjectName || "All Projects";
        
        this.element.empty();
        this.dropdown = new DropdownComponent(this.element);

        const projectOptions = projects.includes("All Projects") ? projects : ["All Projects", ...projects];
        projectOptions.forEach((project) => this.dropdown?.addOption(project, `Project: ${project}`));

        this.dropdown?.addOption(NEW_FOLDER_VALUE, "───────");
        this.dropdown?.selectEl.lastElementChild?.setAttr('disabled', 'true');
        this.dropdown?.addOption(NEW_FOLDER_VALUE, "New Folder...");
        this.dropdown?.setValue(currentProject);

        this.dropdown?.onChange(async (value) => {
            if (value === NEW_FOLDER_VALUE) {
                await this.handleNewFolderCreation();
                this.dropdown?.setValue(currentProject);
            } else {
                this.appStateManager.selectProject(value);
            }
        });

        this.dropdown?.selectEl.addClass("nav-projects-select");
        if (this.dropdown) {
            this.dropdown.selectEl.style.minWidth = "180px";
        }
    }

    private updateSelectedProject(): void {
        const state = this.appStateManager.getState();
        const currentProject = state.persistent.currentProjectName || "All Projects";
        this.dropdown?.setValue(currentProject);
    }

    private async handleNewFolderCreation(): Promise<void> {
        new NewProjectModal(this.app, async (folderName) => {
            const state = this.appStateManager.getState();
            const taskDirectory = state.persistent.settings?.taskDirectory;
            if (!taskDirectory) {
                new Notice("Task directory not configured in settings.");
                return;
            }

            const result = await createProject(this.app, folderName, taskDirectory, true);
            new Notice(result.message);

            if (result.success && result.newPersistent) {
                this.appStateManager.updatePersistentState(result.newPersistent);
                this.appStateManager.getEvents().trigger(PluginEvent.UpdateProjectsPending);
            }
        }).open();
    }

    public getElement(): HTMLElement { return this.element; }

    public destroy(): void {
        // Event cleanup handled by AppStateManager's Events instance
    }
}