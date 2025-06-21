import { App } from 'obsidian';
import { IPersistentState } from '../../interfaces/IAppState';

export async function createProject(
    app: App,
    folderName: string,
    taskDirectory: string,
    setAsCurrent: boolean = true
): Promise<{ success: boolean; message: string; newPersistent?: IPersistentState }> {
    const sanitizedName = folderName.replace(/[/\\:*?"<>|]/g, '').trim();
    
    if (!sanitizedName) {
        return { success: false, message: "Invalid folder name after sanitization." };
    }

    const newFolderPath = `${taskDirectory}/${sanitizedName}`;

    try {
        const existingFolder = app.vault.getAbstractFileByPath(newFolderPath);
        if (existingFolder) {
            return { success: false, message: `Folder "${sanitizedName}" already exists.` };
        }

        await app.vault.createFolder(newFolderPath);
        
        const result = { success: true, message: `Folder "${sanitizedName}" created successfully.` };
        
        if (setAsCurrent) {
            return {
                ...result,
                newPersistent: { currentProjectName: sanitizedName } as Partial<IPersistentState>
            };
        }
        
        return result;
    } catch (error) {
        return { success: false, message: `Error creating folder: ${error.message}` };
    }
}