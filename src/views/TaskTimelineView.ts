import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { AppStateManager } from '../core/AppStateManager';
import { NavBar } from '../components/NavBar/NavBar';
import { BoardContainer } from '../components/BoardContainer/BoardContainer';
import { PluginEvent } from '../enums/events';
import { DEFAULT_COLOR } from '../core/utils/colorUtils';
import { undoTaskMutation, redoTaskMutation } from '../core/update/taskHistory';

export const TASK_TIMELINE_VIEW_TYPE = 'task-timeline-view';

export class TaskTimelineView extends ItemView {
    private appStateManager: AppStateManager;
    private navBar: NavBar;
    private boardContainer: BoardContainer;
    private container: Element;

    // Bound handler for event cleanup
    private readonly boundUpdateColors = this.updateColorVariables.bind(this);
    private readonly boundKeyDown = this.onKeyDown.bind(this);

    constructor(leaf: WorkspaceLeaf, appRef: App, appStateManager: AppStateManager) {
        super(leaf);
        this.app = appRef;
        this.appStateManager = appStateManager;
    }

    getViewType() { return TASK_TIMELINE_VIEW_TYPE; }
    getDisplayText() { return 'Task Timeline'; }

    async onOpen() {
        this.container = this.containerEl.children[1];
        this.container.empty();
        this.container.addClass("task-timeline-container");

        // Apply initial color variables
        this.updateColorVariables();

        // Listen for settings changes to update colors
        this.appStateManager.getEvents().on(PluginEvent.UpdateSettingsDone, this.boundUpdateColors);

        this.navBar = new NavBar(this.app, this.appStateManager);
        this.container.appendChild(this.navBar.getElement());

        this.boardContainer = new BoardContainer(this.app, this.appStateManager, false);
        this.container.appendChild(this.boardContainer.element);

        // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) = redo for
        // drag/resize/move changes. Registered on document (capture) and gated
        // to the focused timeline leaf so it doesn't hijack the editor's undo.
        this.registerDomEvent(document, 'keydown', this.boundKeyDown, { capture: true });
    }

    private async onKeyDown(e: KeyboardEvent): Promise<void> {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;

        const key = e.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return;

        // Only the active timeline leaf handles the shortcut (avoids acting from
        // a background pane or firing once per open timeline).
        if (this.app.workspace.getActiveViewOfType(TaskTimelineView) !== this) return;

        // Don't steal undo while the user is typing in an input or editor.
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, textarea, [contenteditable="true"], .cm-editor')) return;

        const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
        e.preventDefault();
        e.stopPropagation();

        if (isRedo) {
            await redoTaskMutation(this.app, this.appStateManager);
        } else {
            await undoTaskMutation(this.app, this.appStateManager);
        }
    }

    private updateColorVariables(): void {
        const settings = this.appStateManager.getPersistentState().settings;
        const defaultColor = settings?.defaultCardColor || DEFAULT_COLOR;
        const hoverColor = this.lightenColor(defaultColor, 15);

        // Set CSS variables on the container element
        const containerEl = this.container as HTMLElement;
        containerEl.style.setProperty('--tt-button-bg', defaultColor);
        containerEl.style.setProperty('--tt-button-bg-hover', hoverColor);
        containerEl.style.setProperty('--tt-surface-1', defaultColor);
        containerEl.style.setProperty('--tt-surface-1-hover', hoverColor);
        containerEl.style.setProperty('--tt-surface-2', defaultColor);
        containerEl.style.setProperty('--tt-surface-2-hover', hoverColor);
    }

    /**
     * Lighten a hex color by a percentage
     */
    private lightenColor(hex: string, percent: number): string {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Parse hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Lighten each channel
        const newR = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
        const newG = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
        const newB = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));

        // Convert back to hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    async onClose() {
        // Remove event listener
        this.appStateManager.getEvents().off(PluginEvent.UpdateSettingsDone, this.boundUpdateColors);

        if (this.navBar) {
            this.navBar.destroy();
        }
        if (this.boardContainer) {
            this.boardContainer.destroy();
        }
    }
}