import { App, TAbstractFile } from 'obsidian';
import { IVolatileState, IPersistentState } from '../../interfaces/IAppState';

/**
 * Lists all subfolder names within a given directory path.
 */
async function listSubfolderNames(app: App, directoryPath: string): Promise<string[]> {
    try {
        const directory = app.vault.getAbstractFileByPath(directoryPath);
        
        if (!directory || !('children' in directory)) {
            return [];
        }
        
        const folderWithChildren = directory as any;
        
        const subfolderNames = folderWithChildren.children
            .filter((item: TAbstractFile) => 'children' in item)
            .map((folder: TAbstractFile) => folder.name);
        
        return subfolderNames;
        
    } catch (error) {
        console.error(`Error listing subfolders in ${directoryPath}:`, error);
        return [];
    }
}

/**
 * Checks if a directory exists and is actually a folder.
 */
function directoryExists(app: App, directoryPath: string): boolean {
    try {
        const directory = app.vault.getAbstractFileByPath(directoryPath);
        return directory !== null && 'children' in directory;
    } catch (error) {
        return false;
    }
}

export async function updateProjects(
    app: App,
    currentVolatileState: IVolatileState,
    currentPersistentState: IPersistentState
): Promise<{ volatile: IVolatileState; persistent: IPersistentState }> {
    const taskDirectory = currentPersistentState.settings?.taskDirectory;
    
    if (!taskDirectory) {
        return {
            volatile: { ...currentVolatileState, availableProjects: ['All Projects'] },
            persistent: currentPersistentState
        };
    }

    try {
        if (!directoryExists(app, taskDirectory)) {
            return {
                volatile: { ...currentVolatileState, availableProjects: ['All Projects'] },
                persistent: currentPersistentState
            };
        }

        const projectFolders = await listSubfolderNames(app, taskDirectory);
        const availableProjects = ['All Projects', ...projectFolders];
        
        let updatedPersistent = currentPersistentState;
        const currentProject = currentPersistentState.currentProjectName || 'All Projects';
        if (currentProject !== 'All Projects' && !projectFolders.includes(currentProject)) {
            updatedPersistent = { ...currentPersistentState, currentProjectName: 'All Projects' };
        }

        return {
            volatile: { ...currentVolatileState, availableProjects },
            persistent: updatedPersistent
        };
        
    } catch (error) {
        console.error('updateProjects error:', error);
        return {
            volatile: { ...currentVolatileState, availableProjects: ['All Projects'] },
            persistent: currentPersistentState
        };
    }
}