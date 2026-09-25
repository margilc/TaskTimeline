import { FRONTMATTER_BLOCK_REGEX, isFenceLine, parseFrontmatter } from './taskUtils';

export type HorizontalTaskColumnType = 'frontmatter' | 'body' | 'section';

export interface IHorizontalTaskColumn {
    id: string;
    title: string;
    content: string;
    type: HorizontalTaskColumnType;
}

export interface IHorizontalTaskDocument {
    frontmatterText: string;
    columns: IHorizontalTaskColumn[];
}

export function shouldUseHorizontalTaskView(task: { horizontalMode?: boolean }): boolean {
    return task.horizontalMode === true;
}

const TOP_LEVEL_HEADER_REGEX = /^#\s+(.+?)\s*#*\s*$/;

export function hasHorizontalModeFrontmatter(fileContent: string): boolean {
    const frontmatterMatch = fileContent.match(FRONTMATTER_BLOCK_REGEX);
    if (!frontmatterMatch) return false;
    return parseFrontmatter(frontmatterMatch[1]).horizontal_mode === true;
}

export function parseHorizontalTaskContent(fileContent: string): IHorizontalTaskDocument {
    const frontmatterMatch = fileContent.match(FRONTMATTER_BLOCK_REGEX);

    if (!frontmatterMatch) {
        throw new Error('No frontmatter found');
    }

    const frontmatterText = frontmatterMatch[1].trim();
    const body = fileContent.slice(frontmatterMatch[0].length);
    const columns: IHorizontalTaskColumn[] = [{
        id: 'frontmatter',
        title: 'Frontmatter',
        content: frontmatterText,
        type: 'frontmatter',
    }];

    columns.push(...parseTopLevelSections(body));

    return {
        frontmatterText,
        columns,
    };
}

export function serializeHorizontalTaskColumns(columns: IHorizontalTaskColumn[]): string {
    const frontmatterColumn = columns.find(column => column.type === 'frontmatter');
    const bodyColumns = columns.filter(column => column.type === 'body');
    const sectionColumns = columns.filter(column => column.type === 'section');

    const frontmatter = frontmatterColumn?.content.trim() ?? '';
    const bodyParts = [
        ...bodyColumns.map(column => column.content.trim()).filter(Boolean),
        ...sectionColumns.map(column => {
            const content = column.content.trim();
            return content ? `# ${column.title}\n${content}` : `# ${column.title}`;
        }),
    ];

    const body = bodyParts.join('\n\n').trim();
    return body ? `---\n${frontmatter}\n---\n\n${body}\n` : `---\n${frontmatter}\n---\n`;
}

function parseTopLevelSections(content: string): IHorizontalTaskColumn[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const sections: IHorizontalTaskColumn[] = [];
    let pendingBody: string[] = [];
    let currentSection: { title: string; lines: string[] } | null = null;

    const flushBody = () => {
        const bodyContent = pendingBody.join('\n').trim();
        if (bodyContent) {
            sections.push({
                id: 'body',
                title: 'Body',
                content: bodyContent,
                type: 'body',
            });
        }
        pendingBody = [];
    };

    const flushSection = () => {
        if (!currentSection) return;
        sections.push({
            id: `section-${sections.length}`,
            title: currentSection.title,
            content: currentSection.lines.join('\n').trim(),
            type: 'section',
        });
    };

    let inFence = false;
    for (const line of lines) {
        // A "# comment" inside a fenced code block is literal text — splitting
        // on it would tear the block apart and corrupt the file on save.
        if (isFenceLine(line)) inFence = !inFence;
        const headerMatch = inFence ? null : line.match(TOP_LEVEL_HEADER_REGEX);

        if (headerMatch) {
            if (currentSection) {
                flushSection();
            } else {
                flushBody();
            }

            currentSection = {
                title: headerMatch[1].trim(),
                lines: [],
            };
            continue;
        }

        if (currentSection) {
            currentSection.lines.push(line);
        } else {
            pendingBody.push(line);
        }
    }

    flushSection();

    return sections;
}

/**
 * The columns to write on save: the user's dirty columns laid over a fresh
 * parse of the file, so external edits to other columns survive.
 *
 * Section ids are positional (section-N), so an id only names the same
 * section when both sides have the same structure. When they differ (a
 * `# heading` typed inside a column splits it on the next parse, or a
 * section was added elsewhere), matching by id would pair the wrong sections
 * and duplicate content, so the local columns are written as they are.
 */
export function mergeColumnsForSave(
    local: IHorizontalTaskColumn[],
    disk: IHorizontalTaskColumn[],
    dirtyIds: ReadonlySet<string>
): IHorizontalTaskColumn[] {
    const sameStructure = local.length === disk.length && local.every((column, i) =>
        column.id === disk[i].id && column.title === disk[i].title && column.type === disk[i].type
    );
    if (!sameStructure) return local;
    return disk.map((diskColumn, i) => dirtyIds.has(diskColumn.id) ? local[i] : diskColumn);
}

const LIST_ITEM_PREFIX_REGEX = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/;

export type ListContinuation =
    | { kind: 'continue'; insert: string }
    | { kind: 'end'; prefixLength: number };

/**
 * What Enter should do on a list line, matching Obsidian's editor: continue
 * the list with the next bullet (incrementing numbers, carrying an unchecked
 * checkbox), or end it when the item is empty. Null when the line isn't a
 * list item or the cursor sits inside the bullet itself.
 */
export function continueListItem(lineText: string, cursorColumn: number): ListContinuation | null {
    const match = lineText.match(LIST_ITEM_PREFIX_REGEX);
    if (!match || cursorColumn < match[0].length) return null;

    const [prefix, indent, bullet, gap, checkbox] = match;
    if (lineText.slice(prefix.length).trim() === '') {
        return { kind: 'end', prefixLength: prefix.length };
    }

    const ordered = bullet.match(/^(\d+)([.)])$/);
    const nextBullet = ordered ? `${Number(ordered[1]) + 1}${ordered[2]}` : bullet;
    return { kind: 'continue', insert: `\n${indent}${nextBullet}${gap}${checkbox ? '[ ] ' : ''}` };
}
