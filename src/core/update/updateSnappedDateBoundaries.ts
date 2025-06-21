import { App } from 'obsidian';
import { IAppState } from '../../interfaces/IAppState';

export function updateSnappedDateBoundaries(
    app: App,
    currentState: IAppState
): IAppState {
    const globalMinDate = new Date(currentState.persistent.settings?.globalMinDate || new Date().toISOString());
    const globalMaxDate = new Date(currentState.persistent.settings?.globalMaxDate || new Date().toISOString());
    const timeUnit = currentState.persistent.currentTimeUnit || 'DAY';

    let globalMinDateSnapped: Date;
    let globalMaxDateSnapped: Date;

    switch (timeUnit) {
        case 'DAY':
            globalMinDateSnapped = new Date(globalMinDate);
            globalMinDateSnapped.setUTCHours(0, 0, 0, 0);
            
            globalMaxDateSnapped = new Date(globalMaxDate);
            globalMaxDateSnapped.setUTCHours(23, 59, 59, 999);
            break;

        case 'WEEK':
            globalMinDateSnapped = new Date(globalMinDate);
            const dayOfWeek = globalMinDateSnapped.getUTCDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            globalMinDateSnapped.setUTCDate(globalMinDateSnapped.getUTCDate() - daysToMonday);
            globalMinDateSnapped.setUTCHours(0, 0, 0, 0);

            globalMaxDateSnapped = new Date(globalMaxDate);
            const maxDayOfWeek = globalMaxDateSnapped.getUTCDay();
            const daysToSunday = maxDayOfWeek === 0 ? 0 : 7 - maxDayOfWeek;
            globalMaxDateSnapped.setUTCDate(globalMaxDateSnapped.getUTCDate() + daysToSunday);
            globalMaxDateSnapped.setUTCHours(23, 59, 59, 999);
            break;

        case 'MONTH':
        default:
            globalMinDateSnapped = new Date(globalMinDate);
            globalMinDateSnapped.setUTCDate(1);
            globalMinDateSnapped.setUTCHours(0, 0, 0, 0);

            globalMaxDateSnapped = new Date(globalMaxDate);
            globalMaxDateSnapped.setUTCMonth(globalMaxDateSnapped.getUTCMonth() + 1, 0);
            globalMaxDateSnapped.setUTCHours(23, 59, 59, 999);
            break;
    }

    return {
        ...currentState,
        volatile: {
            ...currentState.volatile,
            globalMinDateSnapped: globalMinDateSnapped.toISOString(),
            globalMaxDateSnapped: globalMaxDateSnapped.toISOString()
        }
    };
}