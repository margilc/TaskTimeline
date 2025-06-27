import { App, TFile } from 'obsidian';
import { ITask } from '../../interfaces/ITask';

/**
 * Renames a task file to match a new start date
 * Used by drag/drop, resize, and file modification operations
 */
export async function renameTaskFileForNewStartDate(
    app: App, 
    task: ITask, 
    newStartDate: string
): Promise<void> {
    const file = app.vault.getAbstractFileByPath(task.filePath);
    if (!file || !(file instanceof TFile)) {
        return;
    }
    
    // Extract current filename components
    const currentPath = file.path;
    const pathParts = currentPath.split('/');
    const currentFileName = pathParts[pathParts.length - 1];
    const directory = pathParts.slice(0, -1).join('/');
    
    // Parse current filename format: YYYYMMDD_IDENTIFIER.md
    const filenameMatch = currentFileName.match(/^(\d{8})_(.+)\.md$/);
    
    if (!filenameMatch) {
        // If filename doesn't match expected format, don't rename
        return;
    }
    
    const [, currentDateStr, identifier] = filenameMatch;
    
    // Format new date as YYYYMMDD
    const newDate = new Date(newStartDate);
    const newDateStr = formatDateForFilename(newDate);
    
    // Only rename if date actually changed
    if (currentDateStr === newDateStr) {
        return;
    }
    
    // Generate new filename with conflict resolution
    let newFileName = `${newDateStr}_${identifier}.md`;
    let newPath = directory ? `${directory}/${newFileName}` : newFileName;
    let counter = 1;
    
    // Ensure filename is unique
    while (app.vault.getAbstractFileByPath(newPath)) {
        newFileName = `${newDateStr}_${identifier}_${counter}.md`;
        newPath = directory ? `${directory}/${newFileName}` : newFileName;
        counter++;
    }
    
    // Rename the file
    await app.vault.rename(file, newPath);
}

function formatDateForFilename(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}