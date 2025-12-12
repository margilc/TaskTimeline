import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateBoardGrouping } from '../src/core/update/updateBoardGrouping';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';
import {
    createLayoutTestState,
    expectValidLayout,
    getPositionedTasks,
    expectValidTaskPosition
} from './testHelpers';

const mockApp = {} as any;

describe('Layout Core Tests', () => {

    beforeEach(() => {
        clearLayoutCache();
    });

    // Sample tasks for testing
    function createSampleTasks(): ITask[] {
        return [
            {
                name: 'Task 1',
                start: '2024-01-15',
                end: '2024-01-17',
                category: 'development',
                status: 'In Progress',
                priority: 1,
                filePath: '/task1.md',
                content: 'Task 1 content'
            },
            {
                name: 'Task 2',
                start: '2024-01-16',
                end: '2024-01-18',
                category: 'testing',
                status: 'Not Started',
                priority: 2,
                filePath: '/task2.md',
                content: 'Task 2 content'
            },
            {
                name: 'Task 3',
                start: '2024-01-18',
                end: '2024-01-20',
                category: 'development',
                status: 'Done',
                priority: 3,
                filePath: '/task3.md',
                content: 'Task 3 content'
            }
        ];
    }

    describe('Basic Layout Generation', () => {
        test('should generate valid layout with default settings', () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expectValidLayout(layout, 8);
            expect(layout.timeUnit).toBe(TimeUnit.DAY);
        });

        test('should generate layout with empty task list', () => {
            const state = createLayoutTestState([]);

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expectValidLayout(layout, 8);
            // With no tasks, taskGrids may be empty (implementation choice)
            expect(layout.taskGrids.length).toBeGreaterThanOrEqual(0);
        });

        test('should position tasks with valid coordinates', () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const result = updateLayout(mockApp, state);
            const positionedTasks = getPositionedTasks(result.volatile.boardLayout!);

            expect(positionedTasks.length).toBeGreaterThan(0);
            positionedTasks.forEach(task => {
                expectValidTaskPosition(task);
            });
        });
    });

    describe('Column Count Settings', () => {
        test.each([5, 7, 8, 12, 15, 30])('should create exactly %i columns when specified', (columns) => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks, { numberOfColumns: columns });

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expect(layout.columnHeaders).toHaveLength(columns);
            expect(layout.gridWidth).toBe(columns + 1);
        });

        test('should handle minimum column count (1)', () => {
            const state = createLayoutTestState(createSampleTasks(), { numberOfColumns: 1 });
            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expect(layout.columnHeaders).toHaveLength(1);
            expect(layout.gridWidth).toBe(2);
        });

        test('should handle large column count (50)', () => {
            const state = createLayoutTestState(createSampleTasks(), { numberOfColumns: 50 });
            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expect(layout.columnHeaders).toHaveLength(50);
            expect(layout.gridWidth).toBe(51);
        });
    });

    describe('Time Unit Handling', () => {
        test.each([TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH])('should handle %s time unit', async (timeUnit) => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, timeUnit);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };

            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;

            expect(layout.timeUnit).toBe(timeUnit);
            expect(layout.columnHeaders).toHaveLength(8);
        });

        test('should clear viewport when time unit changes', async () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            // Set custom viewport
            state.volatile.timelineViewport = {
                localMinDate: '2024-01-01',
                localMaxDate: '2024-01-31'
            };

            // Change time unit
            const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, TimeUnit.WEEK);

            expect(timeUnitResult.volatile.timelineViewport).toBeUndefined();
        });

        test('should maintain column count across time unit switches', async () => {
            const tasks = createSampleTasks();
            let state = createLayoutTestState(tasks, { numberOfColumns: 10 });

            for (const timeUnit of [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH, TimeUnit.DAY]) {
                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, timeUnit);
                state = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };

                const result = updateLayout(mockApp, state);
                expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(10);
            }
        });
    });

    describe('Grouping', () => {
        test('should create single group when groupBy is none', async () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks, { groupBy: 'none' });

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expect(layout.taskGrids).toHaveLength(1);
            expect(layout.taskGrids[0].group).toBe('All Tasks');
        });

        test.each(['category', 'status', 'priority'])('should group tasks by %s', async (groupBy) => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const groupingResult = await updateBoardGrouping(mockApp, state, groupBy);
            const stateWithGrouping = {
                persistent: groupingResult.persistent,
                volatile: state.volatile
            };

            const result = updateLayout(mockApp, stateWithGrouping);
            const layout = result.volatile.boardLayout!;

            expect(layout.taskGrids.length).toBeGreaterThan(1);

            // Verify all tasks are accounted for
            const totalTasksInGrids = layout.taskGrids.reduce((sum, grid) => sum + grid.tasks.length, 0);
            expect(totalTasksInGrids).toBe(tasks.length);
        });

        test('should maintain column count when grouping changes', async () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks, { numberOfColumns: 12 });

            for (const groupBy of ['none', 'category', 'status', 'none']) {
                const groupingResult = await updateBoardGrouping(mockApp, state, groupBy);
                const stateWithGrouping = {
                    persistent: groupingResult.persistent,
                    volatile: state.volatile
                };

                const result = updateLayout(mockApp, stateWithGrouping);
                expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(12);
            }
        });
    });

    describe('Grid Dimensions', () => {
        test('should calculate correct grid dimensions', () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks, { numberOfColumns: 8 });

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            // gridWidth = columns + 1 (for row header)
            expect(layout.gridWidth).toBe(9);

            // gridHeight should be at least the max row used + 1
            const maxRow = Math.max(
                ...layout.taskGrids.flatMap(grid =>
                    grid.tasks.map(task => task.y || 0)
                ),
                0
            );
            expect(layout.gridHeight).toBeGreaterThanOrEqual(maxRow + 1);
        });

        test('should have gridHeight of at least 1 even with no tasks', () => {
            const state = createLayoutTestState([]);
            const result = updateLayout(mockApp, state);

            expect(result.volatile.boardLayout!.gridHeight).toBeGreaterThan(0);
        });
    });

    describe('Viewport', () => {
        test('should have valid viewport dates', () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            expect(layout.viewport).toBeDefined();
            expect(layout.viewport.startDate).toBeInstanceOf(Date);
            expect(layout.viewport.endDate).toBeInstanceOf(Date);
            expect(layout.viewport.startDate.getTime()).toBeLessThanOrEqual(layout.viewport.endDate.getTime());
        });

        test('should have column headers within viewport range', () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;

            const firstHeaderDate = new Date(layout.columnHeaders[0].date);
            const lastHeaderDate = new Date(layout.columnHeaders[layout.columnHeaders.length - 1].date);

            expect(firstHeaderDate.getTime()).toBeGreaterThanOrEqual(layout.viewport.startDate.getTime());
            expect(lastHeaderDate.getTime()).toBeLessThanOrEqual(layout.viewport.endDate.getTime());
        });
    });

    describe('Cache Behavior', () => {
        test('should return cached layout for identical state', () => {
            const tasks = createSampleTasks();
            const state = createLayoutTestState(tasks);

            const result1 = updateLayout(mockApp, state);
            const result2 = updateLayout(mockApp, state);

            expect(result1.volatile.boardLayout).toBe(result2.volatile.boardLayout);
        });

        test('should not share cache between different numberOfColumns', () => {
            const tasks = createSampleTasks();

            const state5 = createLayoutTestState(tasks, { numberOfColumns: 5 });
            const state9 = createLayoutTestState(tasks, { numberOfColumns: 9 });

            const result5 = updateLayout(mockApp, state5);
            const result9 = updateLayout(mockApp, state9);

            expect(result5.volatile.boardLayout!.columnHeaders.length).toBe(5);
            expect(result9.volatile.boardLayout!.columnHeaders.length).toBe(9);
            expect(result5.volatile.boardLayout).not.toBe(result9.volatile.boardLayout);
        });
    });
});
