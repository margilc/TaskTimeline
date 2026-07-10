import { App, TFile } from 'obsidian';

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

export function formatDateForFilename(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Canonical task filename: `YYYYMMDD_identifier.md`, with `_N` appended for
 * collision-bumped variants (n > 0). Shared by task creation and rename
 * canonicalization so the two can never drift.
 */
export function taskFileName(dateStr: string, identifier: string, n = 0): string {
    return n === 0
        ? `${dateStr}_${identifier}.md`
        : `${dateStr}_${identifier}_${n}.md`;
}

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
    updates: Record<string, string | number | undefined>,
    deleteKeys: string[] = []
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
        for (const key of deleteKeys) {
            delete frontmatter[key];
        }
    });
}
