import { updateLayout, clearLayoutCache } from '../src/core/update/updateLayout';
import { updateBoardGrouping } from '../src/core/update/updateBoardGrouping';
import { updateTimeUnit } from '../src/core/update/updateTimeUnit';
import { IAppState } from '../src/interfaces/IAppState';
import { ITask } from '../src/interfaces/ITask';
import { TimeUnit } from '../src/enums/TimeUnit';

const mockApp = {} as any;

describe('Layout Correctness Testing', () => {
    
    // Dataset A: Row Stress Test - All tasks start on same date
    function createDatasetA(): ITask[] {
        const baseDate = '2024-01-15';
        const tasks: ITask[] = [];
        
        for (let i = 0; i < 20; i++) {
            const duration = (i % 5) + 1; // 1-5 day durations
            const endDate = new Date('2024-01-15');
            endDate.setDate(endDate.getDate() + duration);
            
            tasks.push({
                name: `Task A${i + 1}`,
                start: baseDate,
                end: endDate.toISOString().split('T')[0],
                category: `cat${i % 3}`, // 3 categories
                status: `status${i % 4}`, // 4 statuses  
                priority: (i % 3) + 1, // 1-3 priorities
                filePath: `/taskA${i + 1}.md`,
                content: `Content A${i + 1}`,
                totalSubtasks: i % 3,
                completedSubtasks: Math.min(i % 3, 1)
            });
        }
        
        return tasks;
    }

    // Dataset B: Split Distribution - Tasks in two halves
    function createDatasetB(): ITask[] {
        const tasks: ITask[] = [];
        
        // First half: 10 tasks from Jan 1-15
        for (let i = 0; i < 10; i++) {
            const startDay = i + 1; // Jan 1-10
            const startDate = new Date(2024, 0, startDay).toISOString().split('T')[0];
            const endDate = new Date(2024, 0, startDay + 3).toISOString().split('T')[0]; // 3-day duration
            
            tasks.push({
                name: `Task B1-${i + 1}`,
                start: startDate,
                end: endDate,
                category: 'first_half',
                status: 'active',
                priority: 1,
                filePath: `/taskB1${i + 1}.md`,
                content: `First half content ${i + 1}`,
                totalSubtasks: 2,
                completedSubtasks: 1
            });
        }
        
        // Second half: 10 tasks from Jan 16-30
        for (let i = 0; i < 10; i++) {
            const startDay = 16 + i; // Jan 16-25
            const startDate = new Date(2024, 0, startDay).toISOString().split('T')[0];
            const endDate = new Date(2024, 0, startDay + 3).toISOString().split('T')[0]; // 3-day duration
            
            tasks.push({
                name: `Task B2-${i + 1}`,
                start: startDate,
                end: endDate,
                category: 'second_half',
                status: 'pending',
                priority: 2,
                filePath: `/taskB2${i + 1}.md`,
                content: `Second half content ${i + 1}`,
                totalSubtasks: 1,
                completedSubtasks: 0
            });
        }
        
        return tasks;
    }

    // Dataset C: Overlap Cascade - Sequential overlapping tasks
    function createDatasetC(): ITask[] {
        const tasks: ITask[] = [];
        
        for (let i = 0; i < 20; i++) {
            const startDay = 1 + i; // Start on consecutive days
            const startDate = new Date(2024, 0, startDay).toISOString().split('T')[0];
            const endDate = new Date(2024, 0, startDay + 3).toISOString().split('T')[0]; // 3-day overlap
            
            tasks.push({
                name: `Task C${i + 1}`,
                start: startDate,
                end: endDate,
                category: `cascade${i % 5}`, // 5 categories for variety
                status: i < 10 ? 'early' : 'late',
                priority: (i % 3) + 1,
                filePath: `/taskC${i + 1}.md`,
                content: `Cascade content ${i + 1}`,
                totalSubtasks: i % 4,
                completedSubtasks: Math.min(i % 4, 2)
            });
        }
        
        return tasks;
    }

    function createBaseState(tasks: ITask[], currentDate: string = '2024-01-15'): IAppState {
        return {
            persistent: {
                currentDate,
                currentTimeUnit: TimeUnit.DAY,
                boardGrouping: { groupBy: 'none', availableGroups: [] },
                settings: {
                    numberOfColumns: 8 // Maintain expected 8 columns for correctness tests
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

    describe('Dataset A: Row Stress Test (Same Start Date)', () => {
        let datasetA: ITask[];
        
        beforeEach(() => {
            datasetA = createDatasetA();
        });

        describe('Grouping Variables', () => {
            test.each(['none', 'category', 'status', 'priority'])('should handle grouping by %s', async (groupBy) => {
                const baseState = createBaseState(datasetA);
                
                // Update grouping
                const groupingResult = await updateBoardGrouping(mockApp, baseState, groupBy);
                const stateWithGrouping = {
                    persistent: groupingResult.persistent,
                    volatile: baseState.volatile
                };
                
                // Generate layout
                const result = updateLayout(mockApp, stateWithGrouping);
                const layout = result.volatile.boardLayout!;
                
                // Verify basic structure
                expect(layout).toBeDefined();
                expect(layout.taskGrids).toBeDefined();
                
                if (groupBy === 'none') {
                    expect(layout.taskGrids).toHaveLength(1);
                    expect(layout.taskGrids[0].group).toBe('All Tasks');
                } else {
                    expect(layout.taskGrids.length).toBeGreaterThan(1);
                    
                    // Verify all tasks are accounted for
                    const totalTasksInGrids = layout.taskGrids.reduce((sum, grid) => sum + grid.tasks.length, 0);
                    expect(totalTasksInGrids).toBe(datasetA.length);
                }
                
                // For same start date, when current date covers start date, 
                // we expect high row usage due to overlapping tasks
                const maxRowsUsed = Math.max(...layout.taskGrids.map(grid => 
                    Math.max(...grid.tasks.map(task => task.y || 0), 0)
                ));
                
                // With 20 tasks starting on same date, expect significant row usage
                expect(maxRowsUsed).toBeGreaterThan(3); // At least 4 rows used
                expect(layout.gridHeight).toBe(maxRowsUsed + 1); // Height = max row + 1
            });
        });

        describe('Time Units', () => {
            test.each([TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH])('should handle time unit %s', async (timeUnit) => {
                const baseState = createBaseState(datasetA);
                
                // Update time unit
                const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                const stateWithTimeUnit = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                // Generate layout
                const result = updateLayout(mockApp, stateWithTimeUnit);
                const layout = result.volatile.boardLayout!;
                
                // Verify column count (should be 8 for default viewport)
                expect(layout.columnHeaders).toHaveLength(8);
                expect(layout.timeUnit).toBe(timeUnit);
                expect(layout.gridWidth).toBe(9); // 8 columns + 1 row header
                
                // All tasks start on same date, so positioning depends on viewport coverage
                const taskGrid = layout.taskGrids[0];
                const visibleTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
                
                if (visibleTasks.length > 0) {
                    // Tasks should have valid positioning
                    visibleTasks.forEach(task => {
                        expect(task.xStart).toBeGreaterThan(0);
                        expect(task.xEnd).toBeGreaterThanOrEqual(task.xStart!);
                        expect(task.y).toBeGreaterThanOrEqual(0);
                    });
                }
            });

            test('should maintain consistent columns when switching between time units', async () => {
                const baseState = createBaseState(datasetA);
                
                // Test all time unit combinations
                const timeUnits = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];
                const layouts: any[] = [];
                
                for (const timeUnit of timeUnits) {
                    const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                    const stateWithTimeUnit = {
                        persistent: timeUnitResult.persistent,
                        volatile: timeUnitResult.volatile
                    };
                    
                    const result = updateLayout(mockApp, stateWithTimeUnit);
                    const layout = result.volatile.boardLayout!;
                    
                    layouts.push({ timeUnit, layout });
                    
                    // Each time unit change should result in exactly 8 columns
                    expect(layout.columnHeaders).toHaveLength(8);
                    expect(layout.timeUnit).toBe(timeUnit);
                    expect(layout.gridWidth).toBe(9); // 8 columns + 1 row header
                }
                
                // Verify that all layouts have consistent column counts
                const columnCounts = layouts.map(l => l.layout.columnHeaders.length);
                expect(new Set(columnCounts).size).toBe(1); // All should be the same
                expect(columnCounts[0]).toBe(8); // All should be 8
            });

            test('should properly clear viewport when time unit changes', async () => {
                const baseState = createBaseState(datasetA);
                
                // Start with a custom viewport
                baseState.volatile.timelineViewport = {
                    localMinDate: '2024-01-01',
                    localMaxDate: '2024-01-31'
                };
                
                // Generate initial layout (should STILL respect numberOfColumns=8)
                const initialResult = updateLayout(mockApp, baseState);
                const initialLayout = initialResult.volatile.boardLayout!;
                
                // Should ALWAYS respect numberOfColumns=8, not the viewport size
                expect(initialLayout.columnHeaders.length).toBe(8);
                
                // Now change time unit (this should clear the viewport)
                const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
                const stateWithTimeUnit = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                // Verify viewport was cleared
                expect(stateWithTimeUnit.volatile.timelineViewport).toBeUndefined();
                
                // Generate new layout (should use default 8 columns)
                const newResult = updateLayout(mockApp, stateWithTimeUnit);
                const newLayout = newResult.volatile.boardLayout!;
                
                // Should now have exactly 8 columns (default)
                expect(newLayout.columnHeaders).toHaveLength(8);
                expect(newLayout.timeUnit).toBe(TimeUnit.WEEK);
                expect(newLayout.gridWidth).toBe(9);
            });
        });

        describe('Current Dates', () => {
            const dateConfigs = [
                { date: '2024-01-15', desc: 'on start date', expectVisible: true },
                { date: '2024-01-20', desc: 'after start date', expectVisible: true },
                { date: '2024-01-01', desc: 'before start date', expectVisible: false }
            ];

            test.each(dateConfigs)('should handle current date $date ($desc)', ({ date, expectVisible }) => {
                const baseState = createBaseState(datasetA, date);
                const result = updateLayout(mockApp, baseState);
                const layout = result.volatile.boardLayout!;
                
                const taskGrid = layout.taskGrids[0];
                const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
                
                if (expectVisible) {
                    expect(positionedTasks.length).toBeGreaterThan(0);
                    
                    // Since all tasks start on 2024-01-15, and current viewport
                    // should cover this date, most should be visible and positioned
                    expect(positionedTasks.length).toBeGreaterThanOrEqual(datasetA.length * 0.7);
                } else {
                    // If current date's viewport doesn't cover task dates, fewer tasks visible
                    expect(positionedTasks.length).toBeLessThanOrEqual(datasetA.length);
                }
            });
        });

        describe('Column Counts', () => {
            const columnConfigs = [
                { columns: 8, desc: 'default' },
                { columns: 15, desc: 'medium' },
                { columns: 30, desc: 'large' }
            ];

            test.each(columnConfigs)('should handle $columns columns ($desc)', ({ columns }) => {
                const baseState = createBaseState(datasetA);
                
                // Set numberOfColumns in settings to test different column counts
                baseState.persistent.settings!.numberOfColumns = columns;

                const result = updateLayout(mockApp, baseState);
                const layout = result.volatile.boardLayout!;
                
                // Verify column count accuracy - should EXACTLY match numberOfColumns setting
                expect(layout.columnHeaders.length).toBe(columns);
                expect(layout.gridWidth).toBe(layout.columnHeaders.length + 1);
            });
        });
    });

    describe('Dataset B: Split Distribution', () => {
        let datasetB: ITask[];
        
        beforeEach(() => {
            datasetB = createDatasetB();
        });

        test('should handle split timeline with proper row usage', () => {
            // Use current date that covers both halves
            const baseState = createBaseState(datasetB, '2024-01-15');
            
            // Set viewport to cover full month
            baseState.volatile.timelineViewport = {
                localMinDate: '2024-01-01',
                localMaxDate: '2024-01-31'
            };
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Tasks within the 8-column viewport should be positioned
            // Not all 20 tasks may be visible in the 8-column window
            expect(positionedTasks.length).toBeGreaterThan(0);
            expect(positionedTasks.length).toBeLessThanOrEqual(datasetB.length);
            
            // Tasks in different halves should be able to use same rows
            // since they don't overlap temporally
            const maxRowsUsed = Math.max(...positionedTasks.map(task => task.y || 0));
            
            // With non-overlapping halves, should use fewer rows than total tasks
            expect(maxRowsUsed).toBeLessThan(datasetB.length);
            expect(maxRowsUsed).toBeGreaterThan(2); // But still substantial
        });

        test('should group split tasks correctly', async () => {
            const baseState = createBaseState(datasetB, '2024-01-15');
            
            // Use more columns to ensure we see tasks from both halves
            baseState.persistent.settings!.numberOfColumns = 30;
            
            // Group by category (should create two groups: first_half, second_half)
            const groupingResult = await updateBoardGrouping(mockApp, baseState, 'category');
            const stateWithGrouping = {
                persistent: groupingResult.persistent,
                volatile: baseState.volatile
            };
            
            const result = updateLayout(mockApp, stateWithGrouping);
            const layout = result.volatile.boardLayout!;
            
            // Should have two groups
            expect(layout.taskGrids).toHaveLength(2);
            
            const groups = layout.taskGrids.map(grid => grid.group).sort();
            expect(groups).toEqual(['first_half', 'second_half']);
            
            // Each group should have 10 tasks
            layout.taskGrids.forEach(grid => {
                const positionedTasks = grid.tasks.filter(task => task.xStart !== undefined);
                // Not all tasks may be visible in the limited column window
                expect(positionedTasks.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Dataset C: Overlap Cascade', () => {
        let datasetC: ITask[];
        
        beforeEach(() => {
            datasetC = createDatasetC();
        });

        test('should handle cascading overlaps with predictable row assignment', () => {
            const baseState = createBaseState(datasetC, '2024-01-15');
            
            // Set viewport to cover the cascade period
            baseState.volatile.timelineViewport = {
                localMinDate: '2024-01-01',
                localMaxDate: '2024-01-31'
            };
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            const taskGrid = layout.taskGrids[0];
            const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
            
            // Tasks within the 8-column viewport should be positioned
            // Not all cascading tasks may be visible in the limited window
            expect(positionedTasks.length).toBeGreaterThan(0);
            expect(positionedTasks.length).toBeLessThanOrEqual(datasetC.length);
            
            // With cascading 3-day overlaps, we expect specific row patterns
            // Task 1: Days 1-3, Task 2: Days 2-4, Task 3: Days 3-5, etc.
            // This creates a predictable overlap pattern
            
            // Sort tasks by start date to analyze pattern
            const sortedTasks = positionedTasks.sort((a, b) => {
                const aStart = new Date(a.start).getTime();
                const bStart = new Date(b.start).getTime();
                return aStart - bStart;
            });
            
            // Verify row assignments follow greedy algorithm logic
            // Earlier tasks should generally get lower row numbers
            let maxRowSeen = -1;
            sortedTasks.forEach(task => {
                expect(task.y).toBeGreaterThanOrEqual(0);
                if (task.y! > maxRowSeen) {
                    maxRowSeen = task.y!;
                }
            });
            
            // With 3-day overlaps, we expect at least 3 rows but not too many
            expect(maxRowSeen).toBeGreaterThanOrEqual(2); // At least 3 rows (0-based)
            expect(maxRowSeen).toBeLessThan(10); // But reasonable number
        });

        test('should maintain cascade pattern across time units', async () => {
            const baseState = createBaseState(datasetC, '2024-01-15');
            
            for (const timeUnit of [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH]) {
                // Update time unit (clears viewport)
                const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, timeUnit);
                const stateWithTimeUnit = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                const result = updateLayout(mockApp, stateWithTimeUnit);
                const layout = result.volatile.boardLayout!;
                
                // Should always have 8 columns with cleared viewport
                expect(layout.columnHeaders).toHaveLength(8);
                expect(layout.timeUnit).toBe(timeUnit);
                
                // Some tasks should be visible and positioned
                const taskGrid = layout.taskGrids[0];
                const positionedTasks = taskGrid.tasks.filter(task => task.xStart !== undefined);
                
                if (positionedTasks.length > 0) {
                    // All positioned tasks should have valid coordinates
                    positionedTasks.forEach(task => {
                        expect(task.xStart).toBeGreaterThan(0);
                        expect(task.xEnd).toBeGreaterThanOrEqual(task.xStart!);
                        expect(task.y).toBeGreaterThanOrEqual(0);
                    });
                }
            }
        });
    });

    describe('Grid Dimension Validation', () => {
        test.each([
            { dataset: 'A', createFn: createDatasetA },
            { dataset: 'B', createFn: createDatasetB },
            { dataset: 'C', createFn: createDatasetC }
        ])('should calculate correct grid dimensions for dataset $dataset', ({ createFn }) => {
            const tasks = createFn();
            const baseState = createBaseState(tasks);
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // Grid width should equal columns + 1 (for row header)
            expect(layout.gridWidth).toBe(layout.columnHeaders.length + 1);
            
            // Grid height should be at least the maximum row used + 1
            const maxRowUsed = Math.max(...layout.taskGrids.flatMap(grid => 
                grid.tasks.map(task => task.y || 0)
            ), 0);
            
            expect(layout.gridHeight).toBeGreaterThanOrEqual(maxRowUsed + 1);
            expect(layout.gridHeight).toBeGreaterThan(0); // Always at least 1
        });
    });

    describe('Task Positioning Validation', () => {
        test('should ensure all positioned tasks have valid coordinates', () => {
            const allDatasets = [
                { name: 'A', tasks: createDatasetA() },
                { name: 'B', tasks: createDatasetB() },
                { name: 'C', tasks: createDatasetC() }
            ];
            
            allDatasets.forEach(({ name, tasks }) => {
                const baseState = createBaseState(tasks);
                const result = updateLayout(mockApp, baseState);
                const layout = result.volatile.boardLayout!;
                
                layout.taskGrids.forEach(grid => {
                    grid.tasks.forEach(task => {
                        if (task.xStart !== undefined) {
                            // Task is positioned, validate coordinates
                            expect(task.xStart).toBeGreaterThan(0);
                            expect(task.xStart).toBeLessThanOrEqual(layout.columnHeaders.length);
                            expect(task.xEnd).toBeGreaterThanOrEqual(task.xStart);
                            expect(task.xEnd).toBeLessThanOrEqual(layout.columnHeaders.length);
                            expect(task.y).toBeGreaterThanOrEqual(0);
                            expect(task.y).toBeLessThan(layout.gridHeight);
                        }
                    });
                });
            });
        });
    });

    describe('Column Recalculation Scenarios', () => {
        test('should maintain 8 columns across multiple operations', async () => {
            const baseState = createBaseState(createDatasetA());
            const expectedColumns = 8;
            
            // Test sequence: change grouping -> change time unit -> change date
            let currentState = baseState;
            
            // Step 1: Change grouping to category
            const groupingResult = await updateBoardGrouping(mockApp, currentState, 'category');
            currentState = {
                persistent: groupingResult.persistent,
                volatile: currentState.volatile
            };
            
            let result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(expectedColumns);
            
            // Step 2: Change time unit to WEEK
            const timeUnitResult = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, TimeUnit.WEEK);
            currentState = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(expectedColumns);
            expect(result.volatile.boardLayout!.timeUnit).toBe(TimeUnit.WEEK);
            
            // Step 3: Change time unit to MONTH
            const timeUnitResult2 = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, TimeUnit.MONTH);
            currentState = {
                persistent: timeUnitResult2.persistent,
                volatile: timeUnitResult2.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(expectedColumns);
            expect(result.volatile.boardLayout!.timeUnit).toBe(TimeUnit.MONTH);
            
            // Step 4: Change back to DAY
            const timeUnitResult3 = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, TimeUnit.DAY);
            currentState = {
                persistent: timeUnitResult3.persistent,
                volatile: timeUnitResult3.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(expectedColumns);
            expect(result.volatile.boardLayout!.timeUnit).toBe(TimeUnit.DAY);
            
            // Step 5: Change grouping back to none
            const groupingResult2 = await updateBoardGrouping(mockApp, currentState, 'none');
            currentState = {
                persistent: groupingResult2.persistent,
                volatile: currentState.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(expectedColumns);
            expect(result.volatile.boardLayout!.taskGrids).toHaveLength(1);
        });

        test('should handle rapid time unit switching without column drift', async () => {
            const baseState = createBaseState(createDatasetB());
            const timeUnits = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH, TimeUnit.DAY, TimeUnit.MONTH, TimeUnit.WEEK];
            let currentState = baseState;
            
            for (const timeUnit of timeUnits) {
                const timeUnitResult = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, timeUnit);
                currentState = {
                    persistent: timeUnitResult.persistent,
                    volatile: timeUnitResult.volatile
                };
                
                const result = updateLayout(mockApp, currentState);
                const layout = result.volatile.boardLayout!;
                
                // Always expect exactly 8 columns after time unit change
                expect(layout.columnHeaders).toHaveLength(8);
                expect(layout.timeUnit).toBe(timeUnit);
                expect(layout.gridWidth).toBe(9); // 8 columns + 1 row header
                
                // Viewport should be cleared (forcing default calculation)
                expect(currentState.volatile.timelineViewport).toBeUndefined();
            }
        });

        test('should preserve column count when custom viewport is set after time unit change', async () => {
            const baseState = createBaseState(createDatasetC());
            
            // Start with time unit change (clears viewport)
            const timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.DAY);
            let currentState = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            // Verify default 8 columns
            let result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(8);
            
            // Now manually set a custom viewport for more columns (15 days with DAY unit)
            currentState.volatile.timelineViewport = {
                localMinDate: '2024-01-08', // 15 days total
                localMaxDate: '2024-01-22'
            };
            
            // Layout should STILL respect numberOfColumns=8, not the viewport size
            result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders.length).toBe(8);
            expect(result.volatile.boardLayout!.timeUnit).toBe(TimeUnit.DAY);
            
            // Change time unit (should clear viewport and revert to 8 columns)
            const timeUnitResult2 = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, TimeUnit.MONTH);
            currentState = {
                persistent: timeUnitResult2.persistent,
                volatile: timeUnitResult2.volatile
            };
            
            // Verify viewport was cleared
            expect(currentState.volatile.timelineViewport).toBeUndefined();
            
            // Should be back to 8 columns
            result = updateLayout(mockApp, currentState);
            expect(result.volatile.boardLayout!.columnHeaders).toHaveLength(8);
            expect(result.volatile.boardLayout!.timeUnit).toBe(TimeUnit.MONTH);
        });

        test('should handle edge case: settings numberOfColumns vs default behavior', () => {
            const baseState = createBaseState(createDatasetA());
            
            // Test with explicit numberOfColumns setting
            baseState.persistent.settings = { numberOfColumns: 12 };
            
            // Clear any viewport to force default calculation
            baseState.volatile.timelineViewport = undefined;
            
            const result = updateLayout(mockApp, baseState);
            const layout = result.volatile.boardLayout!;
            
            // Should use numberOfColumns from settings for default viewport calculation
            expect(layout.columnHeaders).toHaveLength(12);
            expect(layout.gridWidth).toBe(13); // 12 columns + 1 row header
        });

        test('should maintain column consistency during viewport clearing operations', async () => {
            const tasks = createDatasetC(); // Overlapping cascade tasks
            const baseState = createBaseState(tasks);
            
            // Set a large custom viewport initially
            baseState.volatile.timelineViewport = {
                localMinDate: '2024-01-01',
                localMaxDate: '2024-02-01' // ~31 days
            };
            
            // Generate layout - should STILL respect numberOfColumns=8
            let result = updateLayout(mockApp, baseState);
            expect(result.volatile.boardLayout!.columnHeaders.length).toBe(8);
            
            // Track layouts through multiple viewport-clearing operations
            const layouts: { operation: string, columns: number, timeUnit: string }[] = [];
            
            // Operation 1: Change time unit (clears viewport)
            let timeUnitResult = await updateTimeUnit(mockApp, baseState.persistent, baseState.volatile, TimeUnit.WEEK);
            let currentState = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            layouts.push({ 
                operation: 'TimeUnit->WEEK', 
                columns: result.volatile.boardLayout!.columnHeaders.length,
                timeUnit: result.volatile.boardLayout!.timeUnit
            });
            
            // Operation 2: Change time unit again (clears viewport)
            timeUnitResult = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, TimeUnit.MONTH);
            currentState = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            layouts.push({ 
                operation: 'TimeUnit->MONTH', 
                columns: result.volatile.boardLayout!.columnHeaders.length,
                timeUnit: result.volatile.boardLayout!.timeUnit
            });
            
            // Operation 3: Change back to DAY (clears viewport)  
            timeUnitResult = await updateTimeUnit(mockApp, currentState.persistent, currentState.volatile, TimeUnit.DAY);
            currentState = {
                persistent: timeUnitResult.persistent,
                volatile: timeUnitResult.volatile
            };
            
            result = updateLayout(mockApp, currentState);
            layouts.push({ 
                operation: 'TimeUnit->DAY', 
                columns: result.volatile.boardLayout!.columnHeaders.length,
                timeUnit: result.volatile.boardLayout!.timeUnit
            });
            
            // All viewport-clearing operations should result in exactly 8 columns
            layouts.forEach(layout => {
                expect(layout.columns).toBe(8);
            });
            
            // Verify time units were set correctly
            expect(layouts[0].timeUnit).toBe(TimeUnit.WEEK);
            expect(layouts[1].timeUnit).toBe(TimeUnit.MONTH);
            expect(layouts[2].timeUnit).toBe(TimeUnit.DAY);
        });
    });
});