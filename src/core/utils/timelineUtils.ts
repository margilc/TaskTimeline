import { TimeUnit } from "../../enums/TimeUnit";

export function calculateDefaultViewport(currentDate: string, timeUnit: string, numberOfColumns: number = 7): { localMinDate: string, localMaxDate: string } {
    const date = new Date(currentDate);
    
    // First, snap the current date to the appropriate snapping point
    let snappedDate: Date;
    
    if (timeUnit === TimeUnit.DAY || timeUnit === TimeUnit.WEEK) {
        // Snap to Monday (earlier snapping point)
        snappedDate = new Date(date);
        snappedDate.setUTCHours(0, 0, 0, 0);
        const dayOfWeek = snappedDate.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        snappedDate.setUTCDate(snappedDate.getUTCDate() - daysToMonday);
    } else {
        // For MONTH view, snap to 1st of month (earlier snapping point)
        snappedDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);
        snappedDate.setUTCHours(0, 0, 0, 0);
    }
    
    // Now calculate viewport starting from the snapped date
    let minDate: Date;
    let maxDate: Date;
    
    switch (timeUnit) {
        case TimeUnit.DAY: {
            minDate = new Date(snappedDate);
            maxDate = new Date(snappedDate);
            maxDate.setUTCDate(snappedDate.getUTCDate() + numberOfColumns - 1);
            return {
                localMinDate: minDate.toISOString(),
                localMaxDate: maxDate.toISOString()
            };
        }
        case TimeUnit.WEEK: {
            minDate = new Date(snappedDate);
            maxDate = new Date(snappedDate);
            maxDate.setUTCDate(snappedDate.getUTCDate() + numberOfColumns * 7 - 1);
            return {
                localMinDate: minDate.toISOString(),
                localMaxDate: maxDate.toISOString()
            };
        }
        case TimeUnit.MONTH: {
            minDate = new Date(snappedDate);
            maxDate = new Date(snappedDate);
            maxDate.setUTCMonth(snappedDate.getUTCMonth() + numberOfColumns);
            maxDate.setUTCDate(0); // Last day of previous month
            maxDate.setUTCHours(23, 59, 59, 999); // End of day
            return {
                localMinDate: minDate.toISOString(),
                localMaxDate: maxDate.toISOString()
            };
        }
        default:
            return calculateDefaultViewport(currentDate, TimeUnit.DAY, numberOfColumns);
    }
}


export function validateDateRange(minDate: string, maxDate: string): boolean {
    try {
        const min = new Date(minDate);
        const max = new Date(maxDate);
        return !isNaN(min.getTime()) && !isNaN(max.getTime()) && min < max;
    } catch {
        return false;
    }
}

export function clampToDateRange(date: string, minDate: string, maxDate: string): string {
    const target = new Date(date);
    const min = new Date(minDate);
    const max = new Date(maxDate);
    
    if (target < min) return min.toISOString();
    if (target > max) return max.toISOString();
    return date;
}

export function snapViewportToTimeUnit(viewport: {localMinDate: string, localMaxDate: string}, timeUnit: string, numberOfColumns?: number): {localMinDate: string, localMaxDate: string} {
    const minDate = new Date(viewport.localMinDate);
    
    let snappedMin: Date;
    let snappedMax: Date;
    
    if (timeUnit === TimeUnit.DAY || timeUnit === TimeUnit.WEEK) {
        // Snap start date to Monday
        snappedMin = new Date(minDate);
        snappedMin.setUTCHours(0, 0, 0, 0);
        const dayOfWeekMin = snappedMin.getUTCDay();
        const daysToMondayMin = dayOfWeekMin === 0 ? 6 : dayOfWeekMin - 1;
        snappedMin.setUTCDate(snappedMin.getUTCDate() - daysToMondayMin);
        
        // Calculate max as numberOfColumns time units from snapped start
        if (numberOfColumns) {
            snappedMax = new Date(snappedMin);
            if (timeUnit === TimeUnit.DAY) {
                // For days: span numberOfColumns days
                snappedMax.setUTCDate(snappedMin.getUTCDate() + numberOfColumns - 1);
            } else { // WEEK
                // For weeks: span numberOfColumns weeks, so go to end of last week
                snappedMax.setUTCDate(snappedMin.getUTCDate() + numberOfColumns * 7 - 1);
            }
        } else {
            // Fallback: preserve original duration
            const maxDate = new Date(viewport.localMaxDate);
            const originalDurationMs = maxDate.getTime() - minDate.getTime();
            snappedMax = new Date(snappedMin.getTime() + originalDurationMs);
        }
    } else {
        // For MONTH view, snap start to 1st of month
        snappedMin = normalizeToTimePeriodStart(minDate, timeUnit);
        
        if (numberOfColumns) {
            snappedMax = new Date(snappedMin);
            // Go to the month after the last month, then get last day of previous month
            snappedMax.setUTCMonth(snappedMin.getUTCMonth() + numberOfColumns);
            snappedMax.setUTCDate(0); // Last day of previous month
            snappedMax.setUTCHours(23, 59, 59, 999); // End of day
        } else {
            // Fallback
            const maxDate = new Date(viewport.localMaxDate);
            snappedMax = normalizeToTimePeriodStart(maxDate, timeUnit);
        }
    }
    
    return {
        localMinDate: snappedMin.toISOString(),
        localMaxDate: snappedMax.toISOString()
    };
}

export function generateTimeMarkers(minDate: string, maxDate: string, timeUnit: string): string[] {
    const globalMinDate = new Date(minDate);
    const globalMaxDate = new Date(maxDate);
    
    const periods = generateTimePeriods(globalMinDate, globalMaxDate, timeUnit);
    
    return periods.map(periodKey => {
        return periodKey + 'T00:00:00.000Z';
    });
}

export function generateTimeMarkersWithMetadata(minDate: string, maxDate: string, timeUnit: string): Array<{date: string, type: 'normal' | 'emphasized'}> {
    const globalMinDate = new Date(minDate);
    const globalMaxDate = new Date(maxDate);
    
    if (timeUnit === TimeUnit.MONTH) {
        const periods = generateTimePeriods(globalMinDate, globalMaxDate, timeUnit);
        return periods.map(periodKey => {
            const date = new Date(periodKey + 'T00:00:00.000Z');
            const isJanuary = date.getUTCMonth() === 0;
            return {
                date: periodKey + 'T00:00:00.000Z',
                type: isJanuary ? 'emphasized' : 'normal'
            };
        });
    } else {
        // For WEEK and DAY views, show only Monday ticks
        const periods: Array<{date: string, type: 'normal' | 'emphasized'}> = [];
        let currentDate = new Date(globalMinDate);
        
        // Snap to first Monday
        const dayOfWeek = currentDate.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentDate.setUTCDate(currentDate.getUTCDate() - daysToMonday);
        currentDate.setUTCHours(0, 0, 0, 0);
        
        const normalizedMaxDate = new Date(globalMaxDate);
        
        while (currentDate <= normalizedMaxDate) {
            // Check if this Monday starts a month (first week of month contains 1st)
            const monthStart = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
            const isMonthStartWeek = currentDate.getUTCDate() <= 7;
            
            periods.push({
                date: currentDate.toISOString(),
                type: isMonthStartWeek ? 'emphasized' : 'normal'
            });
            
            // Move to next Monday
            currentDate.setUTCDate(currentDate.getUTCDate() + 7);
        }
        
        return periods;
    }
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
            // Snap to Monday (1 = Monday, 0 = Sunday)
            const dayOfWeek = date.getUTCDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            normalized.setUTCDate(date.getUTCDate() - daysToMonday);
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
    return normalized.toISOString().split('T')[0]; // YYYY-MM-DD format
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