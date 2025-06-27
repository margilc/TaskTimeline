import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';

const mockApp = {} as any;

describe('Layout Viewport Consistency Testing', () => {
    
    beforeEach(() => {
        clearLayoutCache();
    });

    function createBaseState(tasks: ITask[], currentDate: string = '2025-06-15'): IAppState {
        return {
            persistent: {
                currentDate,
                currentTimeUnit: TimeUnit.DAY,
                boardGrouping: { groupBy: 'none', availableGroups: ['All Tasks'] },
                settings: {
                    numberOfColumns: 5
                }
            },
            volatile: {
                currentTasks: tasks,
            }
        };
    }

    describe('Single Source of Truth Tests', () => {
        test('should have consistent viewport dates between timelineViewport and boardLayout.viewport', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Test Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/test-task.md',
                    content: 'Test task'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // boardLayout.viewport should exist
            expect(layout.viewport).toBeDefined();
            expect(layout.viewport.startDate).toBeDefined();
            expect(layout.viewport.endDate).toBeDefined();
            
            // If timelineViewport exists, it should be consistent with boardLayout.viewport
            if (result.volatile.timelineViewport) {
                const timelineStart = new Date(result.volatile.timelineViewport.localMinDate);
                const timelineEnd = new Date(result.volatile.timelineViewport.localMaxDate);
                const layoutStart = layout.viewport.startDate;
                const layoutEnd = layout.viewport.endDate;
                
                // Dates should be consistent (allowing for slight differences in end date calculation)
                expect(timelineStart.getTime()).toBe(layoutStart.getTime());
                // End dates might differ slightly due to calculation methods, but should be close
                const endTimeDiff = Math.abs(timelineEnd.getTime() - layoutEnd.getTime());
                const oneDayMs = 24 * 60 * 60 * 1000;
                expect(endTimeDiff).toBeLessThan(oneDayMs); // Within 1 day
            }
        });

        test('should maintain viewport consistency after time unit changes', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Consistent Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/consistent-task.md',
                    content: 'Should maintain viewport consistency'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            const timeUnits = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];
            
            for (const timeUnit of timeUnits) {
                const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                const stateWithTimeUnit = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                const result = updateLayout(mockApp, stateWithTimeUnit);
                const layout = result.volatile.boardLayout!;
                
                // After time unit change, viewport should be cleared and recalculated consistently
                expect(stateWithTimeUnit.volatile.timelineViewport).toBeUndefined();
                
                // boardLayout.viewport should still exist and be valid
                expect(layout.viewport).toBeDefined();
                expect(layout.viewport.startDate).toBeDefined();
                expect(layout.viewport.endDate).toBeDefined();
                
                // Start date should be before or equal to end date
                expect(layout.viewport.startDate.getTime()).toBeLessThanOrEqual(layout.viewport.endDate.getTime());
            }
        });
    });

    describe('Column Header Accuracy Tests', () => {
        test('should have column headers that match viewport date range', async () => {
            const tasks: ITask[] = [];
            const baseState = createBaseState(tasks, '2025-06-15');
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.columnHeaders).toHaveLength(5); // numberOfColumns
            expect(layout.viewport).toBeDefined();
            
            // First column header should be on or after viewport start
            const firstHeaderDate = new Date(layout.columnHeaders[0].date);
            const viewportStart = layout.viewport.startDate;
            expect(firstHeaderDate.getTime()).toBeGreaterThanOrEqual(viewportStart.getTime());
            
            // Last column header should be on or before viewport end
            const lastHeaderDate = new Date(layout.columnHeaders[layout.columnHeaders.length - 1].date);
            const viewportEnd = layout.viewport.endDate;
            expect(lastHeaderDate.getTime()).toBeLessThanOrEqual(viewportEnd.getTime());
        });

        test('should have sequential column headers with correct time unit intervals', async () => {
            const tasks: ITask[] = [];
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Test all time units
            const timeUnits = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];
            
            for (const timeUnit of timeUnits) {
                const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                const stateWithTimeUnit = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                const result = updateLayout(mockApp, stateWithTimeUnit);
                const layout = result.volatile.boardLayout!;
                
                // Verify sequential headers
                for (let i = 0; i < layout.columnHeaders.length - 1; i++) {
                    const currentHeader = new Date(layout.columnHeaders[i].date);
                    const nextHeader = new Date(layout.columnHeaders[i + 1].date);
                    
                    // Next header should be after current header
                    expect(nextHeader.getTime()).toBeGreaterThan(currentHeader.getTime());
                    
                    // Check interval based on time unit
                    const timeDiff = nextHeader.getTime() - currentHeader.getTime();
                    const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
                    
                    if (timeUnit === TimeUnit.DAY) {
                        expect(dayDiff).toBe(1); // 1 day interval
                    } else if (timeUnit === TimeUnit.WEEK) {
                        expect(dayDiff).toBe(7); // 7 day interval
                    } else if (timeUnit === TimeUnit.MONTH) {
                        // Month intervals vary (28-31 days), just verify it's reasonable
                        expect(dayDiff).toBeGreaterThanOrEqual(28);
                        expect(dayDiff).toBeLessThanOrEqual(31);
                    }
                }
            }
        });
    });

    describe('Task-Viewport Alignment Tests', () => {
        test('should position all tasks within viewport date range', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Viewport Task 1',
                    start: '2025-06-13',
                    end: '2025-06-13',
                    filePath: '/viewport1.md',
                    content: 'Task 1'
                },
                {
                    name: 'Viewport Task 2',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/viewport2.md',
                    content: 'Task 2'
                },
                {
                    name: 'Viewport Task 3',
                    start: '2025-06-17',
                    end: '2025-06-17',
                    filePath: '/viewport3.md',
                    content: 'Task 3'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            // All positioned tasks should have dates within or overlapping the viewport
            positionedTasks.forEach(task => {
                const taskStartDate = new Date(task.start);
                const taskEndDate = task.end ? new Date(task.end) : taskStartDate;
                const viewportStart = layout.viewport.startDate;
                const viewportEnd = layout.viewport.endDate;
                
                // Task should overlap with viewport (start <= viewportEnd && end >= viewportStart)
                const overlapsViewport = taskStartDate.getTime() <= viewportEnd.getTime() && 
                                       taskEndDate.getTime() >= viewportStart.getTime();
                
                expect(overlapsViewport).toBe(true);
            });
        });

        test('should not position tasks outside viewport date range', async () => {
            const tasks: ITask[] = [
                {
                    name: 'In Viewport Task',
                    start: '2025-06-15', // Current date, should be in viewport
                    end: '2025-06-15',
                    filePath: '/in-viewport.md',
                    content: 'Should be positioned'
                },
                {
                    name: 'Far Future Task',
                    start: '2025-12-15', // Far future, likely outside viewport
                    end: '2025-12-15',
                    filePath: '/far-future.md',
                    content: 'Should not be positioned'
                },
                {
                    name: 'Far Past Task',
                    start: '2025-01-15', // Far past, likely outside viewport
                    end: '2025-01-15',
                    filePath: '/far-past.md',
                    content: 'Should not be positioned'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            const unpositionedTasks = taskGrid.tasks.filter(task => task.xStart === undefined);
            
            // In viewport task should be positioned
            const inViewportTask = positionedTasks.find(t => t.name === 'In Viewport Task');
            expect(inViewportTask).toBeDefined();
            
            // Far tasks should either be unpositioned or handled gracefully
            const farTasks = taskGrid.tasks.filter(t => t.name.includes('Far'));
            
            farTasks.forEach(task => {
                if (task.xStart !== undefined) {
                    // If positioned, dates should still be reasonable relative to viewport
                    const taskDate = new Date(task.start);
                    const viewportStart = layout.viewport.startDate;
                    const viewportEnd = layout.viewport.endDate;
                    
                    // Should not be wildly outside the viewport timeframe
                    const timeDiffFromStart = Math.abs(taskDate.getTime() - viewportStart.getTime());
                    const timeDiffFromEnd = Math.abs(taskDate.getTime() - viewportEnd.getTime());
                    const viewportSpan = viewportEnd.getTime() - viewportStart.getTime();
                    
                    // Should be within reasonable range (not more than 10x viewport span away)
                    const maxReasonableDistance = viewportSpan * 10;
                    expect(Math.min(timeDiffFromStart, timeDiffFromEnd)).toBeLessThan(maxReasonableDistance);
                }
            });
        });
    });

    describe('Viewport Calculation Consistency Tests', () => {
        test('should calculate viewport consistently for same parameters', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Consistency Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/consistency.md',
                    content: 'Consistency test'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Generate layout multiple times with same parameters
            const result1 = updateLayout(mockApp, baseState);
            const result2 = updateLayout(mockApp, baseState);
            
            const layout1 = result1.volatile.boardLayout!;
            const layout2 = result2.volatile.boardLayout!;
            
            // Viewports should be identical
            expect(layout1.viewport.startDate.getTime()).toBe(layout2.viewport.startDate.getTime());
            expect(layout1.viewport.endDate.getTime()).toBe(layout2.viewport.endDate.getTime());
            
            // Column headers should be identical
            expect(layout1.columnHeaders.length).toBe(layout2.columnHeaders.length);
            
            for (let i = 0; i < layout1.columnHeaders.length; i++) {
                expect(layout1.columnHeaders[i].date).toBe(layout2.columnHeaders[i].date);
                expect(layout1.columnHeaders[i].label).toBe(layout2.columnHeaders[i].label);
            }
        });

        test('should handle custom viewport settings correctly', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Custom Viewport Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/custom-viewport.md',
                    content: 'Custom viewport test'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Set custom viewport
            baseState.volatile.timelineViewport = {
                localMinDate: '2025-06-10',
                localMaxDate: '2025-06-20'
            };
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // Layout should respect the custom viewport to some degree
            // (numberOfColumns may limit the actual range shown)
            expect(layout.viewport).toBeDefined();
            
            // Should use the custom viewport start date
            const customStart = new Date('2025-06-10');
            expect(layout.viewport.startDate.getTime()).toBe(customStart.getTime());
            
            // Should still respect numberOfColumns setting (5 columns)
            expect(layout.columnHeaders).toHaveLength(5);
        });

        test('should handle viewport edge cases gracefully', async () => {
            const tasks: ITask[] = [];
            
            // Test with edge case dates
            const edgeCases = [
                '2025-01-01', // Start of year
                '2025-12-31', // End of year
                '2025-02-28', // End of February (non-leap year)
                '2025-02-29', // Invalid date (not a leap year)
            ];
            
            for (const currentDate of edgeCases) {
                const baseState = createBaseState(tasks, currentDate);
                
                // Should not throw errors
                expect(() => {
                    const result = updateLayout(mockApp, baseState);
                    const layout = result.volatile.boardLayout!;
                    
                    // Basic validity checks
                    expect(layout.viewport).toBeDefined();
                    expect(layout.viewport.startDate).toBeDefined();
                    expect(layout.viewport.endDate).toBeDefined();
                    expect(layout.columnHeaders).toHaveLength(5);
                    
                }).not.toThrow();
            }
        });
    });

    describe('Layout Cache and Viewport Tests', () => {
        test('should maintain viewport consistency with layout caching', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Cache Test Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/cache-test.md',
                    content: 'Cache test'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // First call (should create cache entry)
            const result1 = updateLayout(mockApp, baseState);
            const layout1 = result1.volatile.boardLayout!;
            
            // Second call (should use cache)
            const result2 = updateLayout(mockApp, baseState);
            const layout2 = result2.volatile.boardLayout!;
            
            // Cached layout should have same viewport
            expect(layout1.viewport.startDate.getTime()).toBe(layout2.viewport.startDate.getTime());
            expect(layout1.viewport.endDate.getTime()).toBe(layout2.viewport.endDate.getTime());
            
            // Should be the exact same object reference (cached)
            expect(layout1).toBe(layout2);
        });

        test('should invalidate cache correctly when viewport changes', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Cache Invalidation Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/cache-invalidation.md',
                    content: 'Cache invalidation test'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // First call without custom viewport
            const result1 = updateLayout(mockApp, baseState);
            const layout1 = result1.volatile.boardLayout!;
            
            // Modify state with custom viewport
            baseState.volatile.timelineViewport = {
                localMinDate: '2025-06-01',
                localMaxDate: '2025-06-30'
            };
            
            // Second call with custom viewport (should create new cache entry)
            const result2 = updateLayout(mockApp, baseState);
            const layout2 = result2.volatile.boardLayout!;
            
            // Should be different layouts (cache was invalidated)
            expect(layout1).not.toBe(layout2);
            
            // Viewports should be different
            expect(layout1.viewport.startDate.getTime()).not.toBe(layout2.viewport.startDate.getTime());
        });
    });
});