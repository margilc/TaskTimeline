import { IDateBounds } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { localTodayISO } from '../utils/dateUtils';

const DAY_MS = 86400000;

// Room around the tasks so there is space to drag/resize past the current
// extremes; after > before because planning mostly extends forward.
export const BOARD_PADDING_BEFORE_DAYS = 14;
export const BOARD_PADDING_AFTER_DAYS = 56;

/**
 * The board's date range: every task plus today, padded on both sides.
 * Layout snaps these bounds to the active time unit.
 */
export function updateDateBounds(tasks: ITask[], today: string = localTodayISO()): IDateBounds | null {
    if (tasks.length === 0) return null;

    let earliest = Infinity;
    let latest = -Infinity;

    for (const task of tasks) {
        const start = new Date(task.start).getTime();
        if (isNaN(start)) continue;

        const end = task.end ? new Date(task.end).getTime() : start;
        const validEnd = isNaN(end) ? start : end;

        if (start < earliest) earliest = start;
        if (validEnd > latest) latest = validEnd;
    }

    if (!isFinite(earliest) || !isFinite(latest)) return null;

    const todayMs = new Date(today).getTime();
    earliest = Math.min(earliest, todayMs);
    latest = Math.max(latest, todayMs);

    return {
        // UTC frame: no DST, so day arithmetic in ms is exact.
        earliest: new Date(earliest - BOARD_PADDING_BEFORE_DAYS * DAY_MS).toISOString(),
        latest: new Date(latest + BOARD_PADDING_AFTER_DAYS * DAY_MS).toISOString(),
    };
}
