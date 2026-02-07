import { App, TFile, TFolder, TAbstractFile } from 'obsidian';
import { ITask } from '../interfaces/ITask';
import { parseTaskFromContent } from './utils/taskUtils';

/**
 * TaskIndex maintains an incremental index of tasks by file path.
 * Instead of scanning all files on every change, it updates only the affected files.
 */
export class TaskIndex {
    private app: App;
    private tasksByPath: Map<string, ITask> = new Map();
    private taskDirectory: string;
    private initialized: boolean = false;

    constructor(app: App, taskDirectory: string) {
        this.app = app;
        this.taskDirectory = taskDirectory;
    }

    /**
     * Initialize the index by scanning all task files once.
     */
    async initialize(): Promise<void> {
        this.tasksByPath.clear();
        await this.scanDirectory(this.taskDirectory);
        this.initialized = true;
    }

    /**
     * Check if the index has been initialized.
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Update task directory and reinitialize if changed.
     */
    async setTaskDirectory(taskDirectory: string): Promise<void> {
        if (this.taskDirectory !== taskDirectory) {
            this.taskDirectory = taskDirectory;
            await this.initialize();
        }
    }

    /**
     * Get all tasks, optionally filtered by project.
     */
    getTasks(projectName?: string): ITask[] {
        if (!projectName || projectName === 'All Projects') {
            return Array.from(this.tasksByPath.values());
        }

        // Filter by project path
        const projectPath = `${this.taskDirectory}/${projectName}/`;
        return Array.from(this.tasksByPath.entries())
            .filter(([path]) => path.startsWith(projectPath))
            .map(([, task]) => task);
    }

    /**
     * Handle file creation - add task to index if relevant.
     */
    async handleFileCreate(file: TAbstractFile): Promise<boolean> {
        if (!this.isRelevantFile(file)) return false;

        if (file instanceof TFile && file.extension === 'md') {
            await this.indexFile(file);
            return true;
        }
        return false;
    }

    /**
     * Handle file deletion - remove task from index if relevant.
     */
    handleFileDelete(file: TAbstractFile): boolean {
        if (!this.isRelevantPath(file.path)) return false;

        if (this.tasksByPath.has(file.path)) {
            this.tasksByPath.delete(file.path);
            return true;
        }
        return false;
    }

    /**
     * Handle file rename - update index with new path.
     */
    async handleFileRename(file: TAbstractFile, oldPath: string): Promise<boolean> {
        const wasRelevant = this.isRelevantPath(oldPath);
        const isRelevant = this.isRelevantFile(file);

        // Remove old path if it was in index
        if (wasRelevant && this.tasksByPath.has(oldPath)) {
            this.tasksByPath.delete(oldPath);
        }

        // Add new path if now relevant
        if (isRelevant && file instanceof TFile && file.extension === 'md') {
            await this.indexFile(file);
            return true;
        }

        return wasRelevant || isRelevant;
    }

    /**
     * Handle file modification - reparse the task.
     */
    async handleFileModify(file: TAbstractFile): Promise<boolean> {
        if (!this.isRelevantFile(file)) return false;

        if (file instanceof TFile && file.extension === 'md') {
            await this.indexFile(file);
            return true;
        }
        return false;
    }

    /**
     * Clear the entire index.
     */
    clear(): void {
        this.tasksByPath.clear();
        this.initialized = false;
    }

    /**
     * Get the number of indexed tasks.
     */
    size(): number {
        return this.tasksByPath.size;
    }

    /**
     * Check if a file is relevant to the task directory.
     */
    private isRelevantFile(file: TAbstractFile): boolean {
        return this.isRelevantPath(file.path);
    }

    /**
     * Check if a path is within the task directory.
     */
    private isRelevantPath(path: string): boolean {
        if (!path.startsWith(this.taskDirectory + '/')) return false;
        // Exclude template files
        if (path.startsWith(this.taskDirectory + '/templates/')) return false;
        return true;
    }

    /**
     * Index a single file.
     */
    private async indexFile(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const task = parseTaskFromContent(content, file.path);
            this.tasksByPath.set(file.path, task);
        } catch (error) {
            // If parsing fails, remove from index to avoid stale data
            this.tasksByPath.delete(file.path);
        }
    }

    /**
     * Recursively scan a directory for task files.
     */
    private async scanDirectory(dirPath: string): Promise<void> {
        const dir = this.app.vault.getAbstractFileByPath(dirPath);
        if (!dir || !(dir instanceof TFolder)) return;

        for (const child of dir.children) {
            if (child instanceof TFolder) {
                if (child.name === 'templates') continue;
                // Recurse into subdirectories (projects)
                await this.scanDirectory(child.path);
            } else if (child instanceof TFile && child.extension === 'md') {
                await this.indexFile(child);
            }
        }
    }
}
