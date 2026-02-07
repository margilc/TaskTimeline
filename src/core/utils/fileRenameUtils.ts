import { App, TFile } from 'obsidian';
import { ITask } from '../../interfaces/ITask';

/**
 * Sanitize a task name into a filename identifier.
 * Strips non-alphanumeric characters, replaces spaces with underscores, truncates to 20 chars.
 */
export function nameToIdentifier(name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    return safeName.slice(0, 20);
}

/**
 * Convert a filename identifier back to a human-readable name.
 * Replaces underscores with spaces.
 */
export function identifierToName(identifier: string): string {
    return identifier.replace(/_/g, ' ');
}

/**
 * Parse a task filename into its date and identifier components.
 * Returns null if the filename doesn't match the expected format.
 */
export function parseTaskFilename(filename: string): { dateStr: string; identifier: string } | null {
    const match = filename.match(/^(\d{8})_(.+)\.md$/);
    if (!match) return null;
    return { dateStr: match[1], identifier: match[2] };
}

/**
 * Rename a task file to match a new name (updates the identifier portion).
 * Returns the new file path, or null if no rename was needed.
 */
export async function renameTaskFileForNewName(
    app: App,
    filePath: string,
    newName: string
): Promise<string | null> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) return null;

    const pathParts = filePath.split('/');
    const currentFileName = pathParts[pathParts.length - 1];
    const directory = pathParts.slice(0, -1).join('/');

    const parsed = parseTaskFilename(currentFileName);
    if (!parsed) return null;

    const newIdentifier = nameToIdentifier(newName);
    if (!newIdentifier || parsed.identifier === newIdentifier) return null;

    let newFileName = `${parsed.dateStr}_${newIdentifier}.md`;
    let newPath = directory ? `${directory}/${newFileName}` : newFileName;
    let counter = 1;

    while (app.vault.getAbstractFileByPath(newPath)) {
        newFileName = `${parsed.dateStr}_${newIdentifier}_${counter}.md`;
        newPath = directory ? `${directory}/${newFileName}` : newFileName;
        counter++;
    }

    await app.vault.rename(file, newPath);
    return newPath;
}

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
    
    const currentPath = file.path;
    const pathParts = currentPath.split('/');
    const currentFileName = pathParts[pathParts.length - 1];
    const directory = pathParts.slice(0, -1).join('/');

    const parsed = parseTaskFilename(currentFileName);
    if (!parsed) return;

    const { dateStr: currentDateStr, identifier } = parsed;
    
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