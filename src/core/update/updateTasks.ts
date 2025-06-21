import { App, Notice } from 'obsidian';
import { IPersistentState, IVolatileState } from '../../interfaces/IAppState';
import { ITask } from '../../interfaces/ITask';
import { parseTaskFromContent } from '../utils/taskUtils';

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
            volatile: { ...currentVolatile, currentTasks: [] },
            persistent: currentPersistent
        };
    }
    
    try {
        if (currentProjectName === 'All Projects') {
            // Scan all project folders in the task directory
            const taskDir = app.vault.getAbstractFileByPath(taskDirectory);
            if (!taskDir || !('children' in taskDir)) {
                return {
                    volatile: { ...currentVolatile, currentTasks: [] },
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
        console.error('Failed to update tasks:', error);
        return {
            volatile: { ...currentVolatile, currentTasks: [] },
            persistent: currentPersistent
        };
    }
    
    return {
        volatile: { ...currentVolatile, currentTasks: tasks },
        persistent: currentPersistent
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
            console.warn(`Failed to parse task file ${file.path}:`, error.message);
            new Notice(`Task parsing failed: ${file.name} - ${error.message}`, 5000);
        }
    }
}