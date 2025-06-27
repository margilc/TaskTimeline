import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';

const mockApp = {} as any;

describe('Layout Real-World Scenarios Testing', () => {
    
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

    // Helper to create tasks from the debug dump scenario
    function createDebugDumpTasks(): ITask[] {
        return [
            {
                name: "DO THIS THING",
                start: "2025-03-24",
                end: "2025-04-24",
                filePath: "Taskdown/Funky Project/20250114_DO_THIS_THING.md",
                status: "unknown",
                priority: 1,
                content: "DO THIS THING content"
            },
            {
                name: "TEST",
                start: "2025-02-17",
                end: "2025-02-21",
                filePath: "Taskdown/Funky Project/20250214_TEST.md",
                status: "In Progress",
                priority: 1,
                content: "TEST content"
            },
            {
                name: "TEST2",
                start: "2025-06-30",
                end: "2025-06-30",
                filePath: "Taskdown/Funky Project/20250214_TEST2.md",
                status: "In Progress",
                priority: 1,
                content: "TEST2 content"
            }
        ];
    }

    describe('Debug Dump Scenario Recreation', () => {
        test('should properly position TEST2 task on 2025-06-30 in month view', async () => {
            const tasks = createDebugDumpTasks();
            const baseState = createBaseState(tasks, '2025-06-27'); // Close to current date
            
            // Switch to month view (matching the debug dump)
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            // Should have month time unit
            expect(layout.timeUnit).toBe(TimeUnit.MONTH);
            expect(layout.columnHeaders).toHaveLength(5);
            
            // Find the TEST2 task (2025-06-30)
            const taskGrid = layout.taskGrids[0];
            const test2Task = taskGrid.tasks.find(t => t.name === 'TEST2');
            
            expect(test2Task).toBeDefined();
            
            // TEST2 task should be positioned (not empty task grids)
            if (test2Task && test2Task.xStart !== undefined) {
                expect(test2Task.xStart).toBeGreaterThan(0);
                expect(test2Task.xStart).toBeLessThanOrEqual(layout.columnHeaders.length);
                
                // Verify it's in a June column
                const columnIndex = test2Task.xStart - 1;
                const columnHeader = layout.columnHeaders[columnIndex];
                const columnDate = new Date(columnHeader.date);
                expect(columnDate.getUTCMonth()).toBe(5); // June is month 5 (0-based)
                expect(columnDate.getUTCDate()).toBe(1); // Should be June 1st, not May 31st
            } else {
                // If not positioned, this indicates the bug we're trying to fix
                throw new Error('TEST2 task should be positioned when June is visible in month view');
            }
        });

        test('should show correct month boundaries (not May 31st for May column)', async () => {
            const tasks = createDebugDumpTasks();
            const baseState = createBaseState(tasks, '2025-06-27');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            // All month column headers should start on 1st of month
            layout.columnHeaders.forEach(header => {
                const headerDate = new Date(header.date);
                expect(headerDate.getUTCDate()).toBe(1); // Must be 1st, not 31st of previous month
                
                // Verify label matches the actual month
                const expectedMonth = headerDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                expect(header.label).toBe(expectedMonth);
            });
        });

        test('should not have empty taskGrids when tasks exist in visible timeframe', async () => {
            const tasks = createDebugDumpTasks();
            const baseState = createBaseState(tasks, '2025-06-27');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            // Should have task grids
            expect(layout.taskGrids).toHaveLength(1); // Assuming no grouping
            
            const taskGrid = layout.taskGrids[0];
            
            // Task grid should only contain positioned tasks (visible in viewport)
            // With current date 2025-06-27 in month view, TEST2 (2025-06-30) should be visible in June
            // but other tasks (Feb, March-April) should not be visible
            expect(taskGrid.tasks.length).toBeGreaterThan(0);
            expect(taskGrid.tasks.length).toBeLessThanOrEqual(3);
            
            // All tasks in taskGrid should be positioned
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            expect(positionedTasks.length).toBe(taskGrid.tasks.length);
            
            // Specifically, TEST2 should be positioned since June should be visible
            const test2Task = positionedTasks.find(t => t.name === 'TEST2');
            expect(test2Task).toBeDefined();
        });
    });

    describe('Current Date Edge Cases', () => {
        test('should handle current date at start of month', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Month Start Task',
                    start: '2025-06-01',
                    end: '2025-06-01',
                    filePath: '/month-start.md',
                    content: 'First day of month'
                },
                {
                    name: 'Month End Task',
                    start: '2025-06-30',
                    end: '2025-06-30',
                    filePath: '/month-end.md',
                    content: 'Last day of month'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-01');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Both tasks should be positioned in June column
            expect(positionedTasks.length).toBe(2);
            
            const monthStartTask = positionedTasks.find(t => t.name === 'Month Start Task');
            const monthEndTask = positionedTasks.find(t => t.name === 'Month End Task');
            
            expect(monthStartTask).toBeDefined();
            expect(monthEndTask).toBeDefined();
            
            // Both should be in same month column
            if (monthStartTask && monthEndTask) {
                expect(monthStartTask.xStart).toBe(monthEndTask.xStart);
            }
        });

        test('should handle current date at end of month', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Current Month Task',
                    start: '2025-06-30',
                    end: '2025-06-30',
                    filePath: '/current-month.md',
                    content: 'Current month task'
                },
                {
                    name: 'Next Month Task',
                    start: '2025-07-01',
                    end: '2025-07-01',
                    filePath: '/next-month.md',
                    content: 'Next month task'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-30');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            const currentMonthTask = positionedTasks.find(t => t.name === 'Current Month Task');
            const nextMonthTask = positionedTasks.find(t => t.name === 'Next Month Task');
            
            // Current month task should definitely be positioned
            expect(currentMonthTask).toBeDefined();
            
            // Next month task might also be visible depending on viewport
            if (currentMonthTask && nextMonthTask) {
                // Should be in different columns
                expect(currentMonthTask.xStart).not.toBe(nextMonthTask.xStart);
            }
        });

        test('should handle current date in middle of time period', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Before Current Task',
                    start: '2025-06-13', // Closer to current date
                    end: '2025-06-13',
                    filePath: '/before-current.md',
                    content: 'Before current date'
                },
                {
                    name: 'Current Date Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/current-date.md',
                    content: 'On current date'
                },
                {
                    name: 'After Current Task',
                    start: '2025-06-17', // Closer to current date
                    end: '2025-06-17',
                    filePath: '/after-current.md',
                    content: 'After current date'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Test in day view for precise positioning
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Tasks within the 5-day viewport around current date should be positioned
            expect(positionedTasks.length).toBeGreaterThan(0);
            expect(positionedTasks.length).toBeLessThanOrEqual(3);
            
            // If multiple tasks are positioned, they should be in chronological order
            if (positionedTasks.length > 1) {
                const sortedTasks = positionedTasks.sort((a, b) => a.xStart! - b.xStart!);
                
                // Verify chronological order by start date
                for (let i = 0; i < sortedTasks.length - 1; i++) {
                    const currentTaskDate = new Date(sortedTasks[i].start);
                    const nextTaskDate = new Date(sortedTasks[i + 1].start);
                    expect(currentTaskDate.getTime()).toBeLessThanOrEqual(nextTaskDate.getTime());
                }
            }
            
            // At minimum, the current date task should be positioned
            const currentDateTask = positionedTasks.find(t => t.name === 'Current Date Task');
            expect(currentDateTask).toBeDefined();
        });
    });

    describe('Multi-Month Spanning Tests', () => {
        test('should handle tasks spanning multiple months in month view', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Multi-Month Task',
                    start: '2025-05-15',
                    end: '2025-07-15', // Spans May, June, July
                    filePath: '/multi-month.md',
                    content: 'Task spanning multiple months'
                },
                {
                    name: 'June Only Task',
                    start: '2025-06-10',
                    end: '2025-06-20',
                    filePath: '/june-only.md',
                    content: 'Task only in June'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            const multiMonthTask = positionedTasks.find(t => t.name === 'Multi-Month Task');
            const juneOnlyTask = positionedTasks.find(t => t.name === 'June Only Task');
            
            if (multiMonthTask) {
                // Multi-month task should span multiple columns
                expect(multiMonthTask.xEnd).toBeGreaterThan(multiMonthTask.xStart!);
                
                // Should span at least 2 months (May to July would be 3 months)
                const span = multiMonthTask.xEnd! - multiMonthTask.xStart! + 1;
                expect(span).toBeGreaterThanOrEqual(2);
            }
            
            if (juneOnlyTask) {
                // June-only task should be in single column or span appropriately
                expect(juneOnlyTask.xStart).toBeGreaterThan(0);
                expect(juneOnlyTask.xEnd).toBeGreaterThanOrEqual(juneOnlyTask.xStart!);
            }
        });

        test('should handle year-boundary tasks correctly', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Year End Task',
                    start: '2024-12-15',
                    end: '2024-12-31',
                    filePath: '/year-end.md',
                    content: 'End of 2024'
                },
                {
                    name: 'Year Start Task',
                    start: '2025-01-01',
                    end: '2025-01-15',
                    filePath: '/year-start.md',
                    content: 'Start of 2025'
                },
                {
                    name: 'Cross Year Task',
                    start: '2024-12-20',
                    end: '2025-01-10',
                    filePath: '/cross-year.md',
                    content: 'Crosses year boundary'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-01-01');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            // Should handle year boundary without errors
            expect(layout.columnHeaders).toHaveLength(5);
            expect(layout.timeUnit).toBe(TimeUnit.MONTH);
            
            const taskGrid = layout.taskGrids[0];
            
            // All tasks should be present in task grid
            expect(taskGrid.tasks).toHaveLength(3);
            
            // Some tasks should be positioned (at least those visible in current timeframe)
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            expect(positionedTasks.length).toBeGreaterThan(0);
        });
    });

    describe('Future/Past Date Scenarios', () => {
        test('should handle tasks far in the future', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Current Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/current.md',
                    content: 'Current task'
                },
                {
                    name: 'Far Future Task',
                    start: '2030-06-15',
                    end: '2030-06-15',
                    filePath: '/far-future.md',
                    content: 'Far in future'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            
            // taskGrid should only contain positioned tasks
            // Far future task won't be positioned in 5-column viewport around 2025-06-15
            expect(taskGrid.tasks.length).toBeGreaterThan(0);
            expect(taskGrid.tasks.length).toBeLessThanOrEqual(2);
            
            // Current task should be positioned and in taskGrid
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            const currentTask = positionedTasks.find(t => t.name === 'Current Task');
            expect(currentTask).toBeDefined();
            
            // All tasks in taskGrid should be positioned
            expect(positionedTasks.length).toBe(taskGrid.tasks.length);
        });

        test('should handle tasks far in the past', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Current Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/current.md',
                    content: 'Current task'
                },
                {
                    name: 'Far Past Task',
                    start: '2020-06-15',
                    end: '2020-06-15',
                    filePath: '/far-past.md',
                    content: 'Far in past'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            
            // taskGrid should only contain positioned tasks
            // Far past task won't be positioned in 5-column viewport around 2025-06-15
            expect(taskGrid.tasks.length).toBeGreaterThan(0);
            expect(taskGrid.tasks.length).toBeLessThanOrEqual(2);
            
            // Current task should be positioned and in taskGrid
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            const currentTask = positionedTasks.find(t => t.name === 'Current Task');
            expect(currentTask).toBeDefined();
            
            // All tasks in taskGrid should be positioned
            expect(positionedTasks.length).toBe(taskGrid.tasks.length);
        });
    });

    describe('Complex Real-World Combinations', () => {
        test('should handle mixed duration tasks with different time units', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Single Day',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/single-day.md',
                    content: 'One day task'
                },
                {
                    name: 'One Week',
                    start: '2025-06-10',
                    end: '2025-06-16',
                    filePath: '/one-week.md',
                    content: 'One week task'
                },
                {
                    name: 'One Month',
                    start: '2025-06-01',
                    end: '2025-06-30',
                    filePath: '/one-month.md',
                    content: 'One month task'
                },
                {
                    name: 'Multi-Month',
                    start: '2025-05-01',
                    end: '2025-07-31',
                    filePath: '/multi-month.md',
                    content: 'Multi-month task'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Test in different time units
            const timeUnits = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];
            
            for (const timeUnit of timeUnits) {
                const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                const stateWithTimeUnit = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                const result = updateLayout(mockApp, stateWithTimeUnit);
                const layout = result.volatile.boardLayout!;
                
                expect(layout.timeUnit).toBe(timeUnit);
                expect(layout.columnHeaders).toHaveLength(5);
                
                const taskGrid = layout.taskGrids[0];
                const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
                
                // At least some tasks should be positioned
                expect(positionedTasks.length).toBeGreaterThan(0);
                
                // All positioned tasks should have valid coordinates
                positionedTasks.forEach(task => {
                    expect(task.xStart).toBeGreaterThan(0);
                    expect(task.xEnd).toBeGreaterThanOrEqual(task.xStart!);
                    expect(task.y).toBeGreaterThanOrEqual(0);
                });
            }
        });

        test('should handle project switching scenario', async () => {
            // Simulate switching between different sets of tasks (like changing projects)
            const project1Tasks: ITask[] = [
                {
                    name: 'Project 1 Task A',
                    start: '2025-06-10',
                    end: '2025-06-15',
                    filePath: '/p1-task-a.md',
                    content: 'Project 1 task A'
                },
                {
                    name: 'Project 1 Task B',
                    start: '2025-06-16',
                    end: '2025-06-20',
                    filePath: '/p1-task-b.md',
                    content: 'Project 1 task B'
                }
            ];
            
            const project2Tasks: ITask[] = [
                {
                    name: 'Project 2 Task X',
                    start: '2025-06-12',
                    end: '2025-06-18',
                    filePath: '/p2-task-x.md',
                    content: 'Project 2 task X'
                },
                {
                    name: 'Project 2 Task Y',
                    start: '2025-06-19',
                    end: '2025-06-25',
                    filePath: '/p2-task-y.md',
                    content: 'Project 2 task Y'
                }
            ];
            
            const baseDate = '2025-06-15';
            
            // Layout with project 1
            const state1 = createBaseState(project1Tasks, baseDate);
            const result1 = updateLayout(mockApp, state1);
            const layout1 = result1.volatile.boardLayout!;
            
            const taskGrid1 = layout1.taskGrids[0];
            const positioned1 = taskGrid1.tasks.filter(task => task.xStart !== undefined);
            
            expect(positioned1.length).toBeGreaterThan(0);
            expect(positioned1.some(t => t.name.includes('Project 1'))).toBe(true);
            
            // Layout with project 2
            const state2 = createBaseState(project2Tasks, baseDate);
            const result2 = updateLayout(mockApp, state2);
            const layout2 = result2.volatile.boardLayout!;
            
            const taskGrid2 = layout2.taskGrids[0];
            const positioned2 = taskGrid2.tasks.filter(task => task.xStart !== undefined);
            
            expect(positioned2.length).toBeGreaterThan(0);
            expect(positioned2.some(t => t.name.includes('Project 2'))).toBe(true);
            
            // Both layouts should have same viewport structure
            expect(layout1.columnHeaders.length).toBe(layout2.columnHeaders.length);
            expect(layout1.viewport.startDate.getTime()).toBe(layout2.viewport.startDate.getTime());
            expect(layout1.viewport.endDate.getTime()).toBe(layout2.viewport.endDate.getTime());
        });
    });
});