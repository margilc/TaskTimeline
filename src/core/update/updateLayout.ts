import { App } from 'obsidian';
import { IAppState } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { TimeUnit } from '../../enums/TimeUnit';
import { addTime, formatDateByTimeUnit, formatWeekWithMonth, normalizeDate } from '../utils/dateUtils';
import { groupTasks } from '../utils/groupingUtils';

const layoutCache = new Map<string, any>();

export function clearLayoutCache(): void {
    layoutCache.clear();
}

export function updateLayout(app: App, currentState: IAppState): IAppState {
    const tasks = currentState.volatile.currentTasks || [];
    const zoomState = currentState.volatile.zoomState;
    const timeUnit = (currentState.persistent.currentTimeUnit as TimeUnit) || TimeUnit.DAY;
    const dateBounds = currentState.volatile.dateBounds;

    // No tasks = no layout
    if (!dateBounds || tasks.length === 0) {
        return {
            ...currentState,
            volatile: {
                ...currentState.volatile,
                boardLayout: undefined
            }
        };
    }

    const columnWidth = zoomState?.columnWidth || 100;

    // Snap date bounds to time unit boundaries
    const startDate = snapToUnitBoundary(new Date(dateBounds.earliest), timeUnit);
    const endDate = snapToUnitBoundary(new Date(dateBounds.latest), timeUnit);

    // Count total columns for the full date range
    const totalColumns = countDateUnits(startDate, endDate, timeUnit);

    const tasksVersion = currentState.volatile.tasksVersion || 0;
    const grouping = currentState.persistent.boardGrouping || { groupBy: 'none', availableGroups: [] };
    const cacheKey = generateCacheKey(tasksVersion, timeUnit, dateBounds.earliest, dateBounds.latest, grouping, totalColumns);

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

    const columnHeaders = generateColumnHeaders(startDate, endDate, timeUnit, totalColumns);
    const taskGrids = generateTaskGrids(tasks, grouping.groupBy, grouping.availableGroups, columnHeaders, timeUnit);

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

function generateCacheKey(tasksVersion: number, timeUnit: TimeUnit, earliest: string, latest: string, grouping: any, totalColumns: number): string {
    const groupingKey = grouping ? `${grouping.groupBy}:${grouping.availableGroups?.join(',')}` : 'none';
    return `v${tasksVersion}:${timeUnit}:${earliest}:${latest}:${groupingKey}:${totalColumns}`;
}

export function snapToUnitBoundary(date: Date, timeUnit: TimeUnit): Date {
    if (timeUnit === TimeUnit.MONTH) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    } else if (timeUnit === TimeUnit.WEEK) {
        return getWeekStart(date);
    } else {
        return normalizeDate(date);
    }
}

export function countDateUnits(start: Date, end: Date, timeUnit: TimeUnit): number {
    if (timeUnit === TimeUnit.DAY) {
        return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    } else if (timeUnit === TimeUnit.WEEK) {
        return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 604800000) + 1);
    } else if (timeUnit === TimeUnit.MONTH) {
        return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
    }
    return 1;
}

function generateColumnHeaders(startDate: Date, endDate: Date, timeUnit: TimeUnit, totalColumns: number): Array<{date: Date, label: string, index: number, isEmphasized: boolean, isToday: boolean}> {
    const headers: Array<{date: Date, label: string, index: number, isEmphasized: boolean, isToday: boolean}> = [];
    const today = normalizeDate(new Date());
    let currentDate = normalizeDate(startDate);

    for (let i = 0; i < totalColumns; i++) {
        const isEmphasized = isHeaderEmphasized(currentDate, timeUnit);
        const isToday = isHeaderToday(currentDate, today, timeUnit);
        let label: string;
        if (timeUnit === TimeUnit.WEEK && isEmphasized) {
            const weekStart = getWeekStart(currentDate);
            const weekEnd = addTime(weekStart, 6, TimeUnit.DAY);
            const currentMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
            const nextMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
            const monthToShow = (nextMonth1st >= weekStart && nextMonth1st <= weekEnd) ? nextMonth1st : currentMonth1st;
            label = formatWeekWithMonth(currentDate, monthToShow);
        } else {
            label = formatDateByTimeUnit(currentDate, timeUnit);
        }
        headers.push({
            date: new Date(currentDate),
            label,
            index: i + 1, // 1-based
            isEmphasized,
            isToday
        });

        if (i < totalColumns - 1) {
            currentDate = addTime(currentDate, 1, timeUnit);
        }
    }

    return headers;
}

function isHeaderEmphasized(date: Date, timeUnit: TimeUnit): boolean {
    if (timeUnit === TimeUnit.MONTH) {
        return date.getMonth() === 0;
    } else if (timeUnit === TimeUnit.WEEK) {
        const weekStart = getWeekStart(date);
        const weekEnd = addTime(weekStart, 6, TimeUnit.DAY);
        const currentMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
        const nextMonth1st = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
        return (currentMonth1st >= weekStart && currentMonth1st <= weekEnd) ||
               (nextMonth1st >= weekStart && nextMonth1st <= weekEnd);
    } else if (timeUnit === TimeUnit.DAY) {
        return date.getDay() === 1; // Monday
    }
    return false;
}

function isHeaderToday(date: Date, today: Date, timeUnit: TimeUnit): boolean {
    if (timeUnit === TimeUnit.DAY) {
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    } else if (timeUnit === TimeUnit.WEEK) {
        const weekStart = getWeekStart(date);
        const weekEnd = addTime(weekStart, 6, TimeUnit.DAY);
        return today >= weekStart && today <= weekEnd;
    } else if (timeUnit === TimeUnit.MONTH) {
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    }
    return false;
}

function generateTaskGrids(tasks: ITask[], groupBy: string, availableGroups: string[], columnHeaders: Array<{date: Date, label: string, index: number, isEmphasized: boolean}>, timeUnit: TimeUnit): Array<{group: string, tasks: ITask[]}> {
    const groupedTasks = groupTasks(tasks, groupBy);
    const taskGrids: Array<{group: string, tasks: ITask[]}> = [];

    for (const groupName of availableGroups) {
        const groupTaskList = groupedTasks[groupName];
        if (groupTaskList && groupTaskList.length > 0) {
            const positionedTasks = calculateTaskPositions(groupTaskList, columnHeaders, timeUnit);
            taskGrids.push({ group: groupName, tasks: positionedTasks });
        }
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

    const occupiedRows: Map<number, Set<number>> = new Map();
    const positionedTasks: ITask[] = [];

    for (const task of sortedTasks) {
        const position = findTaskPosition(task, columnHeaders, timeUnit);
        if (position) {
            const row = findAvailableRowOptimized(occupiedRows, position.xStart, position.xEnd);
            positionedTasks.push({ ...task, xStart: position.xStart, xEnd: position.xEnd, y: row });
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

function findTaskPosition(task: ITask, columnHeaders: Array<{date: Date, label: string, index: number, isEmphasized: boolean}>, timeUnit: TimeUnit): {xStart: number, xEnd: number} | null {
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

    return { xStart, xEnd };
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
        const columnMonthStart = new Date(Date.UTC(normalizedColumnDate.getUTCFullYear(), normalizedColumnDate.getUTCMonth(), 1));
        const columnMonthEnd = new Date(Date.UTC(normalizedColumnDate.getUTCFullYear(), normalizedColumnDate.getUTCMonth() + 1, 0));
        return !(normalizedTaskEnd < columnMonthStart || normalizedTaskStart > columnMonthEnd);
    }

    return false;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setUTCDate(diff));
}

function findAvailableRowOptimized(occupiedRows: Map<number, Set<number>>, xStart: number, xEnd: number): number {
    let row = 0;

    while (true) {
        const occupiedCols = occupiedRows.get(row);
        if (!occupiedCols) return row;

        let available = true;
        for (let col = xStart; col <= xEnd; col++) {
            if (occupiedCols.has(col)) {
                available = false;
                break;
            }
        }

        if (available) return row;
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
