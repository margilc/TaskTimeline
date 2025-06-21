export interface ITask {
    name: string;
    start: string;
    end: string;
    category: string;
    status: string;
    filePath: string;
    content: string;
    priority: number;
    totalSubtasks: number;
    completedSubtasks: number;
    // Layout properties (added by layout business logic)
    xStart?: number;  // 1-based column start
    xEnd?: number;    // 1-based column end
    y?: number;        // 0-based row index
    group?: string;    // Grouping value
}