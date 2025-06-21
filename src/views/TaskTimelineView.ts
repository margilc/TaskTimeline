import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { AppStateManager } from '../core/AppStateManager';
import { NavBar } from '../components/NavBar/NavBar';
import { BoardContainer } from '../components/BoardContainer/BoardContainer';

export const TASK_TIMELINE_VIEW_TYPE = 'task-timeline-view';

export class TaskTimelineView extends ItemView {
    private appStateManager: AppStateManager;
    private navBar: NavBar;
    private boardContainer: BoardContainer;

    constructor(leaf: WorkspaceLeaf, appRef: App, appStateManager: AppStateManager) {
        super(leaf);
        this.app = appRef;
        this.appStateManager = appStateManager;
    }

    getViewType() { return TASK_TIMELINE_VIEW_TYPE; }
    getDisplayText() { return 'Task Timeline'; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("task-timeline-container");

        this.navBar = new NavBar(this.app, this.appStateManager);
        container.appendChild(this.navBar.getElement());

        this.boardContainer = new BoardContainer(this.app, this.appStateManager, false);
        container.appendChild(this.boardContainer.element);
    }

    async onClose() {
        if (this.navBar) {
            this.navBar.destroy();
        }
        if (this.boardContainer) {
            this.boardContainer.destroy();
        }
    }
}