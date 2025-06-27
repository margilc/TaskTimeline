import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateBoardGrouping } from '../src/core/update/updateBoardGrouping';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';

const mockApp = {} as any;

interface OverlapError {
    cell: string;
    task1: ITask;
    task2: ITask;
    group: string;
}

interface TaskGrid {
    group: string;
    tasks: ITask[];
}

describe('Layout Overlap Prevention Testing', () => {
    
    // Generate random tasks for overlap testing
    function generateRandomTasks(count: number, startYear: number, endYear: number, seed: number = 1): ITask[] {
        // Use deterministic randomization for reproducible tests
        let seedValue = seed;
        function seededRandom(): number {
            seedValue = (seedValue * 9301 + 49297) % 233280;
            return seedValue / 233280;
        }
        
        const tasks: ITask[] = [];
        const categories = ['development', 'testing', 'design', 'meeting', 'research', 'documentation', 'analysis'];
        const statuses = ['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold', 'Review', 'Testing'];
        const priorities = [1, 2, 3, 4, 5];
        
        // Random global date range between startYear and endYear
        const startDate = new Date(startYear, 0, 1);
        const endDate = new Date(endYear, 11, 31);
        const dateRange = endDate.getTime() - startDate.getTime();
        
        for (let i = 0; i < count; i++) {
            // Random start date within global range
            const taskStartTime = startDate.getTime() + (seededRandom() * dateRange);
            const taskStart = new Date(taskStartTime);
            
            // Random duration between 1-30 days
            const duration = Math.floor(seededRandom() * 30) + 1;
            const taskEnd = new Date(taskStartTime + duration * 24 * 60 * 60 * 1000);
            
            tasks.push({
                name: `Random Task ${i + 1}`,
                start: taskStart.toISOString().split('T')[0],
                end: taskEnd.toISOString().split('T')[0],
                category: categories[Math.floor(seededRandom() * categories.length)],
                status: statuses[Math.floor(seededRandom() * statuses.length)],
                priority: priorities[Math.floor(seededRandom() * priorities.length)],
                filePath: `/random${i + 1}.md`,
                content: `Random content ${i + 1}`,
                totalSubtasks: Math.floor(seededRandom() * 5),
                completedSubtasks: Math.floor(seededRandom() * 3)
            });
        }
        
        return tasks;
    }

    // Overlap detection algorithm
    function detectOverlaps(taskGrids: TaskGrid[]): OverlapError[] {
        const overlaps: OverlapError[] = [];
        
        for (const grid of taskGrids) {
            const occupiedCells = new Map<string, ITask>();
            
            for (const task of grid.tasks) {
                // Only check positioned tasks
                if (task.xStart !== undefined && task.xEnd !== undefined && task.y !== undefined) {
                    for (let x = task.xStart; x <= task.xEnd; x++) {
                        const cellKey = `${x},${task.y}`;
                        
                        if (occupiedCells.has(cellKey)) {
                            overlaps.push({
                                cell: cellKey,
                                task1: occupiedCells.get(cellKey)!,
                                task2: task,
                                group: grid.group
                            });
                        } else {
                            occupiedCells.set(cellKey, task);
                        }
                    }
                }
            }
        }
        
        return overlaps;
    }

    function createBaseState(tasks: ITask[], currentDate: string): IAppState {
        return {
            persistent: {
                currentDate,
                currentTimeUnit: TimeUnit.DAY,
                boardGrouping: { groupBy: 'none', availableGroups: ['All Tasks'] },
                settings: {
                    numberOfColumns: 8 // Maintain expected 8 columns for overlap tests
                }
            },
            volatile: {
                currentTasks: tasks,
            }
        };
    }

    beforeEach(() => {
        clearLayoutCache();
    });

    describe('200 Random Tasks Overlap Prevention', () => {
        const TASK_COUNT = 200;
        const START_YEAR = 2020;
        const END_YEAR = 2025;

        test('should have zero overlaps with default configuration', async () => {
            const tasks = generateRandomTasks(TASK_COUNT, START_YEAR, END_YEAR, 1);
            
            // Find actual date range from tasks
            const taskDates = tasks.flatMap(task => [new Date(task.start), new Date(task.end)]);
            const globalStartDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
            const globalEndDate = new Date(Math.max(...taskDates.map(d => d.getTime())));
            
            // Create base state with current date in middle of range
            const middleDate = new Date((globalStartDate.getTime() + globalEndDate.getTime()) / 2);
            const baseState = createBaseState(tasks, middleDate.toISOString().split('T')[0]);
            
            // Generate layout with default settings (8 columns, DAY unit, no grouping)
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // Verify layout was created
            expect(layout).toBeDefined();
            expect(layout.taskGrids).toBeDefined();
            expect(layout.columnHeaders).toHaveLength(8);
            
            // Detect overlaps
            const overlaps = detectOverlaps(layout.taskGrids);
            
            // ZERO TOLERANCE: No overlaps allowed
            if (overlaps.length > 0) {
                const overlapDetails = overlaps.map(overlap => 
                    `Cell ${overlap.cell} in group "${overlap.group}": Task "${overlap.task1.name}" overlaps with Task "${overlap.task2.name}"`
                ).join('\n');
                
                fail(`Found ${overlaps.length} overlaps:\n${overlapDetails}`);
            }
            
            expect(overlaps).toHaveLength(0);
            
            const totalPositionedTasks = layout.taskGrids.reduce((sum, grid) => {
                return sum + grid.tasks.filter(task => task.xStart !== undefined).length;
            }, 0);
            
            console.log(`✓ ${totalPositionedTasks} tasks positioned without overlaps (default config)`);
        });

        test('should have zero overlaps with 20 columns', async () => {
            const tasks = generateRandomTasks(TASK_COUNT, START_YEAR, END_YEAR, 42);
            
            const middleDate = new Date(2022, 5, 15); // June 15, 2022
            const baseState = createBaseState(tasks, middleDate.toISOString().split('T')[0]);
            
            // Set numberOfColumns to 20 in settings
            baseState.persistent.settings!.numberOfColumns = 20;
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.columnHeaders.length).toBe(20);
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            const totalPositionedTasks = layout.taskGrids.reduce((sum, grid) => {
                return sum + grid.tasks.filter(task => task.xStart !== undefined).length;
            }, 0);
            
            console.log(`✓ ${totalPositionedTasks} tasks positioned without overlaps (20 columns)`);
        });

        test('should have zero overlaps with category grouping', async () => {
            const tasks = generateRandomTasks(TASK_COUNT, START_YEAR, END_YEAR, 123);
            
            const middleDate = new Date(2022, 5, 15);
            const baseState = createBaseState(tasks, middleDate.toISOString().split('T')[0]);
            
            // Update grouping to category
            const groupingResult = await updateBoardGrouping(mockApp, baseState, 'category');
            const stateWithGrouping = {
                persistent: groupingResult.persistent,
                volatile: baseState.volatile
            };
            
            const result = updateLayout(mockApp, stateWithGrouping);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.taskGrids.length).toBeGreaterThan(1);
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            const totalPositionedTasks = layout.taskGrids.reduce((sum, grid) => {
                return sum + grid.tasks.filter(task => task.xStart !== undefined).length;
            }, 0);
            
            console.log(`✓ ${totalPositionedTasks} tasks positioned without overlaps (category grouping, ${layout.taskGrids.length} groups)`);
        });

        test('should have zero overlaps with WEEK time unit', async () => {
            const tasks = generateRandomTasks(TASK_COUNT, START_YEAR, END_YEAR, 456);
            
            const middleDate = new Date(2022, 5, 15);
            const baseState = createBaseState(tasks, middleDate.toISOString().split('T')[0]);
            
            // Update time unit to WEEK
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.timeUnit).toBe(TimeUnit.WEEK);
            expect(layout.columnHeaders).toHaveLength(8);
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            const totalPositionedTasks = layout.taskGrids.reduce((sum, grid) => {
                return sum + grid.tasks.filter(task => task.xStart !== undefined).length;
            }, 0);
            
            console.log(`✓ ${totalPositionedTasks} tasks positioned without overlaps (WEEK unit)`);
        });

        test('should have zero overlaps with MONTH time unit', async () => {
            const tasks = generateRandomTasks(TASK_COUNT, START_YEAR, END_YEAR, 789);
            
            const middleDate = new Date(2022, 5, 15);
            const baseState = createBaseState(tasks, middleDate.toISOString().split('T')[0]);
            
            // Update time unit to MONTH
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.MONTH);
            const stateWithTimeUnit = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            const result = updateLayout(mockApp, stateWithTimeUnit);
            const layout = result.volatile.boardLayout!;
            
            expect(layout.timeUnit).toBe(TimeUnit.MONTH);
            expect(layout.columnHeaders).toHaveLength(8);
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            const totalPositionedTasks = layout.taskGrids.reduce((sum, grid) => {
                return sum + grid.tasks.filter(task => task.xStart !== undefined).length;
            }, 0);
            
            console.log(`✓ ${totalPositionedTasks} tasks positioned without overlaps (MONTH unit)`);
        });

        test('should handle stress test: 50 columns with full viewport', async () => {
            const tasks = generateRandomTasks(TASK_COUNT, START_YEAR, END_YEAR, 999);
            
            // Find task date range
            const taskDates = tasks.flatMap(task => [new Date(task.start), new Date(task.end)]);
            const globalStart = new Date(Math.min(...taskDates.map(d => d.getTime())));
            const globalEnd = new Date(Math.max(...taskDates.map(d => d.getTime())));
            
            const baseState = createBaseState(tasks, '2022-06-15');
            
            // Set large viewport (50+ columns worth)
            const startDate = new Date(2022, 5, 1);  // June 1
            const endDate = new Date(2022, 6, 20);   // July 20 (50 days)
            
            baseState.volatile.timelineViewport = {
                localMinDate: startDate.toISOString().split('T')[0],
                localMaxDate: endDate.toISOString().split('T')[0]
            };
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            const totalPositionedTasks = layout.taskGrids.reduce((sum, grid) => {
                return sum + grid.tasks.filter(task => task.xStart !== undefined).length;
            }, 0);
            
            console.log(`✓ Stress test: ${layout.columnHeaders.length} columns, ${totalPositionedTasks} positioned tasks, 0 overlaps`);
        });
    });

    describe('Edge Case Overlap Testing', () => {
        test('should handle tasks with same start and end dates', () => {
            const sameDateTasks = Array.from({ length: 10 }, (_, i) => ({
                name: `Same Date Task ${i + 1}`,
                start: '2024-01-15',
                end: '2024-01-15',
                category: 'same',
                status: 'active',
                priority: i % 3 + 1,
                filePath: `/same${i + 1}.md`,
                content: `Same date content ${i + 1}`,
                totalSubtasks: 0,
                completedSubtasks: 0
            }));
            
            const baseState = createBaseState(sameDateTasks, '2024-01-15');
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            // All tasks should be positioned (they're in viewport)
            const positionedTasks = layout.taskGrids[0].tasks.filter(t => t.xStart !== undefined);
            expect(positionedTasks.length).toBe(sameDateTasks.length);
            
            // They should be in different rows since they occupy the same column
            const rows = new Set(positionedTasks.map(t => t.y));
            expect(rows.size).toBe(sameDateTasks.length); // Each task in different row
            
            console.log(`✓ ${positionedTasks.length} same-date tasks in ${rows.size} rows, 0 overlaps`);
        });

        test('should handle tasks spanning multiple columns', () => {
            const longTasks = Array.from({ length: 5 }, (_, i) => ({
                name: `Long Task ${i + 1}`,
                start: `2024-01-${10 + i}`, // Staggered starts
                end: `2024-01-${20 + i}`,   // 10-day duration, overlapping
                category: 'long',
                status: 'active',
                priority: i % 3 + 1,
                filePath: `/long${i + 1}.md`,
                content: `Long task content ${i + 1}`,
                totalSubtasks: 0,
                completedSubtasks: 0
            }));
            
            const baseState = createBaseState(longTasks, '2024-01-15');
            
            // Set viewport to cover all tasks
            baseState.volatile.timelineViewport = {
                localMinDate: '2024-01-01',
                localMaxDate: '2024-01-31'
            };
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            // Verify tasks span multiple columns
            const positionedTasks = layout.taskGrids[0].tasks.filter(t => t.xStart !== undefined);
            positionedTasks.forEach(task => {
                expect(task.xEnd! - task.xStart!).toBeGreaterThan(5); // Spans multiple days
            });
            
            console.log(`✓ ${positionedTasks.length} long tasks spanning multiple columns, 0 overlaps`);
        });

        test('should handle maximum grid utilization without overlaps', () => {
            // Create tasks that will fill a small grid completely
            const gridTasks: ITask[] = [];
            
            // Create 4x4 grid worth of tasks (16 single-day tasks)
            for (let day = 1; day <= 4; day++) {
                for (let row = 0; row < 4; row++) {
                    gridTasks.push({
                        name: `Grid Task ${day}-${row}`,
                        start: `2024-01-${day.toString().padStart(2, '0')}`,
                        end: `2024-01-${day.toString().padStart(2, '0')}`, // Single day
                        category: `row${row}`,
                        status: 'active',
                        priority: row + 1,
                        filePath: `/grid${day}${row}.md`,
                        content: `Grid content ${day}-${row}`,
                        totalSubtasks: 0,
                        completedSubtasks: 0
                    });
                }
            }
            
            const baseState = createBaseState(gridTasks, '2024-01-02');
            
            // Set viewport to exactly cover the 4 days
            baseState.volatile.timelineViewport = {
                localMinDate: '2024-01-01',
                localMaxDate: '2024-01-04'
            };
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const overlaps = detectOverlaps(layout.taskGrids);
            expect(overlaps).toHaveLength(0);
            
            // Verify grid utilization
            const positionedTasks = layout.taskGrids[0].tasks.filter(t => t.xStart !== undefined);
            expect(positionedTasks.length).toBe(gridTasks.length);
            
            console.log(`✓ 4x4 grid: ${positionedTasks.length} tasks, 0 overlaps`);
        });
    });

    describe('Deterministic Reproducibility', () => {
        test('should produce identical layouts for identical inputs', () => {
            const tasks = generateRandomTasks(50, 2023, 2024, 777);
            const baseState1 = createBaseState(tasks, '2023-06-15');
            const baseState2 = createBaseState(tasks, '2023-06-15');
            
            const result1 = updateLayout(mockApp, baseState1);
            const result2 = updateLayout(mockApp, baseState2);
            
            // Results should be identical
            expect(result1.volatile.boardLayout).toEqual(result2.volatile.boardLayout);
            
            // Neither should have overlaps
            const overlaps1 = detectOverlaps(result1.volatile.boardLayout!.taskGrids);
            const overlaps2 = detectOverlaps(result2.volatile.boardLayout!.taskGrids);
            
            expect(overlaps1).toHaveLength(0);
            expect(overlaps2).toHaveLength(0);
            
            console.log(`✓ Deterministic test: identical layouts, 0 overlaps`);
        });
    });
});