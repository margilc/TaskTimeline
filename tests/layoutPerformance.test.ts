import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateBoardGrouping } from '../src/core/update/updateBoardGrouping';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { updateCurrentDate } from '../src/core/update/updateCurrentDate';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';
import { generateRandomTasks, createTestAppState, measurePerformance } from './testHelpers';

const mockApp = {} as any;

describe('Layout Performance Testing', () => {
    const PERFORMANCE_THRESHOLD = 500;
    function createBaseState(tasks: ITask[]): IAppState {
        return createTestAppState(tasks, {
            persistent: {
                currentDate: '2024-06-15', // Mid-year for good task coverage
                currentTimeUnit: TimeUnit.DAY,
                boardGrouping: { groupBy: 'none', availableGroups: ['All Tasks'] },
                settings: {
                    numberOfColumns: 8 // Maintain expected 8 columns for performance tests
                }
            },
            volatile: {
                currentTasks: tasks
            }
        });
    }

    // Performance test for different dataset sizes
    describe.each([
        { size: 20, expectedTime: 50 },
        { size: 100, expectedTime: 100 },
        { size: 500, expectedTime: 500 }
    ])('Dataset Size: $size tasks', ({ size, expectedTime }) => {
        let baseState: IAppState;
        let tasks: ITask[];

        beforeEach(() => {
            clearLayoutCache();
            tasks = generateRandomTasks(size);
            baseState = createBaseState(tasks);
        });

        describe('Column Count Changes', () => {
            const columnConfigs = [
                { columns: 8, desc: 'default' },
                { columns: 15, desc: 'medium' },
                { columns: 30, desc: 'large' }
            ];

            test.each(columnConfigs)('should handle $columns columns ($desc) within threshold', ({ columns }) => {
                // UPDATED: Set numberOfColumns in settings (not viewport) to test correct behavior
                baseState.persistent.settings = {
                    numberOfColumns: columns
                };
                
                // Clear any custom viewport to test default behavior with specific numberOfColumns
                baseState.volatile.timelineViewport = undefined;

                const { result, duration } = measurePerformance(() => updateLayout(mockApp, baseState), expectedTime);
                
                expect(result.volatile.boardLayout).toBeDefined();
                expect(result.volatile.boardLayout!.columnHeaders.length).toBe(columns);
                
                console.log(`${size} tasks, ${columns} columns: ${duration.toFixed(2)}ms`);
            });
        });

        describe('Grouping Variable Changes', () => {
            const groupingOptions = ['none', 'category', 'status', 'priority'];

            test.each(groupingOptions)('should handle grouping by %s within threshold', async (groupBy) => {
                const durations: number[] = [];
                
                // Test 3 times for variance
                for (let i = 0; i < 3; i++) {
                    const start = performance.now();
                    
                    // Update grouping
                    const groupingResult = await updateBoardGrouping(mockApp, baseState, groupBy);
                    const stateWithGrouping = {
                        persistent: groupingResult.persistent,
                        volatile: { ...baseState.volatile }
                    };
                    
                    // Generate layout with new grouping
                    const layoutResult = updateLayout(mockApp, stateWithGrouping);
                    
                    const end = performance.now();
                    const duration = end - start;
                    
                    durations.push(duration);
                    
                    // Verify layout was created
                    expect(layoutResult.volatile.boardLayout).toBeDefined();
                    expect(layoutResult.volatile.boardLayout!.taskGrids).toBeDefined();
                    
                    if (groupBy === 'none') {
                        expect(layoutResult.volatile.boardLayout!.taskGrids).toHaveLength(1);
                    } else {
                        expect(layoutResult.volatile.boardLayout!.taskGrids.length).toBeGreaterThan(0);
                    }
                }

                const avgDuration = durations.reduce((a, b) => a + b, 0) / 3;
                const maxDuration = Math.max(...durations);
                
                console.log(`${size} tasks, grouping=${groupBy}: avg=${avgDuration.toFixed(2)}ms, max=${maxDuration.toFixed(2)}ms`);
                
                expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLD);
                expect(avgDuration).toBeLessThan(expectedTime);
            });
        });

        describe('Current Date Changes', () => {
            const dateConfigs = [
                { date: '2024-01-15', desc: 'early year' },
                { date: '2024-06-15', desc: 'mid year' },
                { date: '2024-12-15', desc: 'late year' }
            ];

            test.each(dateConfigs)('should handle current date $date ($desc) within threshold', async ({ date }) => {
                const durations: number[] = [];
                
                // Test 3 times for variance
                for (let i = 0; i < 3; i++) {
                    const start = performance.now();
                    
                    // Update current date
                    const dateResult = await updateCurrentDate(mockApp, baseState.persistent, baseState.volatile, date);
                    const stateWithDate = {
                        persistent: dateResult.persistent,
                        volatile: dateResult.volatile
                    };
                    
                    // Generate layout with new date
                    const layoutResult = updateLayout(mockApp, stateWithDate);
                    
                    const end = performance.now();
                    const duration = end - start;
                    
                    durations.push(duration);
                    
                    // Verify layout was created
                    expect(layoutResult.volatile.boardLayout).toBeDefined();
                    expect(layoutResult.volatile.boardLayout!.columnHeaders).toBeDefined();
                }

                const avgDuration = durations.reduce((a, b) => a + b, 0) / 3;
                const maxDuration = Math.max(...durations);
                
                console.log(`${size} tasks, date=${date}: avg=${avgDuration.toFixed(2)}ms, max=${maxDuration.toFixed(2)}ms`);
                
                expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLD);
                expect(avgDuration).toBeLessThan(expectedTime);
            });
        });

        describe('Time Unit Changes', () => {
            const timeUnits = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];

            test.each(timeUnits)('should handle time unit %s within threshold', async (timeUnit) => {
                const durations: number[] = [];
                
                // Test 3 times for variance
                for (let i = 0; i < 3; i++) {
                    clearLayoutCache(); // Clear cache to test fresh calculation
                    
                    const start = performance.now();
                    
                    // Update time unit
                    const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                    const stateWithTimeUnit = {
                        persistent: timeUnitResult.persistent,
                        volatile: timeUnitResult.volatile
                    };
                    
                    // Generate layout with new time unit
                    const layoutResult = updateLayout(mockApp, stateWithTimeUnit);
                    
                    const end = performance.now();
                    const duration = end - start;
                    
                    durations.push(duration);
                    
                    // Verify layout was created
                    expect(layoutResult.volatile.boardLayout).toBeDefined();
                    expect(layoutResult.volatile.boardLayout!.timeUnit).toBe(timeUnit);
                    expect(layoutResult.volatile.boardLayout!.columnHeaders).toHaveLength(8); // Should use default 8 columns
                }

                const avgDuration = durations.reduce((a, b) => a + b, 0) / 3;
                const maxDuration = Math.max(...durations);
                
                console.log(`${size} tasks, timeUnit=${timeUnit}: avg=${avgDuration.toFixed(2)}ms, max=${maxDuration.toFixed(2)}ms`);
                
                expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLD);
                expect(avgDuration).toBeLessThan(expectedTime);
            });

            test('should maintain performance during rapid time unit switching', async () => {
                const switchSequence = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH, TimeUnit.DAY, TimeUnit.MONTH, TimeUnit.WEEK];
                const durations: number[] = [];
                let currentState = baseState;
                
                const start = performance.now();
                
                for (const timeUnit of switchSequence) {
                    const timeUnitResult = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, timeUnit);
                    currentState = {
                        persistent: timeUnitResult.persistent,
                        volatile: timeUnitResult.volatile
                    };
                    
                    const layoutResult = updateLayout(mockApp, currentState);
                    
                    // Each switch should maintain column consistency
                    expect(layoutResult.volatile.boardLayout!.columnHeaders).toHaveLength(8);
                    expect(layoutResult.volatile.boardLayout!.timeUnit).toBe(timeUnit);
                    expect(currentState.volatile.timelineViewport).toBeUndefined(); // Should be cleared
                }
                
                const end = performance.now();
                const totalDuration = end - start;
                
                console.log(`${size} tasks, ${switchSequence.length} time unit switches: ${totalDuration.toFixed(2)}ms`);
                
                // Total time for all switches should be reasonable
                expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLD * 2);
            });
        });
    });

    describe('Cache Performance', () => {
        test('should demonstrate cache effectiveness', () => {
            clearLayoutCache();
            const tasks = generateRandomTasks(100);
            const state = createBaseState(tasks);

            // First call (cold cache)
            const start1 = performance.now();
            const result1 = updateLayout(mockApp, state);
            const end1 = performance.now();
            const coldDuration = end1 - start1;

            // Second call (warm cache)
            const start2 = performance.now();
            const result2 = updateLayout(mockApp, state);
            const end2 = performance.now();
            const warmDuration = end2 - start2;

            console.log(`Cache test: cold=${coldDuration.toFixed(2)}ms, warm=${warmDuration.toFixed(2)}ms`);

            // Cached call should be much faster
            expect(warmDuration).toBeLessThan(coldDuration / 2);
            expect(warmDuration).toBeLessThan(5); // Should be nearly instant

            // Results should be identical
            expect(result1.volatile.boardLayout).toEqual(result2.volatile.boardLayout);
        });
    });
});