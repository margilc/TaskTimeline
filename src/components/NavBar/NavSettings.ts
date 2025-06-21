import { App } from "obsidian";
import { AppStateManager } from "../../core/AppStateManager";

export class NavSettings {
	private element: HTMLElement;
	private app: App;
	private appStateManager: AppStateManager;

	constructor(app: App, appStateManager: AppStateManager) {
		this.app = app;
		this.appStateManager = appStateManager;
		this.element = document.createElement("button");
		this.render();
	}

	private render(): void {
		this.element.className = "nav-settings-button";
		this.element.setAttribute("aria-label", "Open plugin settings");
		
		// Create gear icon
		const icon = document.createElement("div");
		icon.className = "nav-settings-icon";
		icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
			<circle cx="12" cy="12" r="3"/>
		</svg>`;
		
		this.element.appendChild(icon);
		
		this.element.addEventListener("click", this.handleClick.bind(this));
	}

	private handleClick(): void {
		// Open plugin settings tab
		this.app.setting.open();
		this.app.setting.openTabById("task-timeline");
	}

	public getElement(): HTMLElement {
		return this.element;
	}

	public destroy(): void {
		// No cleanup needed for this simple component
	}
}