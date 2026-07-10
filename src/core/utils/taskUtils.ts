import { ITask } from '../../interfaces/ITask';

/** Task id = filename without extension (task filenames are unique). */
export function taskIdFromPath(filePath: string): string {
    const fileName = filePath.split('/').pop() || filePath;
    return fileName.replace(/\.md$/, '');
}

/** The leading YAML frontmatter block, CRLF-tolerant. Group 1 = inner text. */
export const FRONTMATTER_BLOCK_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/;

export function parseTaskFromContent(fileContent: string, filePath: string): ITask {
    const frontmatterMatch = fileContent.match(FRONTMATTER_BLOCK_REGEX);

    if (!frontmatterMatch) {
        throw new Error(`No frontmatter found in ${filePath}`);
    }

    const frontmatterText = frontmatterMatch[1];
    const frontmatter = parseFrontmatter(frontmatterText);

    validateTaskFrontmatter(frontmatter);

    const contentBody = fileContent.slice(frontmatterMatch[0].length).trim();
    const { totalSubtasks, completedSubtasks } = parseSubtasks(contentBody);
    const rawLinks = extractWikiLinks(contentBody);

    const task: ITask = {
        id: taskIdFromPath(filePath),
        name: frontmatter.name,
        start: frontmatter.start,
        end: frontmatter.end ?? '',
        category: frontmatter.category ?? 'default',
        status: frontmatter.status ?? 'planned',
        priority: frontmatter.priority ?? 5,
        filePath,
        content: contentBody,
        horizontalMode: frontmatter.horizontal_mode === true,
        totalSubtasks,
        completedSubtasks,
        linkedTaskIds: rawLinks.length > 0 ? rawLinks : undefined
    };

    if (task.end && task.start > task.end) {
        throw new Error(`Start date (${task.start}) cannot be after end date (${task.end}) in ${filePath}`);
    }

    return task;
}

export function validateTaskFrontmatter(frontmatter: Record<string, any>): void {
    if (!frontmatter.name || typeof frontmatter.name !== 'string' || frontmatter.name.trim() === '') {
        throw new Error('Task must have a valid name field');
    }
    
    if (!frontmatter.start || typeof frontmatter.start !== 'string') {
        throw new Error('Task must have a valid start date field');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(frontmatter.start)) {
        throw new Error('Start date must be in YYYY-MM-DD format');
    }

    if (frontmatter.end && (!dateRegex.test(frontmatter.end))) {
        throw new Error('End date must be in YYYY-MM-DD format');
    }

    if (frontmatter.priority !== undefined) {
        const priority = parseInt(frontmatter.priority, 10);
        if (isNaN(priority) || priority < 1 || priority > 5) {
            throw new Error('Priority must be a number between 1 and 5');
        }
    }
}

export function parseFrontmatter(frontmatterText: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = frontmatterText.split('\n');
    
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();

        // Strip surrounding YAML quotes. Obsidian's property editor sometimes
        // writes values quoted (e.g. when typed manually rather than picked
        // from the autocomplete dropdown), and without this `"Foo"` and `Foo`
        // hash to different group keys — producing duplicate group headers.
        if (value.length >= 2) {
            const first = value[0];
            const last = value[value.length - 1];
            if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
                value = value.substring(1, value.length - 1);
            }
        }

        if (key && value) {
            if (key === 'priority') {
                result[key] = parseInt(value, 10);
            } else if (key === 'horizontal_mode') {
                result[key] = value.toLowerCase() === 'true';
            } else {
                result[key] = value;
            }
        }
    }
    
    return result;
}

export function extractWikiLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
        const target = match[1].trim();
        if (target) {
            links.push(target);
        }
    }
    return links;
}

// The checkbox syntaxes Obsidian renders as task-list items: -, * and +
// bullets plus ordered items (1. / 1)), with [ ] / [x] / [X].
const CHECKBOX_LINE_REGEX = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/;

/** Parse one line as a markdown task checkbox; null if it isn't one.
 *  Shared by subtask progress counting and the horizontal view's toggling
 *  so the two can never disagree about which lines are checkboxes. */
export function parseCheckboxLine(line: string): { checked: boolean } | null {
    const m = line.match(CHECKBOX_LINE_REGEX);
    return m ? { checked: m[1] !== ' ' } : null;
}

function parseSubtasks(content: string): { totalSubtasks: number; completedSubtasks: number } {
    let totalSubtasks = 0;
    let completedSubtasks = 0;
    for (const line of content.split(/\r?\n/)) {
        const checkbox = parseCheckboxLine(line);
        if (checkbox) {
            totalSubtasks++;
            if (checkbox.checked) completedSubtasks++;
        }
    }
    return { totalSubtasks, completedSubtasks };
}