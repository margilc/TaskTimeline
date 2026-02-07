import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";

export class NavProjectPicker {
    private container: HTMLElement;
    private headingEl: HTMLElement;
    private dropdownEl: HTMLElement;
    private isOpen: boolean = false;
    private appStateManager: AppStateManager;
    private outsideClickHandler: (e: MouseEvent) => void;

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;

        this.container = document.createElement("div");
        this.container.className = "nav-project-picker";
        this.container.style.position = "relative";

        this.headingEl = document.createElement("h2");
        this.headingEl.className = "nav-project-heading";
        this.headingEl.style.cursor = "pointer";
        this.headingEl.style.margin = "0";
        this.headingEl.style.userSelect = "none";

        // Show current project or default text
        const currentProject = appStateManager.getPersistentState().currentProjectName;
        this.headingEl.textContent = currentProject || "Pick project";

        this.headingEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        this.container.appendChild(this.headingEl);

        // Dropdown menu (hidden by default)
        this.dropdownEl = document.createElement("div");
        this.dropdownEl.className = "nav-project-dropdown";
        this.dropdownEl.style.display = "none";
        this.dropdownEl.style.position = "absolute";
        this.dropdownEl.style.top = "100%";
        this.dropdownEl.style.left = "0";
        this.dropdownEl.style.zIndex = "100";
        this.dropdownEl.style.minWidth = "200px";
        this.container.appendChild(this.dropdownEl);

        // Close on outside click
        this.outsideClickHandler = (e: MouseEvent) => {
            if (!this.container.contains(e.target as Node)) {
                this.close();
            }
        };
        document.addEventListener("click", this.outsideClickHandler);

        // Listen for state updates
        appStateManager.getEvents().on(PluginEvent.ProjectSelected, (name: string) => {
            this.headingEl.textContent = name;
            this.close();
        });
        appStateManager.getEvents().on(PluginEvent.UpdateProjectsDone, () => {
            if (this.isOpen) this.populateDropdown();
        });
        appStateManager.getEvents().on(PluginEvent.AppStateUpdated, () => {
            const project = appStateManager.getPersistentState().currentProjectName;
            if (project && this.headingEl.textContent !== project) {
                this.headingEl.textContent = project;
            }
        });
    }

    private toggleDropdown(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.populateDropdown();
            this.dropdownEl.style.display = "block";
            this.isOpen = true;
        }
    }

    private close(): void {
        this.dropdownEl.style.display = "none";
        this.isOpen = false;
    }

    private populateDropdown(): void {
        this.dropdownEl.innerHTML = "";

        const projects = this.appStateManager.getVolatileState().availableProjects || [];

        for (const project of projects) {
            const item = document.createElement("div");
            item.className = "nav-project-dropdown-item";
            item.textContent = project;
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                this.appStateManager.selectProject(project);
            });
            this.dropdownEl.appendChild(item);
        }
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public destroy(): void {
        document.removeEventListener("click", this.outsideClickHandler);
    }
}
