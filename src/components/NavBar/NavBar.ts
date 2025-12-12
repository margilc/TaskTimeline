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
		headerRow.style.display = "flex";
		headerRow.style.justifyContent = "space-between";
		headerRow.style.alignItems = "center";
		
		this.navTitle = new NavTitle(this.appStateManager);
		headerRow.appendChild(this.navTitle.getElement());
		
		// Right side container for buttons
		const rightButtonsContainer = document.createElement("div");
		rightButtonsContainer.style.display = "flex";
		rightButtonsContainer.style.alignItems = "center";
		rightButtonsContainer.style.gap = "8px";
		
		// Debug dump button
		const debugButton = document.createElement("button");
		debugButton.textContent = "🐛 Dump State";
		debugButton.className = "tt-debug-dump-btn";
		debugButton.addEventListener("click", () => this.dumpAppState());
		
		this.navSettings = new NavSettings(this.app, this.appStateManager);
		
		rightButtonsContainer.appendChild(debugButton);
		rightButtonsContainer.appendChild(this.navSettings.getElement());
		headerRow.appendChild(rightButtonsContainer);
		
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

	private dumpAppState(): void {
		const state = this.appStateManager.getState();
		
		// Create comprehensive debug dump including tasks and layout
		const debugDump = {
			tasks: {
				count: state.volatile.currentTasks?.length || 0,
				list: state.volatile.currentTasks?.map(task => ({
					id: task.id,
					name: task.name,
					start: task.start,
					end: task.end,
					filePath: task.filePath,
					projectId: task.projectId,
					status: task.status,
					priority: task.priority,
					responsible: task.responsible,
					position: {
						x: task.x,
						y: task.y,
						xStart: task.xStart,
						xEnd: task.xEnd
					}
				})) || []
			},
			layout: {
				timeUnit: state.volatile.boardLayout?.timeUnit,
				gridWidth: state.volatile.boardLayout?.gridWidth,
				columnHeaders: state.volatile.boardLayout?.columnHeaders?.map(header => ({
					date: header.date.toISOString().split('T')[0],
					label: header.label,
					index: header.index,
					isEmphasized: header.isEmphasized
				})) || [],
				taskGrids: state.volatile.boardLayout?.taskGrids?.map(grid => ({
					group: grid.group,
					taskCount: grid.tasks.length,
					tasks: grid.tasks.map(task => ({
						id: task.id,
						name: task.name,
						xStart: task.xStart,
						xEnd: task.xEnd,
						y: task.y
					}))
				})) || [],
				viewport: state.volatile.boardLayout?.viewport ? {
					startDate: state.volatile.boardLayout.viewport.startDate.toISOString().split('T')[0],
					endDate: state.volatile.boardLayout.viewport.endDate.toISOString().split('T')[0]
				} : null
			},
			settings: {
				numberOfColumns: state.persistent.settings?.numberOfColumns,
				currentTimeUnit: state.persistent.currentTimeUnit
			},
			timeline: {
				globalMinDateSnapped: state.volatile.globalMinDateSnapped,
				globalMaxDateSnapped: state.volatile.globalMaxDateSnapped,
				timelineViewport: state.volatile.timelineViewport,
				spanDays: state.volatile.globalMinDateSnapped && state.volatile.globalMaxDateSnapped ? 
					Math.floor((new Date(state.volatile.globalMaxDateSnapped).getTime() - new Date(state.volatile.globalMinDateSnapped).getTime()) / (1000 * 60 * 60 * 24)) : null
			},
			timestamp: new Date().toISOString()
		};
		
		const jsonString = JSON.stringify(debugDump, null, 2);
		
		// Copy to clipboard
		navigator.clipboard.writeText(jsonString).then(() => {
			
			// Show temporary notification
			const notification = document.createElement("div");
			notification.textContent = "✅ Debug dump (tasks + layout) copied to clipboard!";
			notification.className = "tt-toast tt-toast--success";
			notification.style.position = "fixed";
			notification.style.top = "20px";
			notification.style.right = "20px";
			notification.style.padding = "10px 15px";
			notification.style.borderRadius = "5px";
			notification.style.zIndex = "9999";
			notification.style.fontSize = "14px";
			document.body.appendChild(notification);
			
			setTimeout(() => {
				document.body.removeChild(notification);
			}, 3000);
		}).catch(err => {
		});
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