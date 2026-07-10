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

		this.navSettings = new NavSettings(this.app, this.appStateManager);
		headerRow.appendChild(this.navSettings.getElement());

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
