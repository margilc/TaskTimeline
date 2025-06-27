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