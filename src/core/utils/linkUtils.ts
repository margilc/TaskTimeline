import { ITask } from '../../interfaces/ITask';
import { nameToIdentifier } from './fileRenameUtils';

/**
 * Resolve raw wiki-link targets stored in linkedTaskIds to actual task IDs.
 *
 * Matching priority:
 *   1. Exact task ID match (e.g., "20240115_DevelopLogin")
 *   2. Case-insensitive task name match
 *   3. Identifier match: nameToIdentifier(linkText) matches the identifier
 *      portion of a task ID (the part after the date prefix)
 *
 * Mutates tasks in-place. Self-links and duplicates are excluded.
 */
export function resolveTaskLinks(tasks: ITask[]): void {
    const byId = new Map<string, string>();
    const byNameLower = new Map<string, string>();
    const byIdentifier = new Map<string, string>();

    for (const task of tasks) {
        byId.set(task.id, task.id);
        byNameLower.set(task.name.toLowerCase(), task.id);

        const underscoreIdx = task.id.indexOf('_');
        if (underscoreIdx !== -1) {
            const identifier = task.id.substring(underscoreIdx + 1).toLowerCase();
            byIdentifier.set(identifier, task.id);
        }
    }

    for (const task of tasks) {
        if (!task.linkedTaskIds || task.linkedTaskIds.length === 0) {
            task.linkedTaskIds = undefined;
            continue;
        }

        const resolved = new Set<string>();
        for (const rawLink of task.linkedTaskIds) {
            const targetId = resolveLink(rawLink, byId, byNameLower, byIdentifier);
            if (targetId && targetId !== task.id) {
                resolved.add(targetId);
            }
        }

        task.linkedTaskIds = resolved.size > 0 ? [...resolved] : undefined;
    }
}

function resolveLink(
    linkText: string,
    byId: Map<string, string>,
    byNameLower: Map<string, string>,
    byIdentifier: Map<string, string>
): string | undefined {
    if (byId.has(linkText)) return byId.get(linkText);

    const lowerLink = linkText.toLowerCase();
    if (byNameLower.has(lowerLink)) return byNameLower.get(lowerLink);

    const identFromLink = nameToIdentifier(linkText).toLowerCase();
    if (identFromLink && byIdentifier.has(identFromLink)) {
        return byIdentifier.get(identFromLink);
    }

    return undefined;
}
