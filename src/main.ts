import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { TaskTimelineView, TASK_TIMELINE_VIEW_TYPE } from "./views/TaskTimelineView";
import { AppStateManager } from "./core/AppStateManager";
import { DebugEventListener } from "./components/Debug/DebugEventListener";
import { TaskTimelineSettingTab } from "./settings/TaskTimelineSettingTab";

export default class TaskTimelinePlugin extends Plugin {
	appStateManager: AppStateManager;
	debugEventListener: DebugEventListener;

	async onload() {
		// AppStateManager - Includes vault event listening functionality
		this.appStateManager = new AppStateManager(this);
		await this.appStateManager.initialize();
		
		// DebugEventListener - Temporarily disabled to eliminate console spam
		// this.debugEventListener = new DebugEventListener(this.appStateManager);
		
		this.registerView(
			TASK_TIMELINE_VIEW_TYPE,
			(leaf) => new TaskTimelineView(leaf, this.app, this.appStateManager)
		);
		
		this.addSettingTab(
			new TaskTimelineSettingTab(
				this.app, 
				this, 
				this.appStateManager
			)
		);
		
		this.addRibbonIcon("calendar-clock", "Open Task Timeline", () => {
			this.activateView();
		});
		
		this.addCommand({
			id: "open-task-timeline",
			name: "Open Task Timeline",
			callback: () => {
				this.activateView();
			},
		});
		
		this.app.workspace.onLayoutReady(() => {
			const settings = this.appStateManager.getPersistentState().settings;
			if (settings?.openByDefault) {
				this.activateView();
			}
		});
	}

	async activateView() {
		try {
			let leaf: WorkspaceLeaf | null = null;
			const leaves = this.app.workspace.getLeavesOfType(TASK_TIMELINE_VIEW_TYPE);
			if (leaves.length > 0) {
				leaf = leaves[0];
			} else {
				const settings = this.appStateManager.getPersistentState().settings;
				const openInNewPane = settings?.openInNewPane || false;
				leaf = openInNewPane ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeaf(false);
				if (leaf) {
					await leaf.setViewState({ type: TASK_TIMELINE_VIEW_TYPE, active: true });
				}
			}
			if (leaf) {
				this.app.workspace.revealLeaf(leaf);
			}
		} catch (error) {
			new Notice('Failed to open Task Timeline. Please try again.');
		}
	}

	onunload() {
		// Clean up in reverse order
		this.debugEventListener?.destroy();
		this.appStateManager?.destroy();
		this.app.workspace.detachLeavesOfType(TASK_TIMELINE_VIEW_TYPE);
	}
} 