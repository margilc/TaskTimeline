import { parseTemplateFromContent } from '../src/core/utils/templateUtils';

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

        expect(template.name).toBe('default_weekly');
        expect(template.defaultLengthDays).toBe(5);
        expect(template.defaultStatus).toBe('01 To Do');
        expect(template.defaultPriority).toBe(1);
        expect(template.defaultCategory).toBe('internal');
        expect(template.horizontalMode).toBe(true);
        expect(template.bodyContent).toBe('# Monday\n- [ ] internal');
    });
});
