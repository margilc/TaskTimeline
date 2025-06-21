import { TimeUnit } from "../../enums/TimeUnit";

export interface ITask {
    start: string;
    end?: string;
    [key: string]: any;
}

export function generateMinimapData(
    tasks: ITask[], 
    timeUnit: string, 
    globalMinDateSnapped: Date, 
    globalMaxDateSnapped: Date,
    globalMinDate: Date, 
    globalMaxDate: Date
): Array<{ date: string, count: number }> {
    
    if (!Array.isArray(tasks) || isNaN(globalMinDateSnapped.getTime()) || isNaN(globalMaxDateSnapped.getTime()) || 
        isNaN(globalMinDate.getTime()) || isNaN(globalMaxDate.getTime())) {
        return [];
    }
    
    if (globalMinDateSnapped > globalMaxDateSnapped) {
        return [];
    }
    
    const allPeriods = generateTimePeriods(globalMinDateSnapped, globalMaxDateSnapped, timeUnit);
    const taskCounts = new Map<string, number>();
    
    for (const task of tasks) {
        if (!task.start) continue;
        
        try {
            const taskStart = new Date(task.start);
            if (isNaN(taskStart.getTime())) continue;
            
            const taskEnd = task.end ? new Date(task.end) : taskStart;
            if (task.end && isNaN(taskEnd.getTime())) {
                taskEnd.setTime(taskStart.getTime());
            }
            
            const endOfGlobalMaxDate = new Date(globalMaxDate);
            endOfGlobalMaxDate.setUTCHours(23, 59, 59, 999);
            
            if (taskEnd < globalMinDate || taskStart > endOfGlobalMaxDate) continue;
            for (const periodKey of allPeriods) {
                const periodStart = new Date(periodKey + 'T00:00:00.000Z');
                const periodEnd = getTimePeriodEnd(periodStart, timeUnit);
                
                if (taskOverlapsPeriod(taskStart, taskEnd, periodStart, periodEnd)) {
                    taskCounts.set(periodKey, (taskCounts.get(periodKey) || 0) + 1);
                }
            }
        } catch (error) {
            continue;
        }
    }
    
    return allPeriods.map(periodKey => ({
        date: getTimePeriodMidpointWithinRange(periodKey, timeUnit, globalMinDateSnapped, globalMaxDateSnapped),
        count: taskCounts.get(periodKey) || 0
    }));
}

function generateTimePeriods(globalMinDate: Date, globalMaxDate: Date, timeUnit: string): string[] {
    const periods: string[] = [];
    let currentDate = new Date(globalMinDate);
    
    currentDate = normalizeToTimePeriodStart(currentDate, timeUnit);
    const normalizedMaxDate = normalizeToTimePeriodStart(globalMaxDate, timeUnit);
    
    while (currentDate <= normalizedMaxDate) {
        const periodKey = getTimePeriodKey(currentDate, timeUnit);
        periods.push(periodKey);
        
        const nextDate = advanceToNextPeriod(currentDate, timeUnit);
        
        if (nextDate <= currentDate || periods.length > 10000) {
            console.warn('generateTimePeriods: Breaking to prevent infinite loop');
            break;
        }
        
        currentDate = nextDate;
    }
    
    return periods;
}

function normalizeToTimePeriodStart(date: Date, timeUnit: string): Date {
    const normalized = new Date(date);
    
    switch (timeUnit) {
        case TimeUnit.DAY:
            normalized.setUTCHours(0, 0, 0, 0);
            break;
        case TimeUnit.WEEK:
            normalized.setUTCHours(0, 0, 0, 0);
            normalized.setUTCDate(date.getUTCDate() - date.getUTCDay());
            break;
        case TimeUnit.MONTH:
            normalized.setUTCHours(0, 0, 0, 0);
            normalized.setUTCDate(1);
            break;
        default:
            normalized.setUTCHours(0, 0, 0, 0);
    }
    
    return normalized;
}

function advanceToNextPeriod(date: Date, timeUnit: string): Date {
    const next = new Date(date);
    
    switch (timeUnit) {
        case TimeUnit.DAY:
            next.setUTCDate(date.getUTCDate() + 1);
            break;
        case TimeUnit.WEEK:
            next.setUTCDate(date.getUTCDate() + 7);
            break;
        case TimeUnit.MONTH:
            next.setUTCMonth(date.getUTCMonth() + 1);
            break;
        default:
            next.setUTCDate(date.getUTCDate() + 1);
    }
    
    return next;
}

function getTimePeriodKey(date: Date, timeUnit: string): string {
    const normalized = normalizeToTimePeriodStart(date, timeUnit);
    return normalized.toISOString().split('T')[0];
}

function getTimePeriodMidpointWithinRange(
    periodKey: string, 
    timeUnit: string, 
    globalMinDate: Date, 
    globalMaxDate: Date
): string {
    const periodStart = new Date(periodKey + 'T00:00:00.000Z');
    const periodEnd = getTimePeriodEnd(periodStart, timeUnit);
    
    const intersectionStart = new Date(Math.max(periodStart.getTime(), globalMinDate.getTime()));
    const intersectionEnd = new Date(Math.min(periodEnd.getTime(), globalMaxDate.getTime()));
    const midpointMs = intersectionStart.getTime() + (intersectionEnd.getTime() - intersectionStart.getTime()) / 2;
    return new Date(midpointMs).toISOString();
}

function taskOverlapsPeriod(taskStart: Date, taskEnd: Date, periodStart: Date, periodEnd: Date): boolean {
    return taskStart <= periodEnd && taskEnd >= periodStart;
}

function getTimePeriodEnd(periodStart: Date, timeUnit: string): Date {
    const periodEnd = new Date(periodStart);
    
    switch (timeUnit) {
        case TimeUnit.DAY:
            periodEnd.setUTCHours(23, 59, 59, 999);
            break;
        case TimeUnit.WEEK:
            periodEnd.setUTCDate(periodStart.getUTCDate() + 6);
            periodEnd.setUTCHours(23, 59, 59, 999);
            break;
        case TimeUnit.MONTH:
            periodEnd.setUTCMonth(periodStart.getUTCMonth() + 1);
            periodEnd.setUTCDate(0);
            periodEnd.setUTCHours(23, 59, 59, 999);
            break;
        default:
            periodEnd.setUTCHours(23, 59, 59, 999);
    }
    
    return periodEnd;
}