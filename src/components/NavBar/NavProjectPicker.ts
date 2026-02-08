import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";
import { CustomDropdown } from "../common/CustomDropdown";

export class NavProjectPicker {
    private container: HTMLElement;
    private dropdown: CustomDropdown;
    private appStateManager: AppStateManager;

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
        appStateManager.getEvents().on(PluginEvent.ProjectSelected, (name: string) => {
            this.dropdown.setValue(name);
        });

        appStateManager.getEvents().on(PluginEvent.UpdateProjectsDone, () => {
            const updatedProjects = appStateManager.getVolatileState().availableProjects || [];
            this.dropdown.setOptions(updatedProjects.map(p => ({ value: p, label: p })));
        });

        appStateManager.getEvents().on(PluginEvent.AppStateUpdated, () => {
            const project = appStateManager.getPersistentState().currentProjectName;
            if (project && this.dropdown.getValue() !== project) {
                this.dropdown.setValue(project);
            }
        });
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public destroy(): void {
        this.dropdown.destroy();
    }
}
