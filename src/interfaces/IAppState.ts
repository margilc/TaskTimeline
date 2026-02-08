// src/interfaces/IAppState.ts
import { ITaskTimelineSettings } from './ITaskTimelineSettings';

export interface IPersistentState {
    settings?: ITaskTimelineSettings;
    // Navigation state
    currentProjectName?: string;
    lastOpenedDate?: string;
    // Color mapping state
    colorVariable?: string;
    colorMappings?: Record<string, Record<string, Record<string, string>>>;
    // View state
    currentTimeUnit?: string;
    // Timeline state
    currentDate?: string;
    // Board state
    boardGrouping?: {
        groupBy: string;
        availableGroups: string[];
    };
    // Row header ordering: project -> variable -> ordered levels
    groupingOrderings?: Record<string, Record<string, string[]>>;
    // Zoom level persistence
    zoomLevel?: { modeIndex: number; columnWidth: number };
    // Scroll position persistence (pan position on the timeline)
    scrollPosition?: { left: number; top: number };
}

export interface IZoomState {
    modeIndex: number;     // 0=day, 1=week, 2=month
    columnWidth: number;   // current pixel width (continuous)
}

export interface IDateBounds {
    earliest: string;      // ISO date of earliest task start
    latest: string;        // ISO date of latest task end
}

export interface IVolatileState {
    // Navigation data
    availableProjects?: string[];
    currentTasks?: any[];
    // Version counter for O(1) cache key generation
    tasksVersion?: number;
    boardLayout?: {
        columnHeaders: Array<{date: Date, label: string, index: number}>;
        taskGrids: Array<{group: string, tasks: any[]}>;
        gridWidth: number;
        gridHeight: number;
        timeUnit: string;
        viewport: {startDate: Date, endDate: Date};
    };
    // Zoom state
    zoomState?: IZoomState;
    // Auto-calculated date bounds from tasks
    dateBounds?: IDateBounds;
}

export interface IAppState {
    persistent: IPersistentState;
    volatile: IVolatileState;
}
