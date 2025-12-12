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
    // Row header ordering: project -> variable -> ordered levels
    groupingOrderings?: Record<string, Record<string, string[]>>;
    // Keep flexible for now
    [key: string]: any;
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
    activeFilters?: any;
    // Timeline data
    timelineViewport?: { localMinDate: string, localMaxDate: string };
    minimapData?: Array<{ date: string, count: number }>;
    // Snapped date boundaries for visual alignment
    globalMinDateSnapped?: string;
    globalMaxDateSnapped?: string;
    // Drag/Drop state
    dragState?: IDragState;
    resizeState?: IResizeState;
    // Keep flexible for now
    [key: string]: any;
}

export interface IAppState {
    persistent: IPersistentState;
    volatile: IVolatileState;
}

// Drag/Drop interfaces
export interface IDragState {
    isActive: boolean;
    taskId?: string;
    initialPosition?: { x: number, y: number };
    currentPosition?: { x: number, y: number };
    targetGrid?: { column: number, row: number, group: string };
}

export interface IResizeState {
    isActive: boolean;
    taskId?: string;
    resizeType?: 'start' | 'end';
    initialColumn?: number;
    targetColumn?: number;
}

export interface IDragOperation {
    taskId: string;
    sourcePosition: { column: number, row: number, group: string };
    targetPosition: { column: number, row: number, group: string };
    mousePosition: { x: number, y: number };
}

export interface IResizeOperation {
    taskId: string;
    resizeType: 'start' | 'end';
    initialColumn: number;
    targetColumn: number;
    mousePosition: { x: number, y: number };
}

export interface IGroupingReorder {
    projectId: string;
    variable: 'status' | 'priority' | 'category' | 'responsible';
    sourceIndex: number;
    targetIndex: number;
    orderedLevels: string[];
} 