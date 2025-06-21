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
    private debouncedRender: (...args: any[]) => void;

    constructor(app: App, appStateManager: AppStateManager, isDebugMode = false) {
        this.app = app;
        this.appStateManager = appStateManager;
        this.isDebugMode = isDebugMode;
        
        this.debouncedRender = debounce(() => this.renderBoard(), 250);
        
        this.element = document.createElement("div");
        this.element.classList.add("board-container");
        
        this.contentElement = document.createElement("div");
        this.contentElement.classList.add("board-content");
        this.element.appendChild(this.contentElement);
        
        this.appStateManager.getEvents().on(PluginEvent.UpdateLayoutDone, () => {
            this.renderBoard(); // Direct call instead of debounced
        });
        
        this.appStateManager.getEvents().on(PluginEvent.UpdateBoardGroupingDone, () => {
            this.debouncedRender();
        });
        
        this.appStateManager.getEvents().on(PluginEvent.UpdateColorMappingsDone, () => {
            this.debouncedRender();
        });
        
        this.appStateManager.getEvents().on(PluginEvent.UpdateTasksDone, () => {
            this.renderBoard(); // Direct call instead of debounced
        });
        
        this.renderBoard();
    }

    private renderBoard(): void {
        this.contentElement.innerHTML = "";
        
        try {
            const state = this.appStateManager.getState();
            const boardLayout = state.volatile.boardLayout;
            const currentTasks = state.volatile.currentTasks;
            
            if (!boardLayout) {
                const emptyState = createEmptyStateElement(
                    'Loading board layout...', 
                    'board-loading-state'
                );
                this.contentElement.appendChild(emptyState);
                return;
            }
            
            // Show loading state if tasks haven't been loaded yet (initialization phase)
            if (currentTasks === undefined) {
                const emptyState = createEmptyStateElement(
                    'Loading tasks...', 
                    'board-loading-state'
                );
                this.contentElement.appendChild(emptyState);
                return;
            }
            
            if (!boardLayout.columnHeaders || boardLayout.columnHeaders.length === 0) {
                const emptyState = createEmptyStateElement(
                    'No timeline columns available. Adjust your date range.', 
                    'board-no-columns-state'
                );
                this.contentElement.appendChild(emptyState);
                return;
            }
            
            const settings = state.persistent.settings || {};
            const columnWidth = settings.columnWidth || 200;
            const rowHeight = settings.rowHeight || 80;

        const timelineHeaderEl = BoardTimelineHeader(boardLayout, this.appStateManager, this.app, columnWidth, this.isDebugMode);
        this.contentElement.appendChild(timelineHeaderEl);

            
            if (!boardLayout.taskGrids || boardLayout.taskGrids.length === 0) {
                const emptyState = createEmptyStateElement(
                    'No tasks to display. Create some tasks to see them here!', 
                    'board-no-tasks-state'
                );
                this.contentElement.appendChild(emptyState);
                return;
            }

            boardLayout.taskGrids.forEach((taskGrid) => {
                try {
                    const tasksInGroup = taskGrid.tasks as ITask[];
                    
                    const validTasks = tasksInGroup.filter(task => {
                        const validation = validateTask(task);
                        if (!validation.isValid) {
                            console.warn(`Invalid task skipped: ${task.name} (priority: ${task.priority}, file: ${task.filePath})`, validation.errors);
                            return false;
                        }
                        return true;
                    });
                    
                    if (validTasks.length === 0) {
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
                    
                    const taskGroupEl = BoardTaskGroup(taskGrid.group, validTasks, gridConfig, settings, this.appStateManager, this.app, this.isDebugMode);
                    this.contentElement.appendChild(taskGroupEl);
                } catch (error) {
                    console.error(`Error rendering task group ${taskGrid.group}:`, error);
                    
                    const errorElement = createEmptyStateElement(
                        `Error loading group: ${taskGrid.group}`, 
                        'board-group-error-state'
                    );
                    this.contentElement.appendChild(errorElement);
                }
            });
        } catch (error) {
            console.error('Error rendering board:', error);
            
            const errorElement = createEmptyStateElement(
                'Error loading board. Please try refreshing.', 
                'board-error-state'
            );
            this.contentElement.appendChild(errorElement);
        }
    }

    public destroy(): void {
        // Clean up any tooltips created by task cards
        const allTooltips = document.querySelectorAll('.task-timeline-tooltip');
        allTooltips.forEach(tooltip => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
    }
}
