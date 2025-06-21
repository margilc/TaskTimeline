import { TimeUnit } from '../../enums/TimeUnit';
import { ITask } from '../../interfaces/ITask';

/**
 * Calculates the CSS grid column span for a task
 */
export function calculateColumnSpan(startColumn: number, endColumn: number): number {
    return Math.max(1, endColumn - startColumn + 1);
}

/**
 * Converts time unit to grid column increment
 */
export function getColumnIncrement(timeUnit: TimeUnit): number {
    switch (timeUnit) {
        case TimeUnit.DAY:
            return 1;
        case TimeUnit.WEEK:
            return 7;
        case TimeUnit.MONTH:
            return 30; // Approximation
        default:
            return 1;
    }
}

/**
 * Calculates grid dimensions needed for a set of tasks
 */
export function calculateGridDimensions(tasks: ITask[], columnCount: number): { width: number, height: number } {
    const maxRow = tasks.reduce((max, task) => Math.max(max, task.y ?? 0), 0);
    
    return {
        width: columnCount + 1, // +1 for row header column
        height: Math.max(1, maxRow + 1)
    };
}

/**
 * Checks if a task fits within the viewport columns
 */
export function isTaskInViewport(task: ITask, startColumn: number, endColumn: number): boolean {
    const taskStart = task.xStart ?? 1;
    const taskEnd = task.xEnd ?? taskStart;
    
    // Task overlaps with viewport if its range intersects with [startColumn, endColumn]
    return !(taskEnd < startColumn || taskStart > endColumn);
}

/**
 * Calculates the CSS Grid template columns string
 */
export function generateGridColumns(columnWidth: number, columnCount: number): string {
    return `${columnWidth}px repeat(${columnCount}, ${columnWidth}px)`;
}

/**
 * Calculates the CSS Grid template rows string
 */
export function generateGridRows(rowHeight: number, rowCount: number): string {
    if (rowHeight > 0) {
        return `repeat(${rowCount}, ${rowHeight}px)`;
    }
    return `repeat(${rowCount}, auto)`;
}

/**
 * Converts a 0-based row index to 1-based CSS grid row
 */
export function toGridRow(rowIndex: number): number {
    return rowIndex + 1;
}

/**
 * Converts a 1-based column index to CSS grid column (accounting for header)
 */
export function toGridColumn(columnIndex: number, hasRowHeader: boolean = true): number {
    return hasRowHeader ? columnIndex + 1 : columnIndex;
}

/**
 * Checks if two tasks would conflict in the grid
 */
export function tasksConflict(task1: ITask, task2: ITask): boolean {
    if (task1.y !== task2.y) return false; // Different rows
    
    const task1Start = task1.xStart ?? 1;
    const task1End = task1.xEnd ?? task1Start;
    const task2Start = task2.xStart ?? 1;
    const task2End = task2.xEnd ?? task2Start;
    
    // Check if ranges overlap
    return !(task1End < task2Start || task1Start > task2End);
}

/**
 * Gets the CSS class name for a time unit
 */
export function getTimeUnitClass(timeUnit: TimeUnit): string {
    return `time-unit-${timeUnit.toLowerCase()}`;
}

/**
 * Calculates optimal column width based on container width and column count
 */
export function calculateOptimalColumnWidth(
    containerWidth: number, 
    columnCount: number, 
    minColumnWidth: number = 100,
    maxColumnWidth: number = 300
): number {
    const headerWidth = 150; // Approximate width for row headers
    const availableWidth = containerWidth - headerWidth;
    const calculatedWidth = Math.floor(availableWidth / columnCount);
    
    return Math.min(maxColumnWidth, Math.max(minColumnWidth, calculatedWidth));
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}