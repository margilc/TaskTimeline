import { App } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState, IResizeOperation } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { TimeUnit } from '../../enums/TimeUnit';
import { renameTaskFileForNewStartDate } from '../utils/fileRenameUtils';
import { updateTaskFrontmatter } from '../utils/frontmatterUtils';

export async function updateTaskResize(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    resizeOperation: IResizeOperation
): Promise<IAppState> {
    // Find the task to update
    const tasks = volatile.currentTasks || [];
    const task = tasks.find((t: ITask) => t.id === resizeOperation.taskId);
    
    if (!task || !task.filePath) {
        return { persistent, volatile };
    }
    
    // Check if it's a meaningful resize
    const isSameColumn = resizeOperation.initialColumn === resizeOperation.targetColumn;
    
    if (isSameColumn) {
        return { persistent, volatile };
    }
    
    
    try {
        // Calculate new dates based on resize operation
        const newDates = calculateResizedDates(task, resizeOperation, volatile);
        
        // Update task frontmatter using Obsidian's processFrontMatter API
        await updateTaskFrontmatter(app, task.filePath, {
            start: newDates.start,
            end: newDates.end
        });
        
        // Check if file needs to be renamed due to start date change
        const oldStartDate = task.start;
        const newStartDate = newDates.start;
        
        if (oldStartDate !== newStartDate) {
            await renameTaskFileForNewStartDate(app, task, newStartDate);
        }
        
        // Trigger task reload to reflect changes
        return { persistent, volatile };
        
    } catch (error) {
        return { persistent, volatile };
    }
}

function calculateResizedDates(
    task: ITask,
    resizeOperation: IResizeOperation,
    volatile: IVolatileState
): { start: string, end: string } {
    const boardLayout = volatile.boardLayout;
    if (!boardLayout || !boardLayout.columnHeaders) {
        throw new Error('Board layout not available for date calculation');
    }
    
    // Get current task dates
    const currentStart = new Date(task.start);
    const currentEnd = task.end ? new Date(task.end) : new Date(task.start);
    
    // Calculate new date for the resized edge
    const headerIndex = resizeOperation.targetColumn - 1; // Convert to 0-based index
    const columnHeader = boardLayout.columnHeaders[headerIndex];
    
    if (!columnHeader) {
        throw new Error(`Column header not found for column ${resizeOperation.targetColumn}`);
    }
    
    const targetDate = new Date(columnHeader.date);
    const timeUnit = boardLayout.timeUnit;
    
    let newStart: Date;
    let newEnd: Date;
    
    if (resizeOperation.resizeType === 'start') {
        // Resizing start edge - update start date, keep end date
        newStart = calculateDateForTimeUnit(targetDate, timeUnit, 'start');
        newEnd = currentEnd;
        
        // Ensure start is not after end
        if (newStart > newEnd) {
            newEnd = new Date(newStart);
        }
    } else {
        // Resizing end edge - keep start date, update end date
        newStart = currentStart;
        newEnd = calculateDateForTimeUnit(targetDate, timeUnit, 'end');
        
        // Ensure end is not before start
        if (newEnd < newStart) {
            newStart = new Date(newEnd);
        }
    }
    
    return {
        start: formatDateForFrontmatter(newStart),
        end: formatDateForFrontmatter(newEnd)
    };
}

function calculateDateForTimeUnit(date: Date, timeUnit: string, edge: 'start' | 'end'): Date {
    switch (timeUnit) {
        case TimeUnit.DAY:
            // For day units, normalize to start/end of day
            const dayDate = new Date(date);
            if (edge === 'start') {
                dayDate.setUTCHours(0, 0, 0, 0);
            } else {
                dayDate.setUTCHours(23, 59, 59, 999);
            }
            return dayDate;
            
        case TimeUnit.WEEK:
            const weekDate = new Date(date);
            const dayOfWeek = weekDate.getUTCDay();
            
            if (edge === 'start') {
                // Start of week (Monday)
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                weekDate.setUTCDate(weekDate.getUTCDate() - daysToMonday);
                weekDate.setUTCHours(0, 0, 0, 0);
            } else {
                // End of week (Sunday)
                const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                weekDate.setUTCDate(weekDate.getUTCDate() + daysToSunday);
                weekDate.setUTCHours(23, 59, 59, 999);
            }
            return weekDate;
            
        case TimeUnit.MONTH:
            if (edge === 'start') {
                // Start of month
                const monthStart = new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);
                monthStart.setUTCHours(0, 0, 0, 0);
                return monthStart;
            } else {
                // End of month (last day)
                const monthEnd = new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
                monthEnd.setUTCHours(23, 59, 59, 999);
                return monthEnd;
            }
            
        default:
            return new Date(date);
    }
}

function formatDateForFrontmatter(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
