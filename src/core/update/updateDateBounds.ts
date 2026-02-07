import { IDateBounds } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';

export function updateDateBounds(tasks: ITask[]): IDateBounds | null {
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

    return {
        earliest: new Date(earliest).toISOString(),
        latest: new Date(latest).toISOString()
    };
}
