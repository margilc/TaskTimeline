import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';

const mockApp = {} as any;

describe('Layout Date Boundaries Testing', () => {
    
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

    describe('Month Boundary Tests', () => {
        test('should show correct month start dates in column headers', async () => {
            const tasks: ITask[] = [];
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Set time unit to month
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.timeUnit).toBe(TimeUnit.MONTH);
            expect(layout.columnHeaders).toHaveLength(5);
            
            // Each month column should start on the 1st of the month
            layout.columnHeaders.forEach(header => {
                const headerDate = new Date(header.date);
                expect(headerDate.getUTCDate()).toBe(1); // Should be 1st day of month
                expect(header.label).toMatch(/^\w{3} \d{4}$/); // Should be "Mon YYYY" format
            });
        });

        test('should place tasks in correct month columns', async () => {
            const tasks: ITask[] = [
                {
                    name: 'June Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/june-task.md',
                    content: 'June task content'
                },
                {
                    name: 'July Task', 
                    start: '2025-07-10',
                    end: '2025-07-10',
                    filePath: '/july-task.md',
                    content: 'July task content'
                },
                {
                    name: 'May Task',
                    start: '2025-05-20',
                    end: '2025-05-20', 
                    filePath: '/may-task.md',
                    content: 'May task content'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Set time unit to month
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
            
            // Find tasks by name and verify their column positions
            const juneTask = positionedTasks.find(t => t.name === 'June Task');
            const julyTask = positionedTasks.find(t => t.name === 'July Task');
            const mayTask = positionedTasks.find(t => t.name === 'May Task');
            
            if (juneTask) {
                // June task should be in a June column
                const juneColumnIndex = juneTask.xStart! - 1;
                const juneHeader = layout.columnHeaders[juneColumnIndex];
                const juneHeaderDate = new Date(juneHeader.date);
                expect(juneHeaderDate.getUTCMonth()).toBe(5); // June is month 5 (0-based)
            }
            
            if (julyTask) {
                // July task should be in a July column
                const julyColumnIndex = julyTask.xStart! - 1;
                const julyHeader = layout.columnHeaders[julyColumnIndex];
                const julyHeaderDate = new Date(julyHeader.date);
                expect(julyHeaderDate.getUTCMonth()).toBe(6); // July is month 6 (0-based)
            }
        });

        test('should handle month boundary edge cases', async () => {
            const tasks: ITask[] = [
                {
                    name: 'End of May',
                    start: '2025-05-31',
                    end: '2025-05-31',
                    filePath: '/end-may.md',
                    content: 'End of May task'
                },
                {
                    name: 'Start of June',
                    start: '2025-06-01', 
                    end: '2025-06-01',
                    filePath: '/start-june.md',
                    content: 'Start of June task'
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
            
            const mayTask = positionedTasks.find(t => t.name === 'End of May');
            const juneTask = positionedTasks.find(t => t.name === 'Start of June');
            
            // Tasks should be in different columns (different months)
            if (mayTask && juneTask) {
                expect(mayTask.xStart).not.toBe(juneTask.xStart);
            }
        });
    });

    describe('Week Boundary Tests', () => {
        test('should show correct week start dates in column headers', async () => {
            const tasks: ITask[] = [];
            const baseState = createBaseState(tasks, '2025-06-15'); // Sunday
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.timeUnit).toBe(TimeUnit.WEEK);
            expect(layout.columnHeaders).toHaveLength(5);
            
            // Each week column should start on Monday
            layout.columnHeaders.forEach(header => {
                const headerDate = new Date(header.date);
                expect(headerDate.getUTCDay()).toBe(1); // Monday is day 1
            });
        });

        test('should place tasks in correct week columns', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Monday Task',
                    start: '2025-06-16', // Monday
                    end: '2025-06-16',
                    filePath: '/monday-task.md',
                    content: 'Monday task'
                },
                {
                    name: 'Sunday Task',
                    start: '2025-06-22', // Sunday (end of week)
                    end: '2025-06-22',
                    filePath: '/sunday-task.md', 
                    content: 'Sunday task'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-16');
            
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            const mondayTask = positionedTasks.find(t => t.name === 'Monday Task');
            const sundayTask = positionedTasks.find(t => t.name === 'Sunday Task');
            
            // Both tasks should be in the same week column (June 16-22)
            if (mondayTask && sundayTask) {
                expect(mondayTask.xStart).toBe(sundayTask.xStart);
            }
        });
    });

    describe('Day Boundary Tests', () => {
        test('should show correct day dates in column headers', async () => {
            const tasks: ITask[] = [];
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Day is already the default time unit
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.timeUnit).toBe(TimeUnit.DAY);
            expect(layout.columnHeaders).toHaveLength(5);
            
            // Each day column should represent a single day
            for (let i = 0; i < layout.columnHeaders.length - 1; i++) {
                const currentHeader = new Date(layout.columnHeaders[i].date);
                const nextHeader = new Date(layout.columnHeaders[i + 1].date);
                
                // Next day should be exactly 1 day later
                const dayDiff = (nextHeader.getTime() - currentHeader.getTime()) / (1000 * 60 * 60 * 24);
                expect(dayDiff).toBe(1);
            }
        });

        test('should place tasks in correct day columns', async () => {
            const tasks: ITask[] = [
                {
                    name: 'June 15 Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/june15-task.md',
                    content: 'June 15 task'
                },
                {
                    name: 'June 16 Task',
                    start: '2025-06-16',
                    end: '2025-06-16',
                    filePath: '/june16-task.md',
                    content: 'June 16 task'
                }
            ];
            
            const baseState = createBaseState(tasks, '2025-06-15');
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            expect(positionedTasks.length).toBeGreaterThan(0);
            
            const june15Task = positionedTasks.find(t => t.name === 'June 15 Task');
            const june16Task = positionedTasks.find(t => t.name === 'June 16 Task');
            
            // Tasks should be in adjacent columns
            if (june15Task && june16Task) {
                expect(Math.abs(june15Task.xStart! - june16Task.xStart!)).toBe(1);
            }
        });
    });

    describe('Cross-Time-Unit Consistency', () => {
        test('should maintain task visibility across time unit changes', async () => {
            const tasks: ITask[] = [
                {
                    name: 'Consistent Task',
                    start: '2025-06-15',
                    end: '2025-06-15',
                    filePath: '/consistent-task.md',
                    content: 'Should be visible in all time units'
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
                
                const taskGrid = layout.taskGrids[0];
                const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
                const consistentTask = positionedTasks.find(t => t.name === 'Consistent Task');
                
                // Task should be positioned in all time units when current date covers it
                expect(consistentTask).toBeDefined();
                expect(consistentTask!.xStart).toBeGreaterThan(0);
                expect(consistentTask!.xEnd).toBeGreaterThanOrEqual(consistentTask!.xStart!);
            }
        });

        test('should maintain column header date accuracy across time units', async () => {
            const tasks: ITask[] = [];
            const baseState = createBaseState(tasks, '2025-06-15');
            
            // Test month boundaries
            const monthResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const monthState = { persistent: monthResult.persistent, volatile: monthResult.volatile };
            const monthLayout = updateLayout(mockApp, monthState).volatile.boardLayout!;
            
            // All month headers should be 1st of month
            monthLayout.columnHeaders.forEach(header => {
                const date = new Date(header.date);
                expect(date.getUTCDate()).toBe(1);
            });
            
            // Test week boundaries  
            const weekResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
            const weekState = { persistent: weekResult.persistent, volatile: weekResult.volatile };
            const weekLayout = updateLayout(mockApp, weekState).volatile.boardLayout!;
            
            // All week headers should be Monday
            weekLayout.columnHeaders.forEach(header => {
                const date = new Date(header.date);
                expect(date.getUTCDay()).toBe(1); // Monday
            });
        });
    });
});