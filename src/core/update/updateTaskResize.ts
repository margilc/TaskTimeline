import { App, TFile } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState, IResizeOperation } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { TimeUnit } from '../../enums/TimeUnit';

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
        
        // Update task frontmatter
        await updateTaskResizeFrontmatter(app, task, newDates);
        
        
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
            return new Date(date);
            
        case TimeUnit.WEEK:
            const weekDate = new Date(date);
            const dayOfWeek = weekDate.getUTCDay();
            
            if (edge === 'start') {
                // Start of week (Monday)
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                weekDate.setUTCDate(weekDate.getUTCDate() - daysToMonday);
            } else {
                // End of week (Sunday)
                const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                weekDate.setUTCDate(weekDate.getUTCDate() + daysToSunday);
            }
            return weekDate;
            
        case TimeUnit.MONTH:
            if (edge === 'start') {
                // Start of month
                return new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);
            } else {
                // End of month
                return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
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

async function updateTaskResizeFrontmatter(
    app: App,
    task: ITask,
    newDates: { start: string, end: string }
): Promise<void> {
    const file = app.vault.getAbstractFileByPath(task.filePath);
    if (!file || !(file instanceof TFile)) {
        throw new Error(`File not found: ${task.filePath}`);
    }
    
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    
    // Find frontmatter boundaries
    let frontmatterStart = -1;
    let frontmatterEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            if (frontmatterStart === -1) {
                frontmatterStart = i;
            } else {
                frontmatterEnd = i;
                break;
            }
        }
    }
    
    if (frontmatterStart === -1 || frontmatterEnd === -1) {
        throw new Error('Task file does not have valid YAML frontmatter');
    }
    
    // Parse and update frontmatter
    const frontmatterLines = lines.slice(frontmatterStart + 1, frontmatterEnd);
    const updatedFrontmatter = updateResizeFrontmatterLines(frontmatterLines, newDates);
    
    // Reconstruct file content
    const newLines = [
        ...lines.slice(0, frontmatterStart + 1),
        ...updatedFrontmatter,
        ...lines.slice(frontmatterEnd)
    ];
    
    const newContent = newLines.join('\n');
    await app.vault.modify(file, newContent);
}

function updateResizeFrontmatterLines(
    frontmatterLines: string[],
    newDates: { start: string, end: string }
): string[] {
    const updated = [...frontmatterLines];
    
    // Update start date
    updateOrAddFrontmatterField(updated, 'start', newDates.start);
    
    // Update end date
    updateOrAddFrontmatterField(updated, 'end', newDates.end);
    
    return updated;
}

function updateOrAddFrontmatterField(lines: string[], field: string, value: string): void {
    // Find existing field
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fieldPattern = new RegExp(`^${field}:\\s*`);
        
        if (fieldPattern.test(line)) {
            // Update existing field
            lines[i] = `${field}: ${value}`;
            return;
        }
    }
    
    // Add new field if not found
    lines.push(`${field}: ${value}`);
}