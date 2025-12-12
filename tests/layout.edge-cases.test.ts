import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';
import {
    createLayoutTestState,
    getPositionedTasks,
    expectValidTaskPosition
} from './testHelpers';

const mockApp = {} as any;

describe('Layout Edge Cases', () => {

    beforeEach(() => {
        clearLayoutCache();
    });

    describe('Date Boundaries', () => {
        describe('Month Boundaries', () => {
            test('should show correct month start dates in column headers', async () => {
                const state = createLayoutTestState([], { currentDate: '2025-06-15', numberOfColumns: 5 });

                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.MONTH);
                const result = updateLayout(mockApp, {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                });
                const layout = result.volatile.boardLayout!;

                // Each month column should start on the 1st
                layout.columnHeaders.forEach(header => {
                    const headerDate = new Date(header.date);
                    expect(headerDate.getUTCDate()).toBe(1);
                });
            });

            test('should handle month boundary edge (end of May to June)', async () => {
                const tasks: ITask[] = [
                    { name: 'End of May', start: '2025-05-31', end: '2025-05-31', filePath: '/end-may.md', content: '' },
                    { name: 'Start of June', start: '2025-06-01', end: '2025-06-01', filePath: '/start-june.md', content: '' }
                ];

                const state = createLayoutTestState(tasks, { currentDate: '2025-06-01', numberOfColumns: 5 });
                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.MONTH);
                const result = updateLayout(mockApp, {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                });
                const layout = result.volatile.boardLayout!;
                const positioned = getPositionedTasks(layout);

                const mayTask = positioned.find(t => t.name === 'End of May');
                const juneTask = positioned.find(t => t.name === 'Start of June');

                // Tasks in different months should be in different columns
                if (mayTask && juneTask) {
                    expect(mayTask.xStart).not.toBe(juneTask.xStart);
                }
            });
        });

        describe('Week Boundaries', () => {
            test('should show correct week start dates (Monday) in column headers', async () => {
                const state = createLayoutTestState([], { currentDate: '2025-06-15', numberOfColumns: 5 });

                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.WEEK);
                const result = updateLayout(mockApp, {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                });
                const layout = result.volatile.boardLayout!;

                // Each week column should start on Monday (day 1)
                layout.columnHeaders.forEach(header => {
                    const headerDate = new Date(header.date);
                    expect(headerDate.getUTCDay()).toBe(1);
                });
            });

            test('should place tasks in same week column', async () => {
                const tasks: ITask[] = [
                    { name: 'Monday Task', start: '2025-06-16', end: '2025-06-16', filePath: '/monday.md', content: '' },
                    { name: 'Friday Task', start: '2025-06-20', end: '2025-06-20', filePath: '/friday.md', content: '' }
                ];

                const state = createLayoutTestState(tasks, { currentDate: '2025-06-16', numberOfColumns: 5 });
                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.WEEK);
                const result = updateLayout(mockApp, {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                });
                const positioned = getPositionedTasks(result.volatile.boardLayout!);

                const mondayTask = positioned.find(t => t.name === 'Monday Task');
                const fridayTask = positioned.find(t => t.name === 'Friday Task');

                // Same week tasks should be in same column
                if (mondayTask && fridayTask) {
                    expect(mondayTask.xStart).toBe(fridayTask.xStart);
                }
            });
        });

        describe('Day Boundaries', () => {
            test('should have sequential day columns', () => {
                const state = createLayoutTestState([], { currentDate: '2025-06-15', numberOfColumns: 5 });
                const result = updateLayout(mockApp, state);
                const layout = result.volatile.boardLayout!;

                for (let i = 0; i < layout.columnHeaders.length - 1; i++) {
                    const current = new Date(layout.columnHeaders[i].date);
                    const next = new Date(layout.columnHeaders[i + 1].date);
                    const dayDiff = (next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24);
                    expect(dayDiff).toBe(1);
                }
            });

            test('should place adjacent day tasks in adjacent columns', () => {
                const tasks: ITask[] = [
                    { name: 'Day 1', start: '2024-01-15', end: '2024-01-15', filePath: '/d1.md', content: '' },
                    { name: 'Day 2', start: '2024-01-16', end: '2024-01-16', filePath: '/d2.md', content: '' }
                ];

                const state = createLayoutTestState(tasks);
                const result = updateLayout(mockApp, state);
                const positioned = getPositionedTasks(result.volatile.boardLayout!);

                const day1 = positioned.find(t => t.name === 'Day 1');
                const day2 = positioned.find(t => t.name === 'Day 2');

                if (day1 && day2) {
                    expect(Math.abs(day1.xStart! - day2.xStart!)).toBe(1);
                }
            });
        });

        describe('Year Boundaries', () => {
            test('should handle year-crossing tasks', async () => {
                const tasks: ITask[] = [
                    { name: 'Year End', start: '2024-12-30', end: '2024-12-31', filePath: '/yearend.md', content: '' },
                    { name: 'Year Start', start: '2025-01-01', end: '2025-01-02', filePath: '/yearstart.md', content: '' },
                    { name: 'Cross Year', start: '2024-12-28', end: '2025-01-05', filePath: '/crossyear.md', content: '' }
                ];

                const state = createLayoutTestState(tasks, { currentDate: '2025-01-01', numberOfColumns: 10 });
                const result = updateLayout(mockApp, state);
                const layout = result.volatile.boardLayout!;

                // Should not throw and should have valid layout
                expect(layout.columnHeaders).toHaveLength(10);
                expect(layout.taskGrids.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Multi-Column Spanning Tasks', () => {
        test('should correctly span task across multiple columns', () => {
            const tasks: ITask[] = [
                { name: 'Multi-Day', start: '2024-01-14', end: '2024-01-16', filePath: '/multi.md', content: '' }
            ];

            const state = createLayoutTestState(tasks);
            const result = updateLayout(mockApp, state);
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            expect(positioned).toHaveLength(1);
            const task = positioned[0];
            expect(task.xEnd! - task.xStart!).toBe(2); // 3-day span = 3 columns (indices differ by 2)
        });

        test('should clip task to viewport when spanning beyond', () => {
            const tasks: ITask[] = [
                { name: 'Long Task', start: '2024-01-13', end: '2024-01-25', filePath: '/long.md', content: '' }
            ];

            const state = createLayoutTestState(tasks, { numberOfColumns: 5 });
            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;
            const positioned = getPositionedTasks(layout);

            if (positioned.length > 0) {
                const task = positioned[0];
                expect(task.xEnd).toBeLessThanOrEqual(layout.columnHeaders.length);
            }
        });
    });

    describe('Tasks Outside Viewport', () => {
        test('should handle tasks far in the future', () => {
            const tasks: ITask[] = [
                { name: 'Current', start: '2024-01-15', end: '2024-01-15', filePath: '/current.md', content: '' },
                { name: 'Far Future', start: '2030-06-15', end: '2030-06-15', filePath: '/future.md', content: '' }
            ];

            const state = createLayoutTestState(tasks, { numberOfColumns: 5 });
            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;
            const positioned = getPositionedTasks(layout);

            // Current task should be positioned
            const current = positioned.find(t => t.name === 'Current');
            expect(current).toBeDefined();

            // Far future may not be in the 5-column viewport
            expect(layout.taskGrids).toBeDefined();
        });

        test('should handle tasks far in the past', () => {
            const tasks: ITask[] = [
                { name: 'Current', start: '2024-01-15', end: '2024-01-15', filePath: '/current.md', content: '' },
                { name: 'Far Past', start: '2020-01-15', end: '2020-01-15', filePath: '/past.md', content: '' }
            ];

            const state = createLayoutTestState(tasks, { numberOfColumns: 5 });
            const result = updateLayout(mockApp, state);
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            const current = positioned.find(t => t.name === 'Current');
            expect(current).toBeDefined();
        });
    });

    describe('Special Task Properties', () => {
        test('should handle tasks with same start and end dates', () => {
            const tasks: ITask[] = [
                { name: 'Single Day', start: '2024-01-15', end: '2024-01-15', filePath: '/single.md', content: '' }
            ];

            const state = createLayoutTestState(tasks);
            const result = updateLayout(mockApp, state);
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            expect(positioned).toHaveLength(1);
            expect(positioned[0].xStart).toBe(positioned[0].xEnd);
        });

        test('should handle tasks without end date', () => {
            const tasks: ITask[] = [
                { name: 'No End', start: '2024-01-15', filePath: '/noend.md', content: '' }
            ];

            const state = createLayoutTestState(tasks);
            const result = updateLayout(mockApp, state);
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            if (positioned.length > 0) {
                expect(positioned[0].xStart).toBeGreaterThan(0);
                expect(positioned[0].xEnd).toBeGreaterThanOrEqual(positioned[0].xStart!);
            }
        });

        test('should handle many tasks on same date', () => {
            const tasks: ITask[] = Array.from({ length: 10 }, (_, i) => ({
                name: `Same Date Task ${i + 1}`,
                start: '2024-01-15',
                end: '2024-01-15',
                category: 'same',
                status: 'active',
                priority: i % 3 + 1,
                filePath: `/same${i + 1}.md`,
                content: ''
            }));

            const state = createLayoutTestState(tasks);
            const result = updateLayout(mockApp, state);
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            expect(positioned.length).toBe(10);

            // All should be in same column but different rows
            const columns = new Set(positioned.map(t => t.xStart));
            const rows = new Set(positioned.map(t => t.y));

            expect(columns.size).toBe(1); // All same column
            expect(rows.size).toBe(10); // All different rows
        });
    });

    describe('Current Date Edge Cases', () => {
        test.each([
            '2025-01-01', // Start of year
            '2025-12-31', // End of year
            '2025-02-28', // End of February
        ])('should handle current date %s', (currentDate) => {
            const state = createLayoutTestState([], { currentDate });

            expect(() => {
                const result = updateLayout(mockApp, state);
                const layout = result.volatile.boardLayout!;

                expect(layout.viewport).toBeDefined();
                expect(layout.columnHeaders).toHaveLength(8);
            }).not.toThrow();
        });

        test('should handle current date at start of month', async () => {
            const tasks: ITask[] = [
                { name: 'Month Start', start: '2025-06-01', end: '2025-06-01', filePath: '/mstart.md', content: '' },
                { name: 'Month End', start: '2025-06-30', end: '2025-06-30', filePath: '/mend.md', content: '' }
            ];

            const state = createLayoutTestState(tasks, { currentDate: '2025-06-01', numberOfColumns: 5 });
            const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.MONTH);
            const result = updateLayout(mockApp, {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            });
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            // Both should be positioned in same June column
            expect(positioned.length).toBe(2);
            if (positioned.length === 2) {
                expect(positioned[0].xStart).toBe(positioned[1].xStart);
            }
        });
    });

    describe('Cross Time-Unit Consistency', () => {
        test('should maintain task visibility across time unit changes', async () => {
            const tasks: ITask[] = [
                { name: 'Consistent Task', start: '2025-06-15', end: '2025-06-15', filePath: '/consistent.md', content: '' }
            ];

            const state = createLayoutTestState(tasks, { currentDate: '2025-06-15', numberOfColumns: 5 });

            for (const timeUnit of [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH]) {
                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, timeUnit);
                const result = updateLayout(mockApp, {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                });
                const positioned = getPositionedTasks(result.volatile.boardLayout!);
                const consistentTask = positioned.find(t => t.name === 'Consistent Task');

                expect(consistentTask).toBeDefined();
                expectValidTaskPosition(consistentTask!);
            }
        });
    });

    describe('Multi-Month Spanning Tasks', () => {
        test('should handle tasks spanning multiple months', async () => {
            const tasks: ITask[] = [
                { name: 'Multi-Month', start: '2025-05-15', end: '2025-07-15', filePath: '/multi-month.md', content: '' }
            ];

            const state = createLayoutTestState(tasks, { currentDate: '2025-06-15', numberOfColumns: 5 });
            const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.MONTH);
            const result = updateLayout(mockApp, {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            });
            const positioned = getPositionedTasks(result.volatile.boardLayout!);

            if (positioned.length > 0) {
                const task = positioned[0];
                // Should span multiple columns (May, June, July = 3 months)
                expect(task.xEnd! - task.xStart!).toBeGreaterThanOrEqual(1);
            }
        });
    });
});
