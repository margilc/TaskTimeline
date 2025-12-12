import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateBoardGrouping } from '../src/core/update/updateBoardGrouping';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';
import {
    createLayoutTestState,
    generateSeededRandomTasks,
    measurePerformance,
    detectOverlaps,
    generateRandomTasks
} from './testHelpers';

const mockApp = {} as any;

describe('Layout Performance Tests', () => {
    const PERFORMANCE_THRESHOLD_MS = 500;

    beforeEach(() => {
        clearLayoutCache();
    });

    describe('Large Dataset Handling', () => {
        test.each([
            { size: 20, maxMs: 50 },
            { size: 100, maxMs: 150 },
            { size: 500, maxMs: 500 }
        ])('should handle $size tasks within $maxMs ms', ({ size, maxMs }) => {
            const tasks = generateSeededRandomTasks(size, 42);
            const state = createLayoutTestState(tasks, { currentDate: '2024-06-15' });

            const { result, duration } = measurePerformance(
                () => updateLayout(mockApp, state),
                maxMs
            );

            expect(result.volatile.boardLayout).toBeDefined();
            expect(result.volatile.boardLayout!.taskGrids).toBeDefined();
        });

        test('should handle 200 tasks with different column counts', () => {
            const tasks = generateSeededRandomTasks(200, 123);

            for (const columns of [8, 15, 30]) {
                const state = createLayoutTestState(tasks, {
                    currentDate: '2024-06-15',
                    numberOfColumns: columns
                });

                const { result, duration } = measurePerformance(
                    () => updateLayout(mockApp, state),
                    PERFORMANCE_THRESHOLD_MS
                );

                expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(columns);
            }
        });
    });

    describe('Overlap Prevention', () => {
        test('should have zero overlaps with 200 random tasks', () => {
            const tasks = generateSeededRandomTasks(200, 1);
            const state = createLayoutTestState(tasks, { currentDate: '2024-06-15' });

            const result = updateLayout(mockApp, state);
            const layout = result.volatile.boardLayout!;
            const overlaps = detectOverlaps(layout.taskGrids);

            expect(overlaps).toHaveLength(0);
        });

        test('should have zero overlaps with grouping enabled', async () => {
            const tasks = generateSeededRandomTasks(100, 789);
            const state = createLayoutTestState(tasks, { currentDate: '2024-06-15' });

            const groupingResult = await updateBoardGrouping(mockApp, state, 'category');
            const stateWithGrouping = {
                persistent: groupingResult.persistent,
                volatile: state.volatile
            };

            const result = updateLayout(mockApp, stateWithGrouping);
            const layout = result.volatile.boardLayout!;

            expect(layout.taskGrids.length).toBeGreaterThan(1);

            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
        });

        test('should have zero overlaps across all time units', async () => {
            const tasks = generateSeededRandomTasks(100, 456);
            const state = createLayoutTestState(tasks, { currentDate: '2024-06-15' });

            for (const timeUnit of [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH]) {
                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, timeUnit);
                const result = updateLayout(mockApp, {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                });

                const overlaps = detectOverlaps(result.volatile.boardLayout!.taskGrids);
                expect(overlaps).toHaveLength(0);
            }
        });

        test('should handle same-date tasks without overlaps', () => {
            const tasks: ITask[] = Array.from({ length: 15 }, (_, i) => ({
                name: `Same Date ${i + 1}`,
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
            const overlaps = detectOverlaps(result.volatile.boardLayout!.taskGrids);

            expect(overlaps).toHaveLength(0);

            // Verify tasks are in different rows
            const positionedTasks = result.volatile.boardLayout!.taskGrids[0].tasks.filter(
                t => t.xStart !== undefined
            );
            const rows = new Set(positionedTasks.map(t => t.y));
            expect(rows.size).toBe(positionedTasks.length);
        });
    });

    describe('Cache Effectiveness', () => {
        test('should demonstrate significant cache speedup', () => {
            clearLayoutCache();
            const tasks = generateSeededRandomTasks(100, 555);
            const state = createLayoutTestState(tasks);

            // First call (cold cache)
            const start1 = performance.now();
            const result1 = updateLayout(mockApp, state);
            const coldDuration = performance.now() - start1;

            // Second call (warm cache)
            const start2 = performance.now();
            const result2 = updateLayout(mockApp, state);
            const warmDuration = performance.now() - start2;

            // Cache should provide significant speedup
            expect(warmDuration).toBeLessThan(coldDuration / 2);
            expect(warmDuration).toBeLessThan(5); // Near-instant

            // Results should be identical
            expect(result1.volatile.boardLayout).toBe(result2.volatile.boardLayout);
        });
    });

    describe('Time Unit Switching Performance', () => {
        test('should handle rapid time unit switching efficiently', async () => {
            const tasks = generateSeededRandomTasks(100, 999);
            let state = createLayoutTestState(tasks);
            const switchSequence = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH, TimeUnit.DAY, TimeUnit.MONTH];

            const start = performance.now();

            for (const timeUnit of switchSequence) {
                const timeUnitResult = await updateTimeUnit(mockApp, state.persistent, state.volatile, timeUnit);
                state = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };

                const result = updateLayout(mockApp, state);
                expect(result.volatile.boardLayout!.timeUnit).toBe(timeUnit);
                expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(8);
            }

            const totalDuration = performance.now() - start;
            expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
        });
    });

    describe('Grouping Performance', () => {
        test.each(['none', 'category', 'status', 'priority'])('should handle grouping by %s within threshold', async (groupBy) => {
            const tasks = generateSeededRandomTasks(100, 111);
            const state = createLayoutTestState(tasks);

            const durations: number[] = [];

            for (let i = 0; i < 3; i++) {
                const start = performance.now();

                const groupingResult = await updateBoardGrouping(mockApp, state, groupBy);
                const layoutResult = updateLayout(mockApp, {
                    persistent: groupingResult.persistent,
                    volatile: state.volatile
                });

                durations.push(performance.now() - start);

                expect(layoutResult.volatile.boardLayout).toBeDefined();
            }

            const avgDuration = durations.reduce((a, b) => a + b, 0) / 3;
            expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
        });
    });

    describe('Deterministic Results', () => {
        test('should produce identical layouts for identical inputs', () => {
            const tasks = generateSeededRandomTasks(50, 777);

            const state1 = createLayoutTestState(tasks);
            const state2 = createLayoutTestState(tasks);

            clearLayoutCache();
            const result1 = updateLayout(mockApp, state1);

            clearLayoutCache();
            const result2 = updateLayout(mockApp, state2);

            // Results should be structurally equal
            expect(result1.volatile.boardLayout!.columnHeaders.length)
                .toBe(result2.volatile.boardLayout!.columnHeaders.length);
            expect(result1.volatile.boardLayout!.gridHeight)
                .toBe(result2.volatile.boardLayout!.gridHeight);

            // Neither should have overlaps
            expect(detectOverlaps(result1.volatile.boardLayout!.taskGrids)).toHaveLength(0);
            expect(detectOverlaps(result2.volatile.boardLayout!.taskGrids)).toHaveLength(0);
        });
    });

    describe('Stress Tests', () => {
        test('should handle 50 columns with many tasks', () => {
            const tasks = generateSeededRandomTasks(150, 333);
            const state = createLayoutTestState(tasks, {
                numberOfColumns: 50,
                currentDate: '2024-06-15'
            });

            const { result } = measurePerformance(
                () => updateLayout(mockApp, state),
                PERFORMANCE_THRESHOLD_MS
            );

            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(50);
            expect(detectOverlaps(result.volatile.boardLayout!.taskGrids)).toHaveLength(0);
        });

        test('should handle cascading overlapping tasks efficiently', () => {
            // Create tasks that start on consecutive days with 3-day duration
            const tasks: ITask[] = Array.from({ length: 30 }, (_, i) => ({
                name: `Cascade ${i + 1}`,
                start: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                end: new Date(2024, 0, 4 + i).toISOString().split('T')[0],
                category: `cat${i % 5}`,
                status: i < 15 ? 'early' : 'late',
                priority: (i % 3) + 1,
                filePath: `/cascade${i + 1}.md`,
                content: ''
            }));

            const state = createLayoutTestState(tasks, {
                currentDate: '2024-01-15',
                numberOfColumns: 15
            });

            const { result } = measurePerformance(
                () => updateLayout(mockApp, state),
                PERFORMANCE_THRESHOLD_MS
            );

            expect(detectOverlaps(result.volatile.boardLayout!.taskGrids)).toHaveLength(0);

            // With cascading 3-day overlaps, we need multiple rows
            const maxRow = Math.max(
                ...result.volatile.boardLayout!.taskGrids.flatMap(g =>
                    g.tasks.map(t => t.y || 0)
                )
            );
            expect(maxRow).toBeGreaterThanOrEqual(2);
        });
    });
});
