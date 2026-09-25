import { continueListItem, hasHorizontalModeFrontmatter, mergeColumnsForSave, parseHorizontalTaskContent, serializeHorizontalTaskColumns, shouldUseHorizontalTaskView } from '../src/core/utils/horizontalTaskUtils';

describe('parseHorizontalTaskContent', () => {
    test('creates frontmatter and top-level section columns', () => {
        const result = parseHorizontalTaskContent(`---
name: Horizontal Task
start: 2024-01-15
horizontal_mode: true
---
# Overview
Overview content

## Details
Nested heading stays in overview

# Next Steps
- [ ] Do the thing`);

        expect(result.frontmatterText).toBe('name: Horizontal Task\nstart: 2024-01-15\nhorizontal_mode: true');
        expect(result.columns).toHaveLength(3);
        expect(result.columns[0]).toMatchObject({
            id: 'frontmatter',
            title: 'Frontmatter',
            type: 'frontmatter',
        });
        expect(result.columns[1]).toMatchObject({
            title: 'Overview',
            type: 'section',
        });
        expect(result.columns[1].content).toContain('## Details');
        expect(result.columns[2]).toMatchObject({
            title: 'Next Steps',
            content: '- [ ] Do the thing',
            type: 'section',
        });
    });

    test('adds a body column for content before the first top-level header', () => {
        const result = parseHorizontalTaskContent(`---
name: Horizontal Task
start: 2024-01-15
---
Intro without a top-level header.

# Section
Section content`);

        expect(result.columns.map(column => column.title)).toEqual(['Frontmatter', 'Body', 'Section']);
        expect(result.columns[1]).toMatchObject({
            content: 'Intro without a top-level header.',
            type: 'body',
        });
    });

    test('throws when frontmatter is missing', () => {
        expect(() => parseHorizontalTaskContent('# Section\nContent')).toThrow('No frontmatter found');
    });
});

describe('shouldUseHorizontalTaskView', () => {
    test('only routes explicitly flagged tasks to the horizontal view', () => {
        expect(shouldUseHorizontalTaskView({ horizontalMode: true })).toBe(true);
        expect(shouldUseHorizontalTaskView({ horizontalMode: false })).toBe(false);
        expect(shouldUseHorizontalTaskView({})).toBe(false);
    });
});

describe('serializeHorizontalTaskColumns', () => {
    test('serializes editable columns back to markdown', () => {
        const parsed = parseHorizontalTaskContent(`---
name: Horizontal Task
start: 2024-01-15
horizontal_mode: true
---
Intro

# First
First content

# Second
Second content`);

        parsed.columns[0].content = 'name: Edited Task\nstart: 2024-01-15\nhorizontal_mode: true';
        parsed.columns[1].content = 'Edited intro';
        parsed.columns[2].content = 'Edited first';

        expect(serializeHorizontalTaskColumns(parsed.columns)).toBe(`---
name: Edited Task
start: 2024-01-15
horizontal_mode: true
---

Edited intro

# First
Edited first

# Second
Second content
`);
    });
});

describe('hasHorizontalModeFrontmatter', () => {
    test('detects horizontal mode without requiring full task validation', () => {
        expect(hasHorizontalModeFrontmatter(`---
horizontal_mode: true
start: 26/06/2025
---
Body`)).toBe(true);
    });

    test('supports quoted true values and rejects missing flags', () => {
        expect(hasHorizontalModeFrontmatter(`---
horizontal_mode: "true"
---
Body`)).toBe(true);

        expect(hasHorizontalModeFrontmatter(`---
name: Normal Task
---
Body`)).toBe(false);
    });
});

describe('fenced code blocks (corruption guard)', () => {
    const doc = [
        '---', 'name: T', 'start: 2026-01-01', 'horizontal_mode: true', '---',
        '# Notes',
        'text',
        '```bash',
        '# this is a shell comment, not a section header',
        'echo hi',
        '```',
        'after',
    ].join('\n');
    const { parseHorizontalTaskContent, serializeHorizontalTaskColumns } = require('../src/core/utils/horizontalTaskUtils');

    it('does not split sections on # lines inside fences', () => {
        const parsed = parseHorizontalTaskContent(doc);
        const sections = parsed.columns.filter((c: any) => c.type === 'section');
        expect(sections).toHaveLength(1);
        expect(sections[0].title).toBe('Notes');
        expect(sections[0].content).toContain('# this is a shell comment, not a section header');
    });

    it('round-trips fenced content losslessly', () => {
        const parsed = parseHorizontalTaskContent(doc);
        const serialized = serializeHorizontalTaskColumns(parsed.columns);
        const reparsed = parseHorizontalTaskContent(serialized);
        expect(reparsed.columns.map((c: any) => c.content)).toEqual(parsed.columns.map((c: any) => c.content));
    });
});

describe('mergeColumnsForSave', () => {
    const doc = (body: string) => parseHorizontalTaskContent(`---\nname: T\nstart: 2024-01-15\n---\n${body}`).columns;

    test('keeps external edits to untouched columns', () => {
        const local = doc('# A\na\n# B\nb');
        local[1] = { ...local[1], content: 'a edited' };
        const disk = doc('# A\na\n# B\nb external');

        const merged = mergeColumnsForSave(local, disk, new Set([local[1].id]));
        expect(serializeHorizontalTaskColumns(merged)).toContain('# A\na edited\n\n# B\nb external');
    });

    test('a heading typed inside a column does not duplicate content on the next save', () => {
        // The user typed "# New" into column A; the previous save wrote it,
        // so on disk A is now split into two sections.
        const local = doc('# A\na');
        local[1] = { ...local[1], content: 'a\n# New\nnew text more' };
        const disk = doc('# A\na\n# New\nnew text');

        const merged = mergeColumnsForSave(local, disk, new Set([local[1].id]));
        const out = serializeHorizontalTaskColumns(merged);
        expect(out.match(/# New/g)).toHaveLength(1);
        expect(out).toContain('new text more');
    });
});

describe('continueListItem', () => {
    test('continues bullets and carries an unchecked checkbox', () => {
        expect(continueListItem('- item', 6)).toEqual({ kind: 'continue', insert: '\n- ' });
        expect(continueListItem('  * [x] done', 12)).toEqual({ kind: 'continue', insert: '\n  * [ ] ' });
    });

    test('increments ordered lists', () => {
        expect(continueListItem('9. nine', 7)).toEqual({ kind: 'continue', insert: '\n10. ' });
        expect(continueListItem('1) one', 6)).toEqual({ kind: 'continue', insert: '\n2) ' });
    });

    test('ends the list on an empty item', () => {
        expect(continueListItem('- [ ] ', 6)).toEqual({ kind: 'end', prefixLength: 6 });
        expect(continueListItem('- ', 2)).toEqual({ kind: 'end', prefixLength: 2 });
    });

    test('ignores non-list lines and a cursor inside the bullet', () => {
        expect(continueListItem('plain text', 10)).toBeNull();
        expect(continueListItem('- item', 1)).toBeNull();
    });
});
