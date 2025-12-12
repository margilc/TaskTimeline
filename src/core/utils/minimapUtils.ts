import { TimeUnit } from "../../enums/TimeUnit";

export interface ITask {
    start: string;
    end?: string;
    [key: string]: any;
}

// Optimized O(T + P) implementation using sweep-line / difference-array approach
// Instead of O(T × P) nested loops
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
    const periodCount = allPeriods.length;

    if (periodCount === 0) return [];

    // Build period start times for binary search
    const periodStartTimes: number[] = allPeriods.map(key =>
        new Date(key + 'T00:00:00.000Z').getTime()
    );

    // Build period end times
    const periodEndTimes: number[] = allPeriods.map(key => {
        const start = new Date(key + 'T00:00:00.000Z');
        return getTimePeriodEnd(start, timeUnit).getTime();
    });

    // Difference array: diff[i]++ when task starts overlapping period i
    //                   diff[j+1]-- when task stops overlapping after period j
    const diff = new Array(periodCount + 1).fill(0);

    const endOfGlobalMaxDate = new Date(globalMaxDate);
    endOfGlobalMaxDate.setUTCHours(23, 59, 59, 999);
    const endOfGlobalMaxDateMs = endOfGlobalMaxDate.getTime();
    const globalMinDateMs = globalMinDate.getTime();

    for (const task of tasks) {
        if (!task.start) continue;

        try {
            const taskStart = new Date(task.start);
            if (isNaN(taskStart.getTime())) continue;

            let taskEnd = task.end ? new Date(task.end) : taskStart;
            if (task.end && isNaN(taskEnd.getTime())) {
                taskEnd = taskStart;
            }

            const taskStartMs = taskStart.getTime();
            const taskEndMs = taskEnd.getTime();

            // Skip tasks entirely outside global range
            if (taskEndMs < globalMinDateMs || taskStartMs > endOfGlobalMaxDateMs) continue;

            // Binary search for first period that task overlaps
            // Task overlaps period i if: taskStart <= periodEnd[i] AND taskEnd >= periodStart[i]
            const startIdx = findFirstOverlappingPeriod(periodEndTimes, taskStartMs);
            const endIdx = findLastOverlappingPeriod(periodStartTimes, taskEndMs);

            if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
                diff[startIdx]++;
                diff[endIdx + 1]--;
            }
        } catch (error) {
            continue;
        }
    }

    // Prefix sum to get actual counts
    const counts: number[] = [];
    let runningCount = 0;
    for (let i = 0; i < periodCount; i++) {
        runningCount += diff[i];
        counts.push(runningCount);
    }

    return allPeriods.map((periodKey, i) => ({
        date: getTimePeriodMidpointWithinRange(periodKey, timeUnit, globalMinDateSnapped, globalMaxDateSnapped),
        count: counts[i]
    }));
}

// Binary search: Find first period where periodEnd >= taskStart
function findFirstOverlappingPeriod(periodEndTimes: number[], taskStartMs: number): number {
    let lo = 0;
    let hi = periodEndTimes.length - 1;
    let result = -1;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (periodEndTimes[mid] >= taskStartMs) {
            result = mid;
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }

    return result;
}

// Binary search: Find last period where periodStart <= taskEnd
function findLastOverlappingPeriod(periodStartTimes: number[], taskEndMs: number): number {
    let lo = 0;
    let hi = periodStartTimes.length - 1;
    let result = -1;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (periodStartTimes[mid] <= taskEndMs) {
            result = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return result;
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