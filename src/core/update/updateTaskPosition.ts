import { App } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState, IDragOperation } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { TimeUnit } from '../../enums/TimeUnit';
import { renameTaskFileForNewStartDate } from '../utils/fileRenameUtils';
import { updateTaskFrontmatter } from '../utils/frontmatterUtils';

function findPositionedTask(taskId: string, volatile: IVolatileState): any | null {
    if (!volatile.boardLayout?.taskGrids) {
        return null;
    }
    
    for (const taskGrid of volatile.boardLayout.taskGrids) {
        const task = taskGrid.tasks.find(t => t.id === taskId);
        if (task) {
            return task;
        }
    }
    return null;
}

export async function updateTaskPosition(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    dragOperation: IDragOperation
): Promise<IAppState> {
    // Find the task to update
    const tasks = volatile.currentTasks || [];
    const task = tasks.find((t: ITask) => t.id === dragOperation.taskId);
    
    if (!task || !task.filePath) {
        return { persistent, volatile };
    }
    
    // Check if it's a meaningful move
    const isSamePosition = 
        dragOperation.sourcePosition.column === dragOperation.targetPosition.column &&
        dragOperation.sourcePosition.row === dragOperation.targetPosition.row &&
        dragOperation.sourcePosition.group === dragOperation.targetPosition.group;
    
    if (isSamePosition) {
        return { persistent, volatile };
    }
    
    
    try {
        // Get original task span from positioned task
        const originalTask = findPositionedTask(task.id, volatile);
        const originalSpan = originalTask ? (originalTask.xEnd - originalTask.xStart + 1) : 1;
        
        // Calculate new dates based on target column, preserving original span
        const newDates = calculateNewDates(dragOperation.targetPosition.column, volatile, originalSpan);
        
        // Determine new grouping variable value
        const newGroupingValue = dragOperation.targetPosition.group;
        
        // Update task frontmatter using Obsidian's processFrontMatter API
        const groupBy = persistent.boardGrouping?.groupBy;
        const updates: Record<string, string | undefined> = {
            start: newDates.start,
            end: newDates.end
        };
        // Only update grouping variable if it's a valid grouping field
        if (groupBy && groupBy !== 'none') {
            updates[groupBy] = newGroupingValue;
        }
        await updateTaskFrontmatter(app, task.filePath, updates);
        
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

function calculateNewDates(targetColumn: number, volatile: IVolatileState, spanColumns: number = 1): { start: string, end?: string } {
    const boardLayout = volatile.boardLayout;
    if (!boardLayout || !boardLayout.columnHeaders) {
        throw new Error('Board layout not available for date calculation');
    }
    
    // Find the column header for the target column (accounting for group header column)
    const headerIndex = targetColumn - 1; // Convert to 0-based index
    const columnHeader = boardLayout.columnHeaders[headerIndex];
    
    if (!columnHeader) {
        throw new Error(`Column header not found for column ${targetColumn}`);
    }
    
    const targetDate = columnHeader.date;
    const timeUnit = boardLayout.timeUnit;
    
    // Calculate start and end dates based on target column and span
    let startDate: Date;
    let endDate: Date;
    
    // Start date is always based on the target column
    startDate = new Date(targetDate);
    
    // End date depends on the span and time unit
    if (spanColumns === 1) {
        // Single column task - use same date for start and end
        endDate = new Date(targetDate);
    } else {
        // Multi-column task - calculate end date based on span
        const endColumnIndex = (targetColumn - 1) + (spanColumns - 1);
        const endColumnHeader = boardLayout.columnHeaders[endColumnIndex];
        
        if (endColumnHeader) {
            endDate = new Date(endColumnHeader.date);
        } else {
            // Fallback if end column doesn't exist - add days based on time unit
            endDate = new Date(targetDate);
            switch (timeUnit) {
                case TimeUnit.DAY:
                    endDate.setUTCDate(endDate.getUTCDate() + (spanColumns - 1));
                    break;
                case TimeUnit.WEEK:
                    endDate.setUTCDate(endDate.getUTCDate() + (spanColumns - 1) * 7);
                    break;
                case TimeUnit.MONTH:
                    endDate.setUTCMonth(endDate.getUTCMonth() + (spanColumns - 1));
                    break;
            }
        }
    }
    
    return {
        start: formatDateForFrontmatter(startDate),
        end: formatDateForFrontmatter(endDate)
    };
}

function formatDateForFrontmatter(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
