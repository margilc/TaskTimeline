import { App, TFile, TFolder } from 'obsidian';
import { ITemplate } from '../../interfaces/ITemplate';

/**
 * Parse a template file's content into an ITemplate.
 * Expects frontmatter with default_length_days, default_status, default_priority, default_category.
 */
export function parseTemplateFromContent(fileContent: string, filename: string): ITemplate {
    const name = filename.replace(/^template_/, '').replace(/\.md$/, '');

    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const frontmatterMatch = fileContent.match(frontmatterRegex);

    let defaultLengthDays: number | undefined;
    let defaultStatus: string | undefined;
    let defaultPriority: number | undefined;
    let defaultCategory: string | undefined;

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
            }
        }
    }

    const bodyContent = frontmatterMatch
        ? fileContent.replace(frontmatterRegex, '').trim()
        : fileContent.trim();

    return { name, defaultLengthDays, defaultStatus, defaultPriority, defaultCategory, bodyContent };
}

/**
 * Load all templates from {taskDirectory}/templates/.
 * Looks for files matching template_*.md.
 */
export async function loadTemplates(app: App, taskDirectory: string): Promise<ITemplate[]> {
    const templatesPath = `${taskDirectory}/templates`;
    const dir = app.vault.getAbstractFileByPath(templatesPath);

    if (!dir || !(dir instanceof TFolder)) return [];

    const templates: ITemplate[] = [];

    for (const child of dir.children) {
        if (!(child instanceof TFile)) continue;
        if (child.extension !== 'md') continue;
        if (!child.name.startsWith('template_')) continue;

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

const DEFAULT_TEMPLATE_CONTENT = `---
default_length_days: 7
default_status: default
default_priority: 5
default_category: default
---

## Subtasks
- [ ] Add your subtasks here
`;

/**
 * Ensure the templates folder and template_default.md exist.
 * Creates them if missing.
 */
export async function ensureTemplatesFolder(app: App, taskDirectory: string): Promise<void> {
    const templatesPath = `${taskDirectory}/templates`;
    const defaultTemplatePath = `${templatesPath}/template_default.md`;

    // Create folder if missing
    if (!app.vault.getAbstractFileByPath(templatesPath)) {
        await app.vault.createFolder(templatesPath);
    }

    // Create default template if missing
    if (!app.vault.getAbstractFileByPath(defaultTemplatePath)) {
        await app.vault.create(defaultTemplatePath, DEFAULT_TEMPLATE_CONTENT);
    }
}
