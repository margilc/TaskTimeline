import { ITask } from '../src/interfaces/ITask';
import { IAppState } from '../src/interfaces/IAppState';
import { TimeUnit } from '../src/enums/TimeUnit';

export function generateRandomTasks(count: number, startYear: number = 2024): ITask[] {
    const tasks: ITask[] = [];
    const categories = ['development', 'testing', 'design', 'meeting', 'research', 'documentation'];
    const statuses = ['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold'];
    const priorities = [1, 2, 3, 4, 5];
    
    for (let i = 0; i < count; i++) {
        const startDay = Math.floor(Math.random() * 365) + 1;
        const startDate = new Date(startYear, 0, startDay);
        const duration = Math.floor(Math.random() * 30) + 1;
        const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
        
        tasks.push({
            name: `Task ${i + 1}`,
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            category: categories[Math.floor(Math.random() * categories.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            filePath: `/task${i + 1}.md`,
            content: `Random task content ${i + 1}`,
            totalSubtasks: Math.floor(Math.random() * 5),
            completedSubtasks: Math.floor(Math.random() * 3)
        });
    }
    
    return tasks;
}

export function createTestAppState(tasks: ITask[] = [], overrides: Partial<IAppState> = {}): IAppState {
    return {
        persistent: {
            currentProjectName: 'Test Project',
            currentDate: '2024-01-15',
            currentTimeUnit: TimeUnit.DAY,
            settings: {
                taskDirectory: 'Test',
                numberOfColumns: 7,
                globalMinDate: '2024-01-01',
                globalMaxDate: '2024-12-31'
            },
            colorVariable: 'none',
            colorMappings: {},
            boardGrouping: { groupBy: 'none', availableGroups: ['All Tasks'] },
            ...overrides.persistent
        },
        volatile: {
            availableProjects: ['Test Project'],
            currentTasks: tasks,
            boardLayout: null,
            timelineViewport: null,
            minimapData: [],
            globalMinDateSnapped: '2024-01-01T00:00:00.000Z',
            globalMaxDateSnapped: '2024-12-31T23:59:59.999Z',
            ...overrides.volatile
        }
    };
}

export function measurePerformance<T>(fn: () => T, maxMs: number = 500): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    
    expect(duration).toBeLessThan(maxMs);
    
    return { result, duration };
}

export function expectValidTaskPosition(task: ITask): void {
    expect(task).toHaveProperty('xStart');
    expect(task).toHaveProperty('xEnd');
    expect(task).toHaveProperty('y');
    expect(typeof task.xStart).toBe('number');
    expect(typeof task.xEnd).toBe('number');
    expect(typeof task.y).toBe('number');
    expect(task.xStart).toBeGreaterThanOrEqual(0);
    expect(task.xEnd).toBeGreaterThanOrEqual(task.xStart);
    expect(task.y).toBeGreaterThanOrEqual(0);
}

// Consolidated layout test state creator - replaces duplicated createBaseState() functions
export function createLayoutTestState(
    tasks: ITask[] = [],
    options: {
        currentDate?: string;
        timeUnit?: TimeUnit;
        numberOfColumns?: number;
        groupBy?: string;
    } = {}
): IAppState {
    const {
        currentDate = '2024-01-15',
        timeUnit = TimeUnit.DAY,
        numberOfColumns = 8,
        groupBy = 'none'
    } = options;

    return {
        persistent: {
            currentDate,
            currentTimeUnit: timeUnit,
            boardGrouping: { groupBy, availableGroups: ['All Tasks'] },
            settings: {
                numberOfColumns
            }
        },
        volatile: {
            currentTasks: tasks,
        }
    };
}

// Overlap detection for layout tests
export interface OverlapError {
    cell: string;
    task1: ITask;
    task2: ITask;
    group: string;
}

export interface TaskGrid {
    group: string;
    tasks: ITask[];
}

export function detectOverlaps(taskGrids: TaskGrid[]): OverlapError[] {
    const overlaps: OverlapError[] = [];

    for (const grid of taskGrids) {
        const occupiedCells = new Map<string, ITask>();

        for (const task of grid.tasks) {
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

// Generate deterministic random tasks for reproducible tests
export function generateSeededRandomTasks(count: number, seed: number = 1): ITask[] {
    let seedValue = seed;
    function seededRandom(): number {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return seedValue / 233280;
    }

    const tasks: ITask[] = [];
    const categories = ['development', 'testing', 'design', 'meeting', 'research', 'documentation'];
    const statuses = ['Not Started', 'In Progress', 'Done', 'Blocked', 'On Hold'];
    const priorities = [1, 2, 3, 4, 5];

    const startDate = new Date(2024, 0, 1);
    const dateRange = 365 * 24 * 60 * 60 * 1000; // 1 year in ms

    for (let i = 0; i < count; i++) {
        const taskStartTime = startDate.getTime() + (seededRandom() * dateRange);
        const taskStart = new Date(taskStartTime);
        const duration = Math.floor(seededRandom() * 30) + 1;
        const taskEnd = new Date(taskStartTime + duration * 24 * 60 * 60 * 1000);

        tasks.push({
            name: `Task ${i + 1}`,
            start: taskStart.toISOString().split('T')[0],
            end: taskEnd.toISOString().split('T')[0],
            category: categories[Math.floor(seededRandom() * categories.length)],
            status: statuses[Math.floor(seededRandom() * statuses.length)],
            priority: priorities[Math.floor(seededRandom() * priorities.length)],
            filePath: `/task${i + 1}.md`,
            content: `Task content ${i + 1}`,
            totalSubtasks: Math.floor(seededRandom() * 5),
            completedSubtasks: Math.floor(seededRandom() * 3)
        });
    }

    return tasks;
}

// Common layout validation
export function expectValidLayout(layout: any, expectedColumns: number): void {
    expect(layout).toBeDefined();
    expect(layout.columnHeaders).toHaveLength(expectedColumns);
    expect(layout.gridWidth).toBe(expectedColumns + 1);
    expect(layout.taskGrids).toBeDefined();
    expect(layout.viewport).toBeDefined();
}

// Get positioned tasks from layout
export function getPositionedTasks(layout: any): ITask[] {
    return layout.taskGrids.flatMap((grid: TaskGrid) =>
        grid.tasks.filter((task: ITask) => task.xStart !== undefined)
    );
}