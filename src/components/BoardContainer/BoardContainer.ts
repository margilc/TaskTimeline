import { App } from "obsidian";
import { AppStateManager, ZOOM_TIME_UNITS } from "../../core/AppStateManager";
import { BoardTaskGroup } from "./BoardTaskGroup";
import { BoardTimelineHeader } from "./BoardTimelineHeader";
import { PluginEvent } from "../../enums/events";
import { ITask } from "../../interfaces/ITask";
import { createEmptyStateElement, validateTask } from "../../core/utils/boardUtils";
import { debounce } from "../../core/utils/layoutUtils";
import { isTaskHidden } from "../../core/utils/colorUtils";
import { TimeUnit } from "../../enums/TimeUnit";
import { snapToUnitBoundary, countDateUnits } from "../../core/update/updateLayout";
import { addTime } from "../../core/utils/dateUtils";

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

    // Bound handlers for proper event listener cleanup
    private readonly boundRenderBoard = this.renderBoard.bind(this);
    private readonly boundDebouncedRender: (...args: any[]) => void;

    // Zoom and pan cleanup functions
    private zoomCleanup: (() => void) | null = null;
    private panCleanup: (() => void) | null = null;

    // Scroll persistence
    private scrollCleanup: (() => void) | null = null;
    private hasRestoredScroll = false;

    // Zoom anchor for cursor-anchored zoom
    private pendingZoomAnchor: { anchorDate: Date, mouseX: number } | null = null;

    constructor(app: App, appStateManager: AppStateManager, isDebugMode = false) {
        this.app = app;
        this.appStateManager = appStateManager;
        this.isDebugMode = isDebugMode;

        this.boundDebouncedRender = debounce(() => this.renderBoard(), 250);

        this.element = document.createElement("div");
        this.element.classList.add("board-container");

        this.contentElement = document.createElement("div");
        this.contentElement.classList.add("board-content");
        this.element.appendChild(this.contentElement);

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

        // Event listeners
        this.appStateManager.getEvents().on(PluginEvent.UpdateLayoutDone, this.boundRenderBoard);
        this.appStateManager.getEvents().on(PluginEvent.UpdateBoardGroupingDone, this.boundDebouncedRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateColorMappingsDone, this.boundDebouncedRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateGroupOrderDone, this.boundDebouncedRender);

        // Setup zoom, pan, and scroll persistence handlers
        this.zoomCleanup = this.setupZoomHandler();
        this.panCleanup = this.setupPanHandler();
        this.scrollCleanup = this.setupScrollPersistence();

        this.renderBoard();
    }

    private createSharedTooltip(): HTMLElement {
        const tooltip = document.createElement("div");
        tooltip.className = "task-timeline-tooltip";
        tooltip.style.display = "none";
        return tooltip;
    }

    private setupZoomHandler(): () => void {
        const handler = (e: WheelEvent) => {
            e.preventDefault();

            const state = this.appStateManager.getState();
            const zoom = state.volatile.zoomState;
            if (!zoom) return;

            const settings = state.persistent.settings || {};
            const minColWidth = settings.minColWidth ?? 30;
            const maxColWidth = settings.maxColWidth ?? 150;
            const zoomStep = settings.zoomStep ?? 10;

            const direction = e.deltaY < 0 ? 1 : -1; // scroll up = zoom in (wider)
            const oldColW = zoom.columnWidth;
            let newColW = oldColW + direction * zoomStep;
            let newModeIndex = zoom.modeIndex;

            // Handle boundary transitions
            if (newColW > maxColWidth) {
                if (zoom.modeIndex > 0) {
                    // Zoom in past max → finer time unit, reset to min width
                    newModeIndex = zoom.modeIndex - 1;
                    newColW = minColWidth;
                } else {
                    // Already finest (day), clamp
                    newColW = maxColWidth;
                    if (oldColW === maxColWidth) return;
                }
            } else if (newColW < minColWidth) {
                if (zoom.modeIndex < ZOOM_TIME_UNITS.length - 1) {
                    // Zoom out past min → coarser time unit, reset to max width
                    newModeIndex = zoom.modeIndex + 1;
                    newColW = maxColWidth;
                } else {
                    // Already coarsest (month), clamp
                    newColW = minColWidth;
                    if (oldColW === minColWidth) return;
                }
            }

            // Capture anchor on first wheel event in a batch (before state changes)
            if (!this.pendingZoomAnchor) {
                const rect = this.contentElement.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const contentX = this.contentElement.scrollLeft + mouseX;

                const dateBounds = state.volatile.dateBounds;
                if (dateBounds) {
                    const oldTimeUnit = ZOOM_TIME_UNITS[zoom.modeIndex] as TimeUnit;
                    const oldStart = snapToUnitBoundary(new Date(dateBounds.earliest), oldTimeUnit);
                    const fractionalCol = contentX / oldColW;
                    const anchorDate = addFractionalUnits(oldStart, fractionalCol, oldTimeUnit);
                    this.pendingZoomAnchor = { anchorDate, mouseX };
                }
            }

            // Emit zoom change
            this.appStateManager.emit(PluginEvent.UpdateZoomPending, {
                modeIndex: newModeIndex,
                columnWidth: newColW
            });
        };

        this.contentElement.addEventListener('wheel', handler, { passive: false });
        return () => this.contentElement.removeEventListener('wheel', handler);
    }

    private setupPanHandler(): () => void {
        let active = false;
        let startX = 0, startY = 0;
        let startScrollLeft = 0, startScrollTop = 0;
        let suppressContext = false;

        const onDown = (e: MouseEvent) => {
            if (e.button !== 2) return;
            e.preventDefault();
            active = true;
            startX = e.clientX;
            startY = e.clientY;
            startScrollLeft = this.contentElement.scrollLeft;
            startScrollTop = this.contentElement.scrollTop;
            this.contentElement.style.cursor = 'grabbing';
            this.contentElement.style.userSelect = 'none';
            suppressContext = true;
        };

        const onMove = (e: MouseEvent) => {
            if (!active) return;
            this.contentElement.scrollLeft = startScrollLeft - (e.clientX - startX);
            this.contentElement.scrollTop = startScrollTop - (e.clientY - startY);
        };

        const onUp = (e: MouseEvent) => {
            if (e.button !== 2 || !active) return;
            active = false;
            this.contentElement.style.cursor = '';
            this.contentElement.style.userSelect = '';
        };

        const onContext = (e: MouseEvent) => {
            if (suppressContext) {
                const moved = Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3;
                if (moved) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                suppressContext = false;
            }
        };

        this.contentElement.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        this.contentElement.addEventListener('contextmenu', onContext);

        return () => {
            this.contentElement.removeEventListener('mousedown', onDown);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.contentElement.removeEventListener('contextmenu', onContext);
        };
    }

    private setupScrollPersistence(): () => void {
        const saveScroll = debounce(() => {
            this.appStateManager.saveScrollPosition(
                this.contentElement.scrollLeft,
                this.contentElement.scrollTop
            );
        }, 500);

        this.contentElement.addEventListener('scroll', saveScroll);
        return () => this.contentElement.removeEventListener('scroll', saveScroll);
    }

    private restoreScrollPosition(): void {
        if (this.hasRestoredScroll) return;
        const saved = this.appStateManager.getPersistentState().scrollPosition;
        if (saved) {
            this.contentElement.scrollLeft = saved.left;
            this.contentElement.scrollTop = saved.top;
        }
        this.hasRestoredScroll = true;
    }

    private renderBoard(): void {
        try {
            const state = this.appStateManager.getState();
            const boardLayout = state.volatile.boardLayout;
            const currentTasks = state.volatile.currentTasks;

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
                this.showEmptyState('No timeline columns available.', 'board-no-columns-state');
                return;
            }

            this.clearEmptyState();

            const settings = state.persistent.settings || {};
            const zoomState = state.volatile.zoomState;
            const columnWidth = zoomState?.columnWidth || 100;
            const rowHeight = settings.rowHeight || 80;

            // Scale card font size proportionally within column width range
            const minCW = settings.minColWidth ?? 30;
            const maxCW = settings.maxColWidth ?? 150;
            const minFS = settings.minFontSize ?? 8;
            const maxFS = settings.maxFontSize ?? 14;
            const t = maxCW > minCW ? Math.max(0, Math.min(1, (columnWidth - minCW) / (maxCW - minCW))) : 0.5;
            const fontSize = Math.round(minFS + t * (maxFS - minFS));
            this.contentElement.style.setProperty('--tt-card-font-size', `${fontSize}px`);

            this.updateTimelineHeader(boardLayout, columnWidth);

            if (!boardLayout.taskGrids || boardLayout.taskGrids.length === 0) {
                this.clearGroups();
                this.showEmptyState('No tasks to display. Create some tasks to see them here!', 'board-no-tasks-state');
                return;
            }

            this.updateGroups(boardLayout, settings, columnWidth, rowHeight);

            // Apply zoom cursor anchor after DOM update
            if (this.pendingZoomAnchor) {
                const dateBounds = state.volatile.dateBounds;
                if (dateBounds) {
                    const { anchorDate, mouseX } = this.pendingZoomAnchor;
                    const zoomState = state.volatile.zoomState;
                    const newColW = zoomState?.columnWidth || 100;
                    const newTimeUnit = ZOOM_TIME_UNITS[zoomState?.modeIndex || 0] as TimeUnit;
                    const newStart = snapToUnitBoundary(new Date(dateBounds.earliest), newTimeUnit);
                    const newFractionalCol = dateDiffInUnits(newStart, anchorDate, newTimeUnit);
                    this.contentElement.scrollLeft = Math.max(0, newFractionalCol * newColW - mouseX);
                }
                this.pendingZoomAnchor = null;
            }

            // Restore saved scroll position after first real render
            requestAnimationFrame(() => this.restoreScrollPosition());

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
        this.timelineHeaderContainer.innerHTML = '';
        const timelineHeaderEl = BoardTimelineHeader(boardLayout, this.appStateManager, this.app, columnWidth, this.isDebugMode);
        this.timelineHeaderContainer.appendChild(timelineHeaderEl);
    }

    private updateGroups(boardLayout: any, settings: any, columnWidth: number, rowHeight: number): void {
        if (!this.groupsContainer) return;

        const currentGroupNames = new Set<string>();

        const totalGroups = boardLayout.taskGrids.length;

        for (let groupIdx = 0; groupIdx < totalGroups; groupIdx++) {
            const taskGrid = boardLayout.taskGrids[groupIdx];
            try {
                const groupName = taskGrid.group;
                currentGroupNames.add(groupName);

                const tasksInGroup = taskGrid.tasks as ITask[];
                const persistentState = this.appStateManager.getPersistentState();
                const validTasks = tasksInGroup.filter(task => {
                    const validation = validateTask(task);
                    if (!validation.isValid) return false;
                    return !isTaskHidden(task, persistentState.colorVariable, persistentState.currentProjectName, persistentState.colorMappings);
                });

                if (validTasks.length === 0) {
                    this.removeGroup(groupName);
                    currentGroupNames.delete(groupName);
                    continue;
                }

                // Compact y positions to eliminate gaps from hidden tasks
                const uniqueYs = [...new Set(validTasks.map(t => t.y ?? 0))].sort((a, b) => a - b);
                const yMap = new Map(uniqueYs.map((y, i) => [y, i]));
                for (const task of validTasks) {
                    task.y = yMap.get(task.y ?? 0) ?? 0;
                }

                const maxY = validTasks.reduce((max: number, task: ITask) => Math.max(max, task.y ?? -1), -1);
                const gridHeight = Math.max(1, maxY + 1);

                const gridConfig = {
                    gridWidth: boardLayout.columnHeaders.length,
                    gridHeight,
                    columnWidth,
                    rowHeight
                };

                const existingGroup = this.groupElements.get(groupName);
                if (existingGroup) {
                    const newGroupEl = BoardTaskGroup(groupName, validTasks, gridConfig, settings, this.appStateManager, this.app, this.isDebugMode, this.sharedTooltip, groupIdx, totalGroups);
                    existingGroup.replaceWith(newGroupEl);
                    this.groupElements.set(groupName, newGroupEl);
                } else {
                    const taskGroupEl = BoardTaskGroup(groupName, validTasks, gridConfig, settings, this.appStateManager, this.app, this.isDebugMode, this.sharedTooltip, groupIdx, totalGroups);
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
        }

        // Ensure DOM order matches the taskGrids order
        for (const taskGrid of boardLayout.taskGrids) {
            const groupName = taskGrid.group;
            const groupEl = this.groupElements.get(groupName);
            if (groupEl) {
                this.groupsContainer.appendChild(groupEl);
            }
        }

        // Remove stale groups
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
        this.appStateManager.getEvents().off(PluginEvent.UpdateLayoutDone, this.boundRenderBoard);
        this.appStateManager.getEvents().off(PluginEvent.UpdateBoardGroupingDone, this.boundDebouncedRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateColorMappingsDone, this.boundDebouncedRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateGroupOrderDone, this.boundDebouncedRender);

        if (this.zoomCleanup) {
            this.zoomCleanup();
            this.zoomCleanup = null;
        }

        if (this.panCleanup) {
            this.panCleanup();
            this.panCleanup = null;
        }

        if (this.scrollCleanup) {
            this.scrollCleanup();
            this.scrollCleanup = null;
        }

        this.groupElements.clear();
        this.timelineHeaderContainer = null;
        this.groupsContainer = null;

        if (this.sharedTooltip && this.sharedTooltip.parentNode) {
            this.sharedTooltip.parentNode.removeChild(this.sharedTooltip);
        }

        const legacyTooltips = document.querySelectorAll('.task-timeline-tooltip');
        legacyTooltips.forEach(tooltip => {
            if (tooltip !== this.sharedTooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
    }
}

// Helper: add fractional time units to a date
function addFractionalUnits(start: Date, fractionalUnits: number, timeUnit: TimeUnit): Date {
    const wholeUnits = Math.floor(fractionalUnits);
    const fraction = fractionalUnits - wholeUnits;

    const colStart = addTime(start, wholeUnits, timeUnit);
    const colEnd = addTime(start, wholeUnits + 1, timeUnit);

    return new Date(colStart.getTime() + fraction * (colEnd.getTime() - colStart.getTime()));
}

// Helper: compute fractional date difference in time units
function dateDiffInUnits(start: Date, target: Date, timeUnit: TimeUnit): number {
    if (timeUnit === TimeUnit.DAY) {
        return (target.getTime() - start.getTime()) / 86400000;
    } else if (timeUnit === TimeUnit.WEEK) {
        return (target.getTime() - start.getTime()) / 604800000;
    } else if (timeUnit === TimeUnit.MONTH) {
        const yearDiff = target.getFullYear() - start.getFullYear();
        const monthDiff = target.getMonth() - start.getMonth();
        const dayFraction = (target.getDate() - 1) / 30; // approximate
        return yearDiff * 12 + monthDiff + dayFraction;
    }
    return 0;
}
