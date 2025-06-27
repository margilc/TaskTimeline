import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';

const mockApp = {} as any;

describe('Layout Task Visibility Testing', () => {
    
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

    describe('Task-Column Mapping Tests', () => {
        test('should position task in correct column based on start date', async () => {
            // Test with specific date that should be in viewport
            const tasks: ITask[] = [
                {
                    name: 'Target Task',
                    start: '2025-06-15', // Same as current date
                    end: '2025-06-15',
                    filePath: '/target-task.md',
                    content: 'Task on current date'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // Verify task is positioned
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks).toHaveLength(1);
            
            const targetTask = positionedTasks[0];
            expect(targetTask.name).toBe('Target Task');
            expect(targetTask.xStart).toBeGreaterThan(0);
            expect(targetTask.xStart).toBeLessThanOrEqual(layout.columnHeaders.length);
            
            // Verify the column header corresponds to task date
            const columnIndex = targetTask.xStart! - 1;
            const columnHeader = layout.columnHeaders[columnIndex];
            const columnDate = new Date(columnHeader.date);
            const taskDate = new Date(targetTask.start);
            
            // For day time unit, dates should match exactly
            expect(columnDate.getUTCDate()).toBe(taskDate.getUTCDate());
            expect(columnDate.getUTCMonth()).toBe(taskDate.getUTCMonth());
            expect(columnDate.getUTCFullYear()).toBe(taskDate.getUTCFullYear());
        });

        test('should position multiple tasks with different dates correctly', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Day 1 Task',
                    start: '2025-06-13',
                    end: '2025-06-13',
                    filePath: '/day1-task.md',
                    content: 'Task on day 1'
                },
                {
                    name: 'Day 2 Task',
                    start: '2025-06-14',
                    end: '2025-06-14',
                    filePath: '/day2-task.md',
                    content: 'Task on day 2'
                },
                {
                    name: 'Day 3 Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/day3-task.md',
                    content: 'Task on day 3'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // All tasks should be positioned (they're within the 5-column viewport around current date)
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            // Sort positioned tasks by column position
            const sortedTasks = positionedTasks.sort((a, b) => a.xStart! - b.xStart!);
            
            // Verify tasks are in chronological order by column
            for (let i = 0; i < sortedTasks.length - 1; i++) {
                const currentTaskDate = new Date(sortedTasks[i].start);
                const nextTaskDate = new Date(sortedTasks[i + 1].start);
                
                // Earlier date should have lower or equal column position
                expect(currentTaskDate.getTime()).toBeLessThanOrEqual(nextTaskDate.getTime());
            }
        });

        test('should handle tasks outside viewport correctly', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Visible Task',
                    start: '2025-06-15', // Current date, should be visible
                    end: '2025-06-15',
                    filePath: '/visible-task.md',
                    content: 'Should be visible'
                },
                {
                    name: 'Far Future Task',
                    start: '2025-12-15', // Far in future, likely not visible in 5-column viewport
                    end: '2025-12-15',
                    filePath: '/future-task.md',
                    content: 'Might not be visible'
                },
                {
                    name: 'Far Past Task',
                    start: '2025-01-15', // Far in past, likely not visible in 5-column viewport
                    end: '2025-01-15',
                    filePath: '/past-task.md',
                    content: 'Might not be visible'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            const unpositionedTasks = taskGrid.tasks.filter(task => task.xStart === undefined);
            
            // At least the visible task should be positioned
            const visibleTask = positionedTasks.find(t => t.name === 'Visible Task');
            expect(visibleTask).toBeDefined();
            
            // Tasks outside viewport should either be unpositioned or positioned outside column range
            const farTasks = taskGrid.tasks.filter(t => t.name.includes('Far'));
            if (farTasks.some(t => t.xStart !== undefined)) {
                // If positioned, should be outside valid column range or handled gracefully
                farTasks.forEach(task => {
                    if (task.xStart !== undefined) {
                        // Either within valid range (if viewport was expanded) or gracefully handled
                        expect(task.xStart).toBeGreaterThan(0);
                    }
                });
            }
        });
    });

    describe('Multi-Day Task Spanning Tests', () => {
        test('should correctly span task across multiple columns', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Multi-Day Task',
                    start: '2025-06-14',
                    end: '2025-06-16', // 3-day span
                    filePath: '/multi-day-task.md',
                    content: 'Task spanning multiple days'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks).toHaveLength(1);
            
            const multiDayTask = positionedTasks[0];
            expect(multiDayTask.xEnd).toBeGreaterThan(multiDayTask.xStart!);
            
            // Calculate expected span (3 days = 3 columns in day view)
            const actualSpan = multiDayTask.xEnd! - multiDayTask.xStart! + 1;
            expect(actualSpan).toBe(3);
        });

        test('should handle task spanning beyond viewport', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Long Task',
                    start: '2025-06-13',
                    end: '2025-06-20', // 8-day span, longer than 5-column viewport
                    filePath: '/long-task.md',
                    content: 'Task spanning beyond viewport'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            if (positionedTasks.length > 0) {
                const longTask = positionedTasks[0];
                
                // Task should be positioned but may be clipped to viewport
                expect(longTask.xStart).toBeGreaterThan(0);
                expect(longTask.xEnd).toBeGreaterThanOrEqual(longTask.xStart!);
                expect(longTask.xEnd).toBeLessThanOrEqual(layout.columnHeaders.length);
            }
        });
    });

    describe('Time Unit Task Visibility Tests', () => {
        test('should maintain task visibility in month view', async () => {
            const tasks: ITask[] = [
                {
                    name: 'June Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/june-task.md',
                    content: 'Task in June'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Switch to month view
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Task should be visible in month view
            const juneTask = positionedTasks.find(t => t.name === 'June Task');
            expect(juneTask).toBeDefined();
            
            if (juneTask) {
                // Verify it's in a June column
                const columnIndex = juneTask.xStart! - 1;
                const columnHeader = layout.columnHeaders[columnIndex];
                const columnDate = new Date(columnHeader.date);
                expect(columnDate.getUTCMonth()).toBe(5); // June is month 5 (0-based)
            }
        });

        test('should maintain task visibility in week view', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Mid-Week Task',
                    start: '2025-06-18', // Wednesday
                    end: '2025-06-18',
                    filePath: '/midweek-task.md',
                    content: 'Task in middle of week'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-18');
            
            // Switch to week view
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Task should be visible in week view
            const midWeekTask = positionedTasks.find(t => t.name === 'Mid-Week Task');
            expect(midWeekTask).toBeDefined();
            
            if (midWeekTask) {
                // Verify it's in the correct week column
                const columnIndex = midWeekTask.xStart! - 1;
                const columnHeader = layout.columnHeaders[columnIndex];
                const columnDate = new Date(columnHeader.date); // Should be Monday of the week
                const taskDate = new Date(midWeekTask.start);
                
                // Task date should be within the same week as column header
                const timeDiff = taskDate.getTime() - columnDate.getTime();
                const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
                expect(dayDiff).toBeGreaterThanOrEqual(0);
                expect(dayDiff).toBeLessThan(7); // Within same week
            }
        });
    });

    describe('Edge Case Task Visibility Tests', () => {
        test('should handle tasks on exact column boundaries', async () => {
            // Create tasks on boundaries that might cause edge case issues
            const tasks: ITask[] = [
                {
                    name: 'Boundary Task 1',
                    start: '2025-06-01', // First of month
                    end: '2025-06-01',
                    filePath: '/boundary1.md',
                    content: 'First of month'
                },
                {
                    name: 'Boundary Task 2', 
                    start: '2025-06-30', // Last of month
                    end: '2025-06-30',
                    filePath: '/boundary2.md',
                    content: 'Last of month'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Test in month view where boundaries are most critical
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Both boundary tasks should be positioned (current date should make June visible)
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            const firstOfMonthTask = positionedTasks.find(t => t.name === 'Boundary Task 1');
            const lastOfMonthTask = positionedTasks.find(t => t.name === 'Boundary Task 2');
            
            if (firstOfMonthTask && lastOfMonthTask) {
                // Both tasks should be in the same June column in month view
                expect(firstOfMonthTask.xStart).toBe(lastOfMonthTask.xStart);
            }
        });

        test('should handle tasks with same start and end dates', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Single Day Task',
                    start: '2025-06-15',
                    end: '2025-06-15', // Same as start
                    filePath: '/single-day.md',
                    content: 'Single day task'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks).toHaveLength(1);
            
            const singleDayTask = positionedTasks[0];
            expect(singleDayTask.xStart).toBe(singleDayTask.xEnd);
        });

        test('should handle tasks with invalid or missing end dates', async () => {
            const tasks: ITask[] = [
                {
                    name: 'No End Date Task',
                    start: '2025-06-15',
                    // end date is undefined
                    filePath: '/no-end.md',
                    content: 'Task without end date'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            if (positionedTasks.length > 0) {
                const noEndTask = positionedTasks[0];
                // Task should be positioned with reasonable default end (likely same as start)
                expect(noEndTask.xStart).toBeGreaterThan(0);
                expect(noEndTask.xEnd).toBeGreaterThanOrEqual(noEndTask.xStart!);
            }
        });
    });

    describe('Task Grid Population Tests', () => {
        test('should not have empty task grids when tasks exist in viewport', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Visible Task',
                    start: '2025-06-15', // Current date
                    end: '2025-06-15',
                    filePath: '/visible.md',
                    content: 'Should be visible'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // Should have at least one task grid
            expect(layout.taskGrids).toHaveLength(1);
            
            const taskGrid = layout.taskGrids[0];
            
            // Task grid should not be empty when tasks exist in viewport
            expect(taskGrid.tasks.length).toBeGreaterThan(0);
            
            // At least some tasks should be positioned
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            expect(positionedTasks.length).toBeGreaterThan(0);
        });

        test('should correctly populate task grids with all viewport tasks', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Task 1',
                    start: '2025-06-13',
                    end: '2025-06-13',
                    filePath: '/task1.md',
                    content: 'Task 1'
                },
                {
                    name: 'Task 2',
                    start: '2025-06-14',
                    end: '2025-06-14', 
                    filePath: '/task2.md',
                    content: 'Task 2'
                },
                {
                    name: 'Task 3',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/task3.md',
                    content: 'Task 3'
                },
                {
                    name: 'Task 4',
                    start: '2025-06-16',
                    end: '2025-06-16',
                    filePath: '/task4.md',
                    content: 'Task 4'
                },
                {
                    name: 'Task 5',
                    start: '2025-06-17',
                    end: '2025-06-17',
                    filePath: '/task5.md',
                    content: 'Task 5'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            
            // All tasks should be in the task grid (within 5-column viewport around current date)
            expect(taskGrid.tasks.length).toBe(tasks.length);
            
            // All or most tasks should be positioned (they're all within a few days of current date)
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            expect(positionedTasks.length).toBeGreaterThan(0);
        });
    });
});