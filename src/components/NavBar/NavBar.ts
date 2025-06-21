import { App } from "obsidian";
import { AppStateManager } from "../../core/AppStateManager";
import { NavTitle } from "./NavTitle";
import { NavProjectsSelection } from "./NavProjectsSelection";
import { NavColorMapSelection } from "./NavColorMapSelection";
import { NavViewsSelection } from "./NavViewsSelection";
import { NavTimelineSelection } from "./NavTimelineSelection";
import { NavSettings } from "./NavSettings";
import { PluginEvent } from "../../enums/events";

export class NavBar {
	private container: HTMLElement;
	private app: App;
	private appStateManager: AppStateManager;
	private navTitle: NavTitle;
	private navProjectsSelection: NavProjectsSelection;
	private navColorMapSelection: NavColorMapSelection;
	private navViewsSelection: NavViewsSelection;
	private navTimelineSelection: NavTimelineSelection;
	private navSettings: NavSettings;

	constructor(app: App, appStateManager: AppStateManager) {
		this.app = app;
		this.appStateManager = appStateManager;
		this.container = document.createElement("div");
		this.container.classList.add("nav-bar");
		
		this.setupEventListeners();
		this.render();
	}

	private setupEventListeners(): void {
		this.appStateManager.getEvents().on(PluginEvent.AppStateUpdated, () => {});
	}

	private render(): void {
		this.container.empty();

		const headerRow = document.createElement("div");
		headerRow.className = "nav-header";
		
		this.navTitle = new NavTitle(this.appStateManager);
		headerRow.appendChild(this.navTitle.getElement());
		
		this.navSettings = new NavSettings(this.app, this.appStateManager);
		headerRow.appendChild(this.navSettings.getElement());
		
		this.container.appendChild(headerRow);

		const controlsRow = document.createElement("div");
		controlsRow.className = "nav-controls-row";

		this.navProjectsSelection = new NavProjectsSelection(this.app, this.appStateManager);
		controlsRow.appendChild(this.navProjectsSelection.getElement());

		const viewsContainer = document.createElement("div");
		viewsContainer.className = "nav-views-container";
		this.navViewsSelection = new NavViewsSelection(viewsContainer, this.appStateManager);
		controlsRow.appendChild(viewsContainer);

		this.container.appendChild(controlsRow);

		const colorMapRow = document.createElement("div");
		colorMapRow.className = "nav-color-map-row";

		this.navColorMapSelection = new NavColorMapSelection(colorMapRow, this.appStateManager);

		this.container.appendChild(colorMapRow);

		const timelineRow = document.createElement("div");
		timelineRow.className = "nav-timeline-row";

		this.navTimelineSelection = new NavTimelineSelection(timelineRow, this.appStateManager);

		this.container.appendChild(timelineRow);
	}

	public getElement(): HTMLElement {
		return this.container;
	}

	public destroy(): void {
		if (this.navTitle) {
			this.navTitle.destroy();
		}
		if (this.navProjectsSelection) {
			this.navProjectsSelection.destroy();
		}
		if (this.navColorMapSelection) {
			this.navColorMapSelection.destroy();
		}
		if (this.navViewsSelection) {
			this.navViewsSelection.destroy();
		}
		if (this.navTimelineSelection) {
			this.navTimelineSelection.destroy();
		}
		if (this.navSettings) {
			this.navSettings.destroy();
		}

		// Event cleanup handled by AppStateManager's Events instance
	}
}