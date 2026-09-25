import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";
import { CustomDropdown } from "../common/CustomDropdown";

export class NavProjectPicker {
    private container: HTMLElement;
    private dropdown: CustomDropdown;
    private appStateManager: AppStateManager;
    private optionsKey = '';
    private readonly boundSync = this.sync.bind(this);

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;

        this.container = document.createElement("div");
        this.container.className = "nav-project-picker";

        this.dropdown = new CustomDropdown(this.container, {
            options: [],
            placeholder: "Pick project",
            onChange: (value) => {
                appStateManager.selectProject(value);
            }
        });
        this.sync();

        // Options and selection are both re-read from state on every
        // relevant event, so the picker can't drift from the loaded state
        // (e.g. a view restored before the plugin finished initializing).
        const events = appStateManager.getEvents();
        events.on(PluginEvent.ProjectSelected, this.boundSync);
        events.on(PluginEvent.UpdateProjectsDone, this.boundSync);
        events.on(PluginEvent.AppStateUpdated, this.boundSync);
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    private sync(): void {
        const projects = this.appStateManager.getVolatileState().availableProjects || [];
        const project = this.appStateManager.getPersistentState().currentProjectName || 'All Projects';

        // AppStateUpdated fires on every zoom tick — only rebuild the menu
        // when the project list actually changed.
        const key = projects.join('\n');
        if (key !== this.optionsKey) {
            this.optionsKey = key;
            this.dropdown.setOptions(projects.map(p => ({ value: p, label: p })));
        }
        if (this.dropdown.getValue() !== project) {
            this.dropdown.setValue(project);
        }
    }

    public destroy(): void {
        const events = this.appStateManager.getEvents();
        events.off(PluginEvent.ProjectSelected, this.boundSync);
        events.off(PluginEvent.UpdateProjectsDone, this.boundSync);
        events.off(PluginEvent.AppStateUpdated, this.boundSync);
        this.dropdown.destroy();
    }
}
