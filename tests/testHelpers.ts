import { ITask } from '../src/interfaces/ITask';
import { IAppState } from '../src/interfaces/IAppState';
import { TimeUnit } from '../src/enums/TimeUnit';

/** Complete ITask from the fields a test cares about. */
export function makeTask(overrides: Partial<ITask> & { name: string; start: string }): ITask {
    const filePath = overrides.filePath ?? `/tasks/${overrides.name.replace(/\s+/g, '_')}.md`;
    return {
        id: filePath.split('/').pop()!.replace(/\.md$/, ''),
        end: '',
        category: 'default',
        status: 'planned',
        priority: 5,
        content: '',
        totalSubtasks: 0,
        completedSubtasks: 0,
        ...overrides,
        filePath,
    };
}

export function makeTasks(partials: Array<Partial<ITask> & { name: string; start: string }>): ITask[] {
    return partials.map(makeTask);
}

export function expectValidTaskPosition(task: ITask): void {
    expect(task).toHaveProperty('xStart');
    expect(task).toHaveProperty('xEnd');
    expect(task).toHaveProperty('y');
    expect(typeof task.xStart).toBe('number');
    expect(typeof task.xEnd).toBe('number');
    expect(typeof task.y).toBe('number');
    expect(task.xStart).toBeGreaterThanOrEqual(0);
    expect(task.xEnd).toBeGreaterThanOrEqual(task.xStart!);
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
    const dateBounds = createDateBounds(currentDate, numberOfColumns, timeUnit);

    return {
        persistent: {
            currentTimeUnit: timeUnit,
            boardGrouping: { groupBy, availableGroups: ['All Tasks'] },
        },
        volatile: {
            currentTasks: tasks,
            dateBounds,
        }
    };
}

export async function updateTestTimeUnit(
    app: any,
    persistent: IAppState['persistent'],
    volatile: IAppState['volatile'],
    timeUnit: TimeUnit,
    columnCount: number = 8
): Promise<IAppState> {
    const currentDate = (volatile.dateBounds?.earliest || '2024-01-15T00:00:00.000Z').slice(0, 10);

    return {
        persistent: {
            ...persistent,
            currentTimeUnit: timeUnit,
        },
        volatile: {
            ...volatile,
            dateBounds: createDateBounds(currentDate, columnCount, timeUnit),
        },
    };
}

function createDateBounds(currentDate: string, columnCount: number, timeUnit: TimeUnit): { earliest: string; latest: string } {
    const earliest = normalizeToDateOnly(new Date(`${currentDate}T00:00:00.000Z`));
    const latest = addTestTime(earliest, Math.max(columnCount - 1, 0), timeUnit);

    return {
        earliest: earliest.toISOString(),
        latest: latest.toISOString(),
    };
}

function addTestTime(date: Date, amount: number, unit: TimeUnit): Date {
    const result = new Date(date);
    if (unit === TimeUnit.MONTH) {
        result.setUTCMonth(result.getUTCMonth() + amount);
        result.setUTCDate(1);
    } else if (unit === TimeUnit.WEEK) {
        result.setUTCDate(result.getUTCDate() + amount * 7);
    } else {
        result.setUTCDate(result.getUTCDate() + amount);
    }
    return result;
}

function normalizeToDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

        tasks.push(makeTask({
            name: `Task ${i + 1}`,
            start: taskStart.toISOString().split('T')[0],
            end: taskEnd.toISOString().split('T')[0],
            category: categories[Math.floor(seededRandom() * categories.length)],
            status: statuses[Math.floor(seededRandom() * statuses.length)],
            priority: priorities[Math.floor(seededRandom() * priorities.length)],
            filePath: `/task${i + 1}.md`,
        }));
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