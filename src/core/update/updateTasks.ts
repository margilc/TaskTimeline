import { App, Notice } from 'obsidian';
import { IPersistentState, IVolatileState } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { parseTaskFromContent } from '../utils/taskUtils';
import { generateAvailableGroups } from '../utils/groupingUtils';
import { TaskIndex } from '../TaskIndex';

export async function updateTasks(
    app: App, 
    currentVolatile: IVolatileState, 
    currentPersistent: IPersistentState
): Promise<{volatile: IVolatileState, persistent: IPersistentState}> {
    
    const tasks: ITask[] = [];
    const currentProjectName = currentPersistent.currentProjectName;
    const taskDirectory = currentPersistent.settings?.taskDirectory || 'Taskdown';
    
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
    
    try {
        if (currentProjectName === 'All Projects') {
            // Scan all project folders in the task directory
            const taskDir = app.vault.getAbstractFileByPath(taskDirectory);
            if (!taskDir || !('children' in taskDir)) {
                return {
                    volatile: {
                        ...currentVolatile,
                        currentTasks: [],
                        tasksVersion: (currentVolatile.tasksVersion || 0) + 1
                    },
                    persistent: currentPersistent
                };
            }
            
            for (const child of (taskDir as any).children) {
                if ('children' in child) {
                    // This is a project folder
                    await scanProjectFolder(app, child, tasks);
                }
            }
        } else {
            // Scan specific project folder
            const projectPath = `${taskDirectory}/${currentProjectName}`;
            const projectFolder = app.vault.getAbstractFileByPath(projectPath);
            
            if (projectFolder && 'children' in projectFolder) {
                await scanProjectFolder(app, projectFolder, tasks);
            }
        }
        
    } catch (error) {
        return {
            volatile: {
                ...currentVolatile,
                currentTasks: [],
                tasksVersion: (currentVolatile.tasksVersion || 0) + 1
            },
            persistent: currentPersistent
        };
    }
    
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
            // Increment version for O(1) cache key generation
            tasksVersion: (currentVolatile.tasksVersion || 0) + 1
        },
        persistent: updatedPersistent
    };
}

async function scanProjectFolder(app: App, projectFolder: any, tasks: ITask[]): Promise<void> {
    const markdownFiles = projectFolder.children.filter((file: any) =>
        file.name.endsWith('.md') && 'extension' in file
    );

    for (const file of markdownFiles) {
        if (!('path' in file)) continue;

        try {
            const fileContent = await app.vault.read(file);
            const task = parseTaskFromContent(fileContent, file.path);
            tasks.push(task);
        } catch (error) {
            new Notice(`Task parsing failed: ${file.name} - ${error.message}`, 5000);
        }
    }
}

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

    // Get tasks from index (O(n) where n = number of tasks, not files to scan)
    const tasks = taskIndex.getTasks(currentProjectName);

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