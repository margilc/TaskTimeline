// src/interfaces/IAppState.ts
export interface IPersistentState {
    // Settings from the existing interface
    settings?: any;
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
    // Keep flexible for now
    [key: string]: any;
}

export interface IVolatileState {
    // Navigation data
    availableProjects?: string[];
    currentTasks?: any[];
    boardLayout?: {
        columnHeaders: Array<{date: Date, label: string, index: number}>;
        taskGrids: Array<{group: string, tasks: any[]}>;
        gridWidth: number;
        gridHeight: number;
        timeUnit: string;
        viewport: {startDate: Date, endDate: Date};
    };
    activeFilters?: any;
    // Timeline data
    timelineViewport?: { localMinDate: string, localMaxDate: string };
    minimapData?: Array<{ date: string, count: number }>;
    // Snapped date boundaries for visual alignment
    globalMinDateSnapped?: string;
    globalMaxDateSnapped?: string;
    // Keep flexible for now
    [key: string]: any;
}

export interface IAppState {
    persistent: IPersistentState;
    volatile: IVolatileState;
} 