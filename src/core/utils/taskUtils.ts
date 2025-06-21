import { ITask } from '../../interfaces/ITask';

export function parseTaskFromContent(fileContent: string, filePath: string): ITask {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const frontmatterMatch = fileContent.match(frontmatterRegex);
    
    if (!frontmatterMatch) {
        throw new Error(`No frontmatter found in ${filePath}`);
    }

    const frontmatterText = frontmatterMatch[1];
    const frontmatter = parseFrontmatter(frontmatterText);
    
    validateTaskFrontmatter(frontmatter);
    
    const contentBody = fileContent.replace(frontmatterRegex, '').trim();
    const { totalSubtasks, completedSubtasks } = parseSubtasks(contentBody);
    
    const task: ITask = {
        name: frontmatter.name,
        start: frontmatter.start,
        end: frontmatter.end ?? '',
        category: frontmatter.category ?? 'default',
        status: frontmatter.status ?? 'planned',
        priority: frontmatter.priority ?? 5,
        filePath,
        content: contentBody,
        totalSubtasks,
        completedSubtasks
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

function parseFrontmatter(frontmatterText: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = frontmatterText.split('\n');
    
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        if (key && value) {
            if (key === 'priority') {
                result[key] = parseInt(value, 10);
            } else {
                result[key] = value;
            }
        }
    }
    
    return result;
}

function parseSubtasks(content: string): { totalSubtasks: number; completedSubtasks: number } {
    const subtaskRegex = /^\s*-\s*\[( |x)\]/gim;
    const matches = content.match(subtaskRegex);
    
    if (!matches) {
        return { totalSubtasks: 0, completedSubtasks: 0 };
    }
    
    const totalSubtasks = matches.length;
    const completedSubtasks = matches.filter(match => match.includes('[x]')).length;
    
    return { totalSubtasks, completedSubtasks };
}