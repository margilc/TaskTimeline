import { hasHorizontalModeFrontmatter, parseHorizontalTaskContent, serializeHorizontalTaskColumns, shouldUseHorizontalTaskView } from '../src/core/utils/horizontalTaskUtils';

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
