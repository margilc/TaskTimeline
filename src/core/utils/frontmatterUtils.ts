import { App, TFile } from 'obsidian';

/**
 * Update task frontmatter using Obsidian's safe processFrontMatter API.
 * This handles YAML parsing correctly and preserves formatting.
 *
 * @param app - Obsidian app instance
 * @param filePath - Path to the task file
 * @param updates - Object with key-value pairs to update in frontmatter
 */
export async function updateTaskFrontmatter(
    app: App,
    filePath: string,
    updates: Record<string, string | number | undefined>
): Promise<void> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
        throw new Error(`File not found: ${filePath}`);
    }

    await app.fileManager.processFrontMatter(file, (frontmatter) => {
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                frontmatter[key] = value;
            }
        }
    });
}
