import { TimeUnit } from "../../enums/TimeUnit";

export function calculateDefaultViewport(currentDate: string, timeUnit: string, numberOfColumns: number = 7): { localMinDate: string, localMaxDate: string } {
    const date = new Date(currentDate);
    
    // Calculate past/future distribution based on numberOfColumns
    const pastUnits = Math.floor((numberOfColumns - 1) / 2);
    const futureUnits = numberOfColumns - 1 - pastUnits;
    
    switch (timeUnit) {
        case TimeUnit.DAY: {
            const minDate = new Date(date);
            minDate.setDate(date.getDate() - pastUnits);
            const maxDate = new Date(date);
            maxDate.setDate(date.getDate() + futureUnits);
            return {
                localMinDate: minDate.toISOString(),
                localMaxDate: maxDate.toISOString()
            };
        }
        case TimeUnit.WEEK: {
            const minDate = new Date(date);
            minDate.setDate(date.getDate() - (pastUnits * 7));
            const maxDate = new Date(date);
            maxDate.setDate(date.getDate() + (futureUnits * 7));
            return {
                localMinDate: minDate.toISOString(),
                localMaxDate: maxDate.toISOString()
            };
        }
        case TimeUnit.MONTH: {
            const minDate = new Date(date);
            minDate.setMonth(date.getMonth() - pastUnits);
            const maxDate = new Date(date);
            maxDate.setMonth(date.getMonth() + futureUnits);
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

export function generateTimeMarkers(minDate: string, maxDate: string, timeUnit: string): string[] {
    const globalMinDate = new Date(minDate);
    const globalMaxDate = new Date(maxDate);
    
    const periods = generateTimePeriods(globalMinDate, globalMaxDate, timeUnit);
    
    return periods.map(periodKey => {
        return periodKey + 'T00:00:00.000Z';
    });
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