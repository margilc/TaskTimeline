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

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/;
const TOP_LEVEL_HEADER_REGEX = /^#\s+(.+?)\s*#*\s*$/;

export function hasHorizontalModeFrontmatter(fileContent: string): boolean {
    const frontmatterMatch = fileContent.match(FRONTMATTER_REGEX);
    if (!frontmatterMatch) return false;

    return frontmatterMatch[1]
        .split(/\r?\n/)
        .some(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) return false;

            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
            return key === 'horizontal_mode' && value.toLowerCase() === 'true';
        });
}

export function parseHorizontalTaskContent(fileContent: string): IHorizontalTaskDocument {
    const frontmatterMatch = fileContent.match(FRONTMATTER_REGEX);

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

    for (const line of lines) {
        const headerMatch = line.match(TOP_LEVEL_HEADER_REGEX);

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
