import { parseTemplateFromContent } from '../src/core/utils/templateUtils';
import DEFAULT_PROJECT_TEMPLATE from '../src/templates/default_project.md';
import DEFAULT_WEEKLY_TEMPLATE from '../src/templates/default_weekly.md';

describe('bundled default templates', () => {
    test('default_project parses with task defaults', () => {
        const t = parseTemplateFromContent(DEFAULT_PROJECT_TEMPLATE, 'default_project.md');
        expect(t.name).toBe('project');
        expect(t.defaultLengthDays).toBe(7);
        expect(t.horizontalMode).toBeUndefined();
    });

    test('default_weekly is horizontal with five day columns', () => {
        const t = parseTemplateFromContent(DEFAULT_WEEKLY_TEMPLATE, 'default_weekly.md');
        expect(t.name).toBe('weekly');
        expect(t.horizontalMode).toBe(true);
        expect(t.defaultLengthDays).toBe(5);
        const days = (t.bodyContent.match(/^# /gm) || []).length;
        expect(days).toBe(5);
        expect(t.bodyContent).toContain('# Friday');
    });
});

describe('parseTemplateFromContent', () => {
    test('parses default weekly horizontal template metadata', () => {
        const template = parseTemplateFromContent(`---
default_length_days: 5
default_status: 01 To Do
default_priority: 1
default_category: internal
horizontal_mode: true
---
# Monday
- [ ] internal`, 'default_weekly.md');

        expect(template.name).toBe('weekly');
        expect(template.defaultLengthDays).toBe(5);
        expect(template.defaultStatus).toBe('01 To Do');
        expect(template.defaultPriority).toBe(1);
        expect(template.defaultCategory).toBe('internal');
        expect(template.horizontalMode).toBe(true);
        expect(template.bodyContent).toBe('# Monday\n- [ ] internal');
    });
});
