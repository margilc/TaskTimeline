import { Plugin, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { TaskTimelineView, TASK_TIMELINE_VIEW_TYPE } from "./views/TaskTimelineView";
import { HorizontalTaskView, HORIZONTAL_TASK_VIEW_TYPE } from "./views/HorizontalTaskView";
import { AppStateManager } from "./core/AppStateManager";
import { TaskTimelineSettingTab } from "./settings/TaskTimelineSettingTab";
import { hasHorizontalModeFrontmatter } from "./core/utils/horizontalTaskUtils";

export default class TaskTimelinePlugin extends Plugin {
	appStateManager: AppStateManager;

	async onload() {
		// AppStateManager's constructor registers the vault event listeners, so it
		// must be created here in onload(). Its vault-dependent initialize() is
		// deferred to onLayoutReady() below.
		this.appStateManager = new AppStateManager(this);

		this.registerView(
			TASK_TIMELINE_VIEW_TYPE,
			(leaf) => new TaskTimelineView(leaf, this.app, this.appStateManager)
		);

		this.registerView(
			HORIZONTAL_TASK_VIEW_TYPE,
			(leaf) => new HorizontalTaskView(leaf, this.app)
		);

		this.registerHorizontalModeFileInterceptor();
		
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
		
		// Defer vault-dependent initialization until the metadata cache is fully
		// populated. Running it during onload() reads a cold/partial file tree:
		// on WSL/NTFS vaults that surfaced as a "Folder already exists" throw from
		// ensureTemplatesFolder (which aborted all of initialize()), and could
		// leave the board empty on first load because project/task enumeration ran
		// before the folder tree was indexed. onLayoutReady fires immediately if
		// the layout is already ready (e.g. plugin enabled after Obsidian boot).
		this.app.workspace.onLayoutReady(async () => {
			await this.appStateManager.initialize();
			const settings = this.appStateManager.getPersistentState().settings;
			if (settings?.openByDefault) {
				this.activateView();
			}
		});
	}

	private registerHorizontalModeFileInterceptor(): void {
		this.registerEvent(this.app.workspace.on('file-open', async (file: TFile | null) => {
			if (!file || file.extension !== 'md') return;

			const activeLeaf = this.app.workspace.activeLeaf;
			if (!activeLeaf || activeLeaf.view.getViewType() === HORIZONTAL_TASK_VIEW_TYPE) return;

			try {
				const content = await this.app.vault.read(file);
				if (!hasHorizontalModeFrontmatter(content)) return;

				await activeLeaf.setViewState({
					type: HORIZONTAL_TASK_VIEW_TYPE,
					state: { filePath: file.path },
					active: true,
				});
			} catch (error) {
				console.error('TaskTimeline: Failed to open horizontal task view', error);
			}
		}));
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
		this.appStateManager?.destroy();
		this.app.workspace.detachLeavesOfType(HORIZONTAL_TASK_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(TASK_TIMELINE_VIEW_TYPE);
	}
} 