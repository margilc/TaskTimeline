import { App } from "obsidian";
import { AppStateManager } from "../../core/AppStateManager";
import { NavProjectPicker } from "./NavProjectPicker";
import { NavColorMapSelection } from "./NavColorMapSelection";
import { NavSettings } from "./NavSettings";

export class NavBar {
	private container: HTMLElement;
	private app: App;
	private appStateManager: AppStateManager;
	private navProjectPicker: NavProjectPicker;
	private navColorMapSelection: NavColorMapSelection;
	private navSettings: NavSettings;

	constructor(app: App, appStateManager: AppStateManager) {
		this.app = app;
		this.appStateManager = appStateManager;
		this.container = document.createElement("div");
		this.container.classList.add("nav-bar");

		this.render();
	}

	private render(): void {
		this.container.empty();

		// Header row: project picker + settings
		const headerRow = document.createElement("div");
		headerRow.className = "nav-header";
		headerRow.style.display = "flex";
		headerRow.style.justifyContent = "space-between";
		headerRow.style.alignItems = "center";

		this.navProjectPicker = new NavProjectPicker(this.appStateManager);
		headerRow.appendChild(this.navProjectPicker.getElement());

		// Right side: debug button + settings
		const rightButtonsContainer = document.createElement("div");
		rightButtonsContainer.style.display = "flex";
		rightButtonsContainer.style.alignItems = "center";
		rightButtonsContainer.style.gap = "8px";

		const debugButton = document.createElement("button");
		debugButton.textContent = "Dump State";
		debugButton.className = "tt-debug-dump-btn";
		debugButton.addEventListener("click", () => this.dumpAppState());

		this.navSettings = new NavSettings(this.app, this.appStateManager);

		rightButtonsContainer.appendChild(debugButton);
		rightButtonsContainer.appendChild(this.navSettings.getElement());
		headerRow.appendChild(rightButtonsContainer);

		this.container.appendChild(headerRow);

		// Color map row
		const colorMapRow = document.createElement("div");
		colorMapRow.className = "nav-color-map-row";

		this.navColorMapSelection = new NavColorMapSelection(colorMapRow, this.appStateManager);

		this.container.appendChild(colorMapRow);
	}

	public getElement(): HTMLElement {
		return this.container;
	}

	private dumpAppState(): void {
		const state = this.appStateManager.getState();

		const debugDump = {
			tasks: {
				count: state.volatile.currentTasks?.length || 0,
				list: state.volatile.currentTasks?.map(task => ({
					id: task.id,
					name: task.name,
					start: task.start,
					end: task.end,
					filePath: task.filePath,
					status: task.status,
					priority: task.priority,
					position: {
						xStart: task.xStart,
						xEnd: task.xEnd,
						y: task.y
					}
				})) || []
			},
			layout: {
				timeUnit: state.volatile.boardLayout?.timeUnit,
				gridWidth: state.volatile.boardLayout?.gridWidth,
				columnHeaders: state.volatile.boardLayout?.columnHeaders?.length || 0,
				taskGrids: state.volatile.boardLayout?.taskGrids?.map(grid => ({
					group: grid.group,
					taskCount: grid.tasks.length,
				})) || [],
			},
			zoom: state.volatile.zoomState,
			dateBounds: state.volatile.dateBounds,
			timestamp: new Date().toISOString()
		};

		const jsonString = JSON.stringify(debugDump, null, 2);

		navigator.clipboard.writeText(jsonString).then(() => {
			const notification = document.createElement("div");
			notification.textContent = "Debug dump copied to clipboard!";
			notification.className = "tt-toast tt-toast--success";
			notification.style.position = "fixed";
			notification.style.top = "20px";
			notification.style.right = "20px";
			notification.style.padding = "10px 15px";
			notification.style.borderRadius = "5px";
			notification.style.zIndex = "9999";
			document.body.appendChild(notification);

			setTimeout(() => {
				document.body.removeChild(notification);
			}, 3000);
		}).catch(() => {});
	}

	public destroy(): void {
		if (this.navProjectPicker) {
			this.navProjectPicker.destroy();
		}
		if (this.navColorMapSelection) {
			this.navColorMapSelection.destroy();
		}
		if (this.navSettings) {
			this.navSettings.destroy();
		}
	}
}
