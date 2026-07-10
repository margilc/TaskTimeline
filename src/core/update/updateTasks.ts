import { IPersistentState, IVolatileState } from '../../interfaces/IAppState';
import { generateAvailableGroups } from '../utils/groupingUtils';
import { resolveTaskLinks } from '../utils/linkUtils';
import { TaskIndex } from '../TaskIndex';

/**
 * Update tasks from the TaskIndex instead of scanning all files.
 * This is O(1) for the retrieval vs O(n) for full scan.
 */
export function updateTasksFromIndex(
    taskIndex: TaskIndex,
    currentVolatile: IVolatileState,
    currentPersistent: IPersistentState
): { volatile: IVolatileState, persistent: IPersistentState } {
    const currentProjectName = currentPersistent.currentProjectName;

    if (!currentProjectName) {
        return {
            volatile: {
                ...currentVolatile,
                currentTasks: [],
                tasksVersion: (currentVolatile.tasksVersion || 0) + 1
            },
            persistent: currentPersistent
        };
    }

    // Get tasks from index and clone to avoid mutating cached objects
    const tasks = taskIndex.getTasks(currentProjectName).map(t => ({ ...t }));

    // Resolve [[wiki-links]] to task IDs across all collected tasks
    resolveTaskLinks(tasks);

    // Update group ordering if board grouping is active
    let updatedPersistent = currentPersistent;
    const currentGrouping = currentPersistent.boardGrouping;

    if (currentGrouping) {
        const updatedAvailableGroups = generateAvailableGroups(
            tasks,
            currentGrouping.groupBy,
            currentPersistent,
            currentProjectName
        );

        updatedPersistent = {
            ...currentPersistent,
            boardGrouping: {
                ...currentGrouping,
                availableGroups: updatedAvailableGroups
            }
        };
    }

    return {
        volatile: {
            ...currentVolatile,
            currentTasks: tasks,
            tasksVersion: (currentVolatile.tasksVersion || 0) + 1
        },
        persistent: updatedPersistent
    };
}