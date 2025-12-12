import { App } from "obsidian";
import { AppStateManager } from "../../core/AppStateManager";
import { BoardTaskGroup } from "./BoardTaskGroup";
import { BoardTimelineHeader } from "./BoardTimelineHeader";
import { PluginEvent } from "../../enums/events";
import { ITask } from "../../interfaces/ITask";
import { createEmptyStateElement, validateTask } from "../../core/utils/boardUtils";
import { debounce } from "../../core/utils/layoutUtils";

export class BoardContainer {
    public element: HTMLElement;
    private app: App;
    private appStateManager: AppStateManager;
    private contentElement: HTMLElement;
    private isDebugMode: boolean;
    private sharedTooltip: HTMLElement;

    // Stable containers for incremental DOM updates
    private timelineHeaderContainer: HTMLElement | null = null;
    private groupsContainer: HTMLElement | null = null;
    private groupElements: Map<string, HTMLElement> = new Map();

    // Track last rendered state for diffing
    private lastLayoutVersion: number = -1;

    // Bound handlers for proper event listener cleanup
    private readonly boundRenderBoard = this.renderBoard.bind(this);
    private readonly boundDebouncedRender: (...args: any[]) => void;
    private readonly boundScrollHandler: (e: Event) => void;
    private scrollRAF: number | null = null;

    constructor(app: App, appStateManager: AppStateManager, isDebugMode = false) {
        this.app = app;
        this.appStateManager = appStateManager;
        this.isDebugMode = isDebugMode;

        this.boundDebouncedRender = debounce(() => this.renderBoard(), 250);
        this.boundScrollHandler = this.handleScroll.bind(this);

        this.element = document.createElement("div");
        this.element.classList.add("board-container");

        this.contentElement = document.createElement("div");
        this.contentElement.classList.add("board-content");
        this.element.appendChild(this.contentElement);

        // Add scroll listener for frozen column effect
        this.contentElement.addEventListener('scroll', this.boundScrollHandler);

        // Create stable containers for incremental updates
        this.timelineHeaderContainer = document.createElement("div");
        this.timelineHeaderContainer.classList.add("timeline-header-container");
        this.contentElement.appendChild(this.timelineHeaderContainer);

        this.groupsContainer = document.createElement("div");
        this.groupsContainer.classList.add("groups-container");
        this.contentElement.appendChild(this.groupsContainer);

        // Create shared tooltip once (instead of per-card)
        this.sharedTooltip = this.createSharedTooltip();
        document.body.appendChild(this.sharedTooltip);

        // Render only on UpdateLayoutDone (the "ready to render" signal)
        // Removed UpdateTasksDone listener to prevent double-render
        this.appStateManager.getEvents().on(PluginEvent.UpdateLayoutDone, this.boundRenderBoard);
        this.appStateManager.getEvents().on(PluginEvent.UpdateBoardGroupingDone, this.boundDebouncedRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateColorMappingsDone, this.boundDebouncedRender);

        this.renderBoard();
    }

    private createSharedTooltip(): HTMLElement {
        const tooltip = document.createElement("div");
        tooltip.className = "task-timeline-tooltip";
        tooltip.style.display = "none";
        return tooltip;
    }

    public getSharedTooltip(): HTMLElement {
        return this.sharedTooltip;
    }

    /**
     * Handle horizontal scroll to keep first column frozen via CSS transform.
     * Uses requestAnimationFrame for smooth performance.
     */
    private handleScroll(): void {
        if (this.scrollRAF) return;

        this.scrollRAF = requestAnimationFrame(() => {
            const scrollLeft = this.contentElement.scrollLeft;

            // Update all group headers to stay fixed on the left
            const groupHeaders = this.groupsContainer?.querySelectorAll('.group-header');
            groupHeaders?.forEach((header: Element) => {
                (header as HTMLElement).style.transform = `translateX(${scrollLeft}px)`;
            });

            // Also update the grouping selection dropdown in the header row
            const groupingSelection = this.timelineHeaderContainer?.querySelector('.board-grouping-selection');
            if (groupingSelection) {
                (groupingSelection as HTMLElement).style.transform = `translateX(${scrollLeft}px)`;
            }

            this.scrollRAF = null;
        });
    }

    private renderBoard(): void {
        try {
            const state = this.appStateManager.getState();
            const boardLayout = state.volatile.boardLayout;
            const currentTasks = state.volatile.currentTasks;

            // Handle loading/empty states by clearing containers
            if (!boardLayout) {
                this.clearContainers();
                this.showEmptyState('Loading board layout...', 'board-loading-state');
                return;
            }

            if (currentTasks === undefined) {
                this.clearContainers();
                this.showEmptyState('Loading tasks...', 'board-loading-state');
                return;
            }

            if (!boardLayout.columnHeaders || boardLayout.columnHeaders.length === 0) {
                this.clearContainers();
                this.showEmptyState('No timeline columns available. Adjust your date range.', 'board-no-columns-state');
                return;
            }

            // Clear any previous empty state
            this.clearEmptyState();

            const settings = state.persistent.settings || {};
            const columnWidth = settings.columnWidth || 200;
            const rowHeight = settings.rowHeight || 80;

            // Update timeline header (recreate - it's small)
            this.updateTimelineHeader(boardLayout, columnWidth);

            if (!boardLayout.taskGrids || boardLayout.taskGrids.length === 0) {
                this.clearGroups();
                this.showEmptyState('No tasks to display. Create some tasks to see them here!', 'board-no-tasks-state');
                return;
            }

            // Incremental group updates
            this.updateGroups(boardLayout, settings, columnWidth, rowHeight);

        } catch (error) {
            this.clearContainers();
            this.showEmptyState('Error loading board. Please try refreshing.', 'board-error-state');
        }
    }

    private clearContainers(): void {
        if (this.timelineHeaderContainer) {
            this.timelineHeaderContainer.innerHTML = '';
        }
        this.clearGroups();
    }

    private clearGroups(): void {
        if (this.groupsContainer) {
            this.groupsContainer.innerHTML = '';
        }
        this.groupElements.clear();
    }

    private showEmptyState(message: string, className: string): void {
        // Check if empty state already exists
        const existing = this.contentElement.querySelector('.board-empty-state');
        if (existing) {
            existing.textContent = message;
            existing.className = `board-empty-state ${className}`;
            return;
        }
        const emptyState = createEmptyStateElement(message, className);
        emptyState.classList.add('board-empty-state');
        this.contentElement.appendChild(emptyState);
    }

    private clearEmptyState(): void {
        const existing = this.contentElement.querySelector('.board-empty-state');
        if (existing) {
            existing.remove();
        }
    }

    private updateTimelineHeader(boardLayout: any, columnWidth: number): void {
        if (!this.timelineHeaderContainer) return;
        // Timeline header is relatively small, just recreate it
        this.timelineHeaderContainer.innerHTML = '';
        const timelineHeaderEl = BoardTimelineHeader(boardLayout, this.appStateManager, this.app, columnWidth, this.isDebugMode);
        this.timelineHeaderContainer.appendChild(timelineHeaderEl);
    }

    private updateGroups(boardLayout: any, settings: any, columnWidth: number, rowHeight: number): void {
        if (!this.groupsContainer) return;

        const currentGroupNames = new Set<string>();

        // Process each task grid
        boardLayout.taskGrids.forEach((taskGrid: any) => {
            try {
                const groupName = taskGrid.group;
                currentGroupNames.add(groupName);

                const tasksInGroup = taskGrid.tasks as ITask[];
                const validTasks = tasksInGroup.filter(task => {
                    const validation = validateTask(task);
                    return validation.isValid;
                });

                if (validTasks.length === 0) {
                    // Remove group if it exists but has no valid tasks
                    this.removeGroup(groupName);
                    currentGroupNames.delete(groupName);
                    return;
                }

                const maxY = validTasks.reduce((max: number, task: ITask) => Math.max(max, task.y ?? -1), -1);
                const gridHeight = Math.max(1, maxY + 1);

                const gridConfig = {
                    gridWidth: boardLayout.columnHeaders.length,
                    gridHeight,
                    columnWidth,
                    rowHeight
                };

                // Check if group already exists
                const existingGroup = this.groupElements.get(groupName);
                if (existingGroup) {
                    // Replace existing group content (keeping the container stable)
                    const newGroupEl = BoardTaskGroup(groupName, validTasks, gridConfig, settings, this.appStateManager, this.app, this.isDebugMode, this.sharedTooltip);
                    existingGroup.replaceWith(newGroupEl);
                    this.groupElements.set(groupName, newGroupEl);
                } else {
                    // Create new group
                    const taskGroupEl = BoardTaskGroup(groupName, validTasks, gridConfig, settings, this.appStateManager, this.app, this.isDebugMode, this.sharedTooltip);
                    this.groupsContainer!.appendChild(taskGroupEl);
                    this.groupElements.set(groupName, taskGroupEl);
                }
            } catch (error) {
                const errorElement = createEmptyStateElement(
                    `Error loading group: ${taskGrid.group}`,
                    'board-group-error-state'
                );
                this.groupsContainer!.appendChild(errorElement);
            }
        });

        // Remove stale groups that no longer exist
        for (const [groupName, element] of this.groupElements.entries()) {
            if (!currentGroupNames.has(groupName)) {
                element.remove();
                this.groupElements.delete(groupName);
            }
        }
    }

    private removeGroup(groupName: string): void {
        const element = this.groupElements.get(groupName);
        if (element) {
            element.remove();
            this.groupElements.delete(groupName);
        }
    }

    public destroy(): void {
        // Unsubscribe event listeners
        this.appStateManager.getEvents().off(PluginEvent.UpdateLayoutDone, this.boundRenderBoard);
        this.appStateManager.getEvents().off(PluginEvent.UpdateBoardGroupingDone, this.boundDebouncedRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateColorMappingsDone, this.boundDebouncedRender);

        // Remove scroll listener
        this.contentElement.removeEventListener('scroll', this.boundScrollHandler);
        if (this.scrollRAF) {
            cancelAnimationFrame(this.scrollRAF);
            this.scrollRAF = null;
        }

        // Clear incremental update tracking
        this.groupElements.clear();
        this.timelineHeaderContainer = null;
        this.groupsContainer = null;

        // Remove shared tooltip
        if (this.sharedTooltip && this.sharedTooltip.parentNode) {
            this.sharedTooltip.parentNode.removeChild(this.sharedTooltip);
        }

        // Clean up any legacy per-card tooltips (for cleanup during transition)
        const legacyTooltips = document.querySelectorAll('.task-timeline-tooltip');
        legacyTooltips.forEach(tooltip => {
            if (tooltip !== this.sharedTooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
    }
}
