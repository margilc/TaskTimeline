import { App } from 'obsidian';
import { IAppState } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { TimeUnit } from '../../enums/TimeUnit';
import { addTime, formatDateByTimeUnit, formatWeekWithMonth, normalizeDate, diffMonths } from '../utils/dateUtils';
import { groupTasks } from '../utils/groupingUtils';

const layoutCache = new Map<string, any>();

export function clearLayoutCache(): void {
    layoutCache.clear();
}


export function updateLayout(app: App, currentState: IAppState): IAppState {
    const tasks = currentState.volatile.currentTasks || [];
    const timeUnit = (currentState.persistent.currentTimeUnit as TimeUnit) || TimeUnit.DAY;
    const currentDateStr = currentState.persistent.currentDate;
    const currentDate = currentDateStr ? new Date(currentDateStr) : new Date();
    const numberOfColumns = currentState.persistent.settings?.numberOfColumns || 7;
    
    const timelineViewport = currentState.volatile.timelineViewport;
    let startDate: Date;
    let endDate: Date;
    
    if (timelineViewport) {
        // Use the snapped viewport start date, but calculate end based on numberOfColumns
        startDate = new Date(timelineViewport.localMinDate);
        endDate = addTime(startDate, numberOfColumns - 1, timeUnit);
        endDate = normalizeDate(endDate);
    } else {
        // Fallback to original logic if no viewport
        const viewportCenter = currentDate;
        const pastUnits = Math.floor((numberOfColumns - 1) / 2);
        const futureUnits = numberOfColumns - 1 - pastUnits;
        
        if (timeUnit === TimeUnit.DAY) {
            startDate = normalizeDate(addTime(viewportCenter, -pastUnits, TimeUnit.DAY));
            endDate = normalizeDate(addTime(viewportCenter, futureUnits, TimeUnit.DAY));
        } else if (timeUnit === TimeUnit.WEEK) {
            startDate = normalizeDate(addTime(viewportCenter, -pastUnits, TimeUnit.WEEK));
            endDate = normalizeDate(addTime(viewportCenter, futureUnits, TimeUnit.WEEK));
        } else if (timeUnit === TimeUnit.MONTH) {
            startDate = normalizeDate(addTime(viewportCenter, -pastUnits, TimeUnit.MONTH));
            endDate = normalizeDate(addTime(viewportCenter, futureUnits, TimeUnit.MONTH));
        } else {
            startDate = normalizeDate(addTime(viewportCenter, -pastUnits, TimeUnit.DAY));
            endDate = normalizeDate(addTime(viewportCenter, futureUnits, TimeUnit.DAY));
        }
    }
    
    const cacheKey = generateCacheKey(tasks, timeUnit, currentDateStr, currentState.volatile.timelineViewport, currentState.persistent.boardGrouping, numberOfColumns);
    
    if (layoutCache.has(cacheKey)) {
        const cached = layoutCache.get(cacheKey);
        return {
            ...currentState,
            volatile: {
                ...currentState.volatile,
                boardLayout: cached
            }
        };
    }
    
    const columnHeaders = generateColumnHeaders(startDate, endDate, timeUnit, numberOfColumns);
    
    const grouping = currentState.persistent.boardGrouping || { groupBy: 'none', availableGroups: [] };
    const taskGrids = generateTaskGrids(tasks, grouping.groupBy, columnHeaders, timeUnit);
    
    const gridWidth = columnHeaders.length + 1;
    const gridHeight = Math.max(...taskGrids.map(grid => grid.tasks.length), 1);
    
    const result = {
        columnHeaders,
        taskGrids,
        gridWidth,
        gridHeight,
        timeUnit,
        viewport: { startDate, endDate }
    };
    
    if (layoutCache.size > 10) {
        const firstKey = layoutCache.keys().next().value;
        layoutCache.delete(firstKey);
    }
    layoutCache.set(cacheKey, result);
    
    return {
        ...currentState,
        volatile: {
            ...currentState.volatile,
            boardLayout: result
        }
    };
}

function generateCacheKey(tasks: ITask[], timeUnit: TimeUnit, currentDateStr: string | undefined, viewport: any, grouping: any, numberOfColumns: number): string {
    const taskKey = tasks.map(t => `${t.filePath}:${t.start}:${t.end}`).join(',');
    const viewportKey = viewport ? `${viewport.localMinDate}:${viewport.localMaxDate}` : 'default';
    const groupingKey = grouping ? `${grouping.groupBy}:${grouping.availableGroups?.join(',')}` : 'none';
    return `${taskKey}:${timeUnit}:${currentDateStr}:${viewportKey}:${groupingKey}:${numberOfColumns}`;
}

function generateColumnHeaders(startDate: Date, endDate: Date, timeUnit: TimeUnit, targetColumns?: number): Array<{date: Date, label: string, index: number, isEmphasized: boolean}> {
    const headers: Array<{date: Date, label: string, index: number, isEmphasized: boolean}> = [];
    let currentDate = normalizeDate(startDate);
    let index = 1;
    
    if (targetColumns && targetColumns > 0) {
        for (let i = 0; i < targetColumns; i++) {
            const isEmphasized = isHeaderEmphasized(currentDate, timeUnit);
            let label: string;
            if (timeUnit === TimeUnit.WEEK && isEmphasized) {
                // Find which month is starting in this week
                const weekStart = getWeekStart(currentDate);
                const weekEnd = addTime(weekStart, 6, TimeUnit.DAY);
                const currentMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
                const nextMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
                
                // Use the month that has its 1st day in this week
                const monthToShow = (nextMonth1st >= weekStart && nextMonth1st <= weekEnd) ? nextMonth1st : currentMonth1st;
                label = formatWeekWithMonth(currentDate, monthToShow);
            } else {
                label = formatDateByTimeUnit(currentDate, timeUnit);
            }
            headers.push({
                date: new Date(currentDate),
                label,
                index,
                isEmphasized
            });
            
            if (i < targetColumns - 1) {
                currentDate = addTime(currentDate, 1, timeUnit);
                index++;
            }
        }
    } else {
        while (currentDate <= endDate) {
            const isEmphasized = isHeaderEmphasized(currentDate, timeUnit);
            let label: string;
            if (timeUnit === TimeUnit.WEEK && isEmphasized) {
                // Find which month is starting in this week
                const weekStart = getWeekStart(currentDate);
                const weekEnd = addTime(weekStart, 6, TimeUnit.DAY);
                const currentMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
                const nextMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
                
                // Use the month that has its 1st day in this week
                const monthToShow = (nextMonth1st >= weekStart && nextMonth1st <= weekEnd) ? nextMonth1st : currentMonth1st;
                label = formatWeekWithMonth(currentDate, monthToShow);
            } else {
                label = formatDateByTimeUnit(currentDate, timeUnit);
            }
            headers.push({
                date: new Date(currentDate),
                label,
                index,
                isEmphasized
            });
            
            currentDate = addTime(currentDate, 1, timeUnit);
            index++;
        }
    }
    
    return headers;
}

function isHeaderEmphasized(date: Date, timeUnit: TimeUnit): boolean {
    if (timeUnit === TimeUnit.MONTH) {
        // Emphasize January
        return date.getMonth() === 0;
    } else if (timeUnit === TimeUnit.WEEK) {
        // Emphasize weeks that contain the first day of any month
        const weekStart = getWeekStart(date);
        const weekEnd = addTime(weekStart, 6, TimeUnit.DAY);
        
        // Check if the 1st of the current or next month falls within this week
        const currentMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
        const nextMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
        
        const currentMonthInWeek = currentMonth1st >= weekStart && currentMonth1st <= weekEnd;
        const nextMonthInWeek = nextMonth1st >= weekStart && nextMonth1st <= weekEnd;
        
        return currentMonthInWeek || nextMonthInWeek;
    } else if (timeUnit === TimeUnit.DAY) {
        // Emphasize all Mondays
        const dayOfWeek = date.getDay();
        return dayOfWeek === 1;
    }
    
    return false;
}

function generateTaskGrids(tasks: ITask[], groupBy: string, columnHeaders: Array<{date: Date, label: string, index: number, isEmphasized: boolean}>, timeUnit: TimeUnit): Array<{group: string, tasks: ITask[]}> {
    const groupedTasks = groupTasks(tasks, groupBy);
    const taskGrids: Array<{group: string, tasks: ITask[]}> = [];
    
    for (const [groupName, groupTasks] of Object.entries(groupedTasks)) {
        const positionedTasks = calculateTaskPositions(groupTasks, columnHeaders, timeUnit);
        taskGrids.push({ group: groupName, tasks: positionedTasks });
    }
    
    return taskGrids;
}

function calculateTaskPositions(tasks: ITask[], columnHeaders: Array<{date: Date, label: string, index: number, isEmphasized: boolean}>, timeUnit: TimeUnit): ITask[] {
    if (tasks.length === 0) return [];
    
    const sortedTasks = [...tasks].sort((a, b) => {
        const aDuration = getDuration(a);
        const bDuration = getDuration(b);
        
        if (aDuration !== bDuration) return bDuration - aDuration;
        if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0);
        return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
    
    // Use optimized data structures for collision detection
    const occupiedRows: Map<number, Set<number>> = new Map();
    const positionedTasks: ITask[] = [];
    
    for (const task of sortedTasks) {
        const position = findTaskPosition(task, columnHeaders, [], timeUnit);
        if (position) {
            const row = findAvailableRowOptimized(occupiedRows, position.xStart, position.xEnd);
            const finalPosition = { ...position, y: row };
            
            positionedTasks.push({ ...task, ...finalPosition });
            markOccupiedOptimized(occupiedRows, position.xStart, position.xEnd, row);
        }
    }
    
    return positionedTasks;
}

function getDuration(task: ITask): number {
    if (!task.end) return 1;
    const start = new Date(task.start);
    const end = new Date(task.end);
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function findTaskPosition(task: ITask, columnHeaders: Array<{date: Date, label: string, index: number, isEmphasized: boolean}>, occupiedRows: Array<Array<boolean>>, timeUnit: TimeUnit): {xStart: number, xEnd: number, y: number} | null {
    const taskStart = new Date(task.start);
    const taskEnd = task.end ? new Date(task.end) : taskStart;
    
    let xStart = -1;
    let xEnd = -1;
    
    for (const header of columnHeaders) {
        if (isTaskInColumn(taskStart, taskEnd, header.date, timeUnit)) {
            if (xStart === -1) xStart = header.index;
            xEnd = header.index;
        }
    }
    
    if (xStart === -1) return null;
    
    const y = findAvailableRow(occupiedRows, xStart, xEnd);
    
    return { xStart, xEnd, y };
}

function isTaskInColumn(taskStart: Date, taskEnd: Date, columnDate: Date, timeUnit: TimeUnit): boolean {
    const normalizedTaskStart = normalizeDate(taskStart);
    const normalizedTaskEnd = normalizeDate(taskEnd);
    const normalizedColumnDate = normalizeDate(columnDate);
    
    if (timeUnit === TimeUnit.DAY) {
        return normalizedColumnDate >= normalizedTaskStart && normalizedColumnDate <= normalizedTaskEnd;
    } else if (timeUnit === TimeUnit.WEEK) {
        const columnWeekStart = getWeekStart(normalizedColumnDate);
        const columnWeekEnd = addTime(columnWeekStart, 6, TimeUnit.DAY);
        
        return !(normalizedTaskEnd < columnWeekStart || normalizedTaskStart > columnWeekEnd);
    } else if (timeUnit === TimeUnit.MONTH) {
        const columnMonthStart = new Date(normalizedColumnDate.getFullYear(), normalizedColumnDate.getMonth(), 1);
        const columnMonthEnd = new Date(normalizedColumnDate.getFullYear(), normalizedColumnDate.getMonth() + 1, 0);
        
        return !(normalizedTaskEnd < columnMonthStart || normalizedTaskStart > columnMonthEnd);
    }
    
    return false;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function findAvailableRow(occupiedRows: Array<Array<boolean>>, xStart: number, xEnd: number): number {
    for (let row = 0; row < occupiedRows.length; row++) {
        if (isRowAvailable(occupiedRows[row], xStart, xEnd)) {
            return row;
        }
    }
    
    return occupiedRows.length;
}

function isRowAvailable(row: Array<boolean>, xStart: number, xEnd: number): boolean {
    if (!row) return true;
    
    for (let col = xStart; col <= xEnd; col++) {
        if (row[col]) return false;
    }
    
    return true;
}

function markOccupied(occupiedRows: Array<Array<boolean>>, xStart: number, xEnd: number, y: number): void {
    while (occupiedRows.length <= y) {
        occupiedRows.push([]);
    }
    
    for (let col = xStart; col <= xEnd; col++) {
        occupiedRows[y][col] = true;
    }
}


function findAvailableRowOptimized(occupiedRows: Map<number, Set<number>>, xStart: number, xEnd: number): number {
    let row = 0;
    
    while (true) {
        const occupiedCols = occupiedRows.get(row);
        if (!occupiedCols) {
            return row;
        }
        
        let available = true;
        for (let col = xStart; col <= xEnd; col++) {
            if (occupiedCols.has(col)) {
                available = false;
                break;
            }
        }
        
        if (available) {
            return row;
        }
        
        row++;
    }
}

function markOccupiedOptimized(occupiedRows: Map<number, Set<number>>, xStart: number, xEnd: number, y: number): void {
    if (!occupiedRows.has(y)) {
        occupiedRows.set(y, new Set());
    }
    
    const row = occupiedRows.get(y)!;
    for (let col = xStart; col <= xEnd; col++) {
        row.add(col);
    }
}

