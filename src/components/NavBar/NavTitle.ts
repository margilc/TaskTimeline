
import { IAppState } from '../../interfaces/IAppState';
import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';

export class NavTitle {
    private element: HTMLElement;
    private appStateManager: AppStateManager;

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;
        this.element = this.createElement();
        this.setupEventListeners();
        this.updateDisplay();
    }

    private createElement(): HTMLElement {
        const titleEl = document.createElement("h1");
        titleEl.className = "nav-title";
        return titleEl;
    }

    private setupEventListeners(): void {
        // Listen for project selection changes
        this.appStateManager.getEvents().on(PluginEvent.ProjectSelected, () => {
            this.updateDisplay();
        });

        // Listen for general app state updates
        this.appStateManager.getEvents().on(PluginEvent.AppStateUpdated, () => {
            this.updateDisplay();
        });
    }

    private updateDisplay(): void {
        const state = this.appStateManager.getState();
        const currentProject = state.persistent.currentProjectName || "All Projects";
        this.element.textContent = currentProject === "All" ? "All Projects" : currentProject;
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public destroy(): void {
        // Clean up event listeners to prevent memory leaks
        // Event cleanup handled by AppStateManager's Events instance
    }
}

// Removed legacy createNavTitle function - now using NavTitle class with AppStateManager


