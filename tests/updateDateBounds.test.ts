import { updateDateBounds, BOARD_PADDING_BEFORE_DAYS, BOARD_PADDING_AFTER_DAYS } from '../src/core/update/updateDateBounds';
import { addDaysISO } from '../src/core/utils/dateUtils';
import { makeTasks } from './testHelpers';

const day = (iso: string) => iso.slice(0, 10);

describe('updateDateBounds', () => {
    test('no tasks → no bounds', () => {
        expect(updateDateBounds([], '2024-03-01')).toBeNull();
    });

    test('pads around the task range when today lies inside it', () => {
        const tasks = makeTasks([
            { name: 'A', start: '2024-03-01', end: '2024-03-10' },
            { name: 'B', start: '2024-03-05', end: '2024-04-02' },
        ]);
        const bounds = updateDateBounds(tasks, '2024-03-15')!;
        expect(day(bounds.earliest)).toBe(addDaysISO('2024-03-01', -BOARD_PADDING_BEFORE_DAYS));
        expect(day(bounds.latest)).toBe(addDaysISO('2024-04-02', BOARD_PADDING_AFTER_DAYS));
    });

    test('extends to include today when all tasks are in the past', () => {
        const tasks = makeTasks([{ name: 'Old', start: '2024-01-01', end: '2024-01-05' }]);
        const bounds = updateDateBounds(tasks, '2024-06-01')!;
        expect(day(bounds.earliest)).toBe(addDaysISO('2024-01-01', -BOARD_PADDING_BEFORE_DAYS));
        expect(day(bounds.latest)).toBe(addDaysISO('2024-06-01', BOARD_PADDING_AFTER_DAYS));
    });

    test('extends to include today when all tasks are in the future', () => {
        const tasks = makeTasks([{ name: 'Next', start: '2024-09-01' }]);
        const bounds = updateDateBounds(tasks, '2024-06-01')!;
        expect(day(bounds.earliest)).toBe(addDaysISO('2024-06-01', -BOARD_PADDING_BEFORE_DAYS));
        expect(day(bounds.latest)).toBe(addDaysISO('2024-09-01', BOARD_PADDING_AFTER_DAYS));
    });
});
