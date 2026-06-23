import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { ITemplate } from '../../interfaces/ITemplate';
import DEFAULT_PROJECT_TEMPLATE_CONTENT from '../../templates/default_project.md';
import DEFAULT_WEEKLY_TEMPLATE_CONTENT from '../../templates/default_weekly.md';

/**
 * Parse a template file's content into an ITemplate.
 * Expects frontmatter with default_length_days, default_status, default_priority, default_category.
 */
export function parseTemplateFromContent(fileContent: string, filename: string): ITemplate {
    const name = filename.replace(/^(template|default)_/, '').replace(/\.md$/, '');

    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const frontmatterMatch = fileContent.match(frontmatterRegex);

    let defaultLengthDays: number | undefined;
    let defaultStatus: string | undefined;
    let defaultPriority: number | undefined;
    let defaultCategory: string | undefined;
    let horizontalMode: boolean | undefined;

    if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;

            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            if (!key || !value) continue;

            switch (key) {
                case 'default_length_days':
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed) && parsed > 0) defaultLengthDays = parsed;
                    break;
                case 'default_status':
                    defaultStatus = value;
                    break;
                case 'default_priority': {
                    const p = parseInt(value, 10);
                    if (!isNaN(p) && p >= 1 && p <= 5) defaultPriority = p;
                    break;
                }
                case 'default_category':
                    defaultCategory = value;
                    break;
                case 'horizontal_mode':
                    horizontalMode = value.toLowerCase() === 'true';
                    break;
            }
        }
    }

    const bodyContent = frontmatterMatch
        ? fileContent.replace(frontmatterRegex, '').trim()
        : fileContent.trim();

    return { name, defaultLengthDays, defaultStatus, defaultPriority, defaultCategory, horizontalMode, bodyContent };
}

/**
 * Load all templates from {taskDirectory}/templates/.
 * Looks for files matching template_*.md and default_*.md.
 */
export async function loadTemplates(app: App, taskDirectory: string): Promise<ITemplate[]> {
    const templatesPath = `${taskDirectory}/templates`;
    const dir = app.vault.getAbstractFileByPath(templatesPath);

    if (!dir || !(dir instanceof TFolder)) return [];

    const templates: ITemplate[] = [];

    for (const child of dir.children) {
        if (!(child instanceof TFile)) continue;
        if (child.extension !== 'md') continue;
        if (!isTemplateFileName(child.name)) continue;

        try {
            const content = await app.vault.read(child);
            const template = parseTemplateFromContent(content, child.name);
            templates.push(template);
        } catch {
            // Skip unparseable template files
        }
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ensure the templates folder and the two default templates exist.
 * Default template contents live as editable .md files under src/templates/
 * and are inlined into the bundle at build time (esbuild text loader).
 * Only creates files that are missing — never overwrites user edits.
 */
export async function ensureTemplatesFolder(app: App, taskDirectory: string): Promise<void> {
    const templatesPath = `${taskDirectory}/templates`;

    await ensureFolder(app, templatesPath);
    await ensureFile(app, `${templatesPath}/default_project.md`, DEFAULT_PROJECT_TEMPLATE_CONTENT);
    await ensureFile(app, `${templatesPath}/default_weekly.md`, DEFAULT_WEEKLY_TEMPLATE_CONTENT);
}

/**
 * Create a folder unless it already exists on disk.
 * Uses adapter.exists() (real filesystem) rather than getAbstractFileByPath()
 * (metadata cache), which can miss folders on some setups — e.g. NTFS via WSL —
 * causing createFolder to throw "Folder already exists" on every load.
 * The catch is a final guard against that same race.
 */
async function ensureFolder(app: App, path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (await app.vault.adapter.exists(normalized)) return;
    try {
        await app.vault.createFolder(normalized);
    } catch (e) {
        if (!isAlreadyExistsError(e)) throw e;
    }
}

/** Create a file unless it already exists. Never overwrites user edits. */
async function ensureFile(app: App, path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    if (await app.vault.adapter.exists(normalized)) return;
    try {
        await app.vault.create(normalized, content);
    } catch (e) {
        if (!isAlreadyExistsError(e)) throw e;
    }
}

function isAlreadyExistsError(e: unknown): boolean {
    return e instanceof Error && /already exists/i.test(e.message);
}

function isTemplateFileName(filename: string): boolean {
    return filename.startsWith('template_') || filename.startsWith('default_');
}
