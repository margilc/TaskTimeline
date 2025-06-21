import { IPersistentState, IVolatileState } from '../../interfaces/IAppState';

export function validateDateString(dateStr: string, fieldName: string): void {
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid ${fieldName} format: ${dateStr}`);
    }
}

export function validateDateRange(minDate: string, maxDate: string): void {
    validateDateString(minDate, 'minDate');
    validateDateString(maxDate, 'maxDate');
    
    if (new Date(minDate) >= new Date(maxDate)) {
        throw new Error(`minDate must be before maxDate: ${minDate} >= ${maxDate}`);
    }
}

export function createStateResult(
    persistent: IPersistentState, 
    volatile: IVolatileState, 
    persistentUpdates?: Partial<IPersistentState>, 
    volatileUpdates?: Partial<IVolatileState>
): {persistent: IPersistentState, volatile: IVolatileState} {
    return {
        persistent: persistentUpdates ? { ...persistent, ...persistentUpdates } : persistent,
        volatile: volatileUpdates ? { ...volatile, ...volatileUpdates } : volatile
    };
}