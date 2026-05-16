import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";
import { CustomDropdown } from "../common/CustomDropdown";

export class NavProjectPicker {
    private container: HTMLElement;
    private dropdown: CustomDropdown;
    private appStateManager: AppStateManager;
    private readonly boundProjectSelected = this.handleProjectSelected.bind(this);
    private readonly boundProjectsUpdated = this.handleProjectsUpdated.bind(this);
    private readonly boundAppStateUpdated = this.handleAppStateUpdated.bind(this);

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;

        this.container = document.createElement("div");
        this.container.className = "nav-project-picker";

        const projects = appStateManager.getVolatileState().availableProjects || [];
        const currentProject = appStateManager.getPersistentState().currentProjectName || '';

        this.dropdown = new CustomDropdown(this.container, {
            options: projects.map(p => ({ value: p, label: p })),
            value: currentProject,
            placeholder: "Pick project",
            onChange: (value) => {
                appStateManager.selectProject(value);
            }
        });

        // Listen for state updates
        appStateManager.getEvents().on(PluginEvent.ProjectSelected, this.boundProjectSelected);

        appStateManager.getEvents().on(PluginEvent.UpdateProjectsDone, this.boundProjectsUpdated);

        appStateManager.getEvents().on(PluginEvent.AppStateUpdated, this.boundAppStateUpdated);
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    private handleProjectSelected(name: string): void {
        this.dropdown.setValue(name);
    }

    private handleProjectsUpdated(): void {
        const updatedProjects = this.appStateManager.getVolatileState().availableProjects || [];
        this.dropdown.setOptions(updatedProjects.map(p => ({ value: p, label: p })));
    }

    private handleAppStateUpdated(): void {
        const project = this.appStateManager.getPersistentState().currentProjectName;
        if (project && this.dropdown.getValue() !== project) {
            this.dropdown.setValue(project);
        }
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.ProjectSelected, this.boundProjectSelected);
        this.appStateManager.getEvents().off(PluginEvent.UpdateProjectsDone, this.boundProjectsUpdated);
        this.appStateManager.getEvents().off(PluginEvent.AppStateUpdated, this.boundAppStateUpdated);
        this.dropdown.destroy();
    }
}
