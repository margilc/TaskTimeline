import { generateAvailableGroups } from '../src/core/utils/groupingUtils';

describe('Row group ordering (persistent drag reorder)', () => {
    describe('generateAvailableGroups stable order', () => {
        it('uses stored order for status and appends newly discovered groups (does not re-sort)', () => {
            const tasks: any[] = [
                { status: 'In Progress' },
                { status: 'Blocked' },
                { status: 'Review' },
                { status: 'Not Started' },
                { status: 'QA' }, // new/custom status not in stored order
            ];

            const persistent: any = {
                groupingOrderings: {
                    'Project A': {
                        status: ['Review', 'Blocked', 'In Progress', 'Not Started']
                    }
                }
            };

            const groups = generateAvailableGroups(tasks as any, 'status', persistent, 'Project A');

            // Stored order should be preserved exactly
            expect(groups.slice(0, 4)).toEqual(['Review', 'Blocked', 'In Progress', 'Not Started']);
            // New group should be appended (not used to re-sort whole list)
            expect(groups).toContain('QA');
            expect(groups[groups.length - 1]).toBe('QA');
        });

        it('when there is no stored order, falls back to default status ordering', () => {
            const tasks: any[] = [
                { status: 'In Progress' },
                { status: 'Not Started' },
                { status: 'Blocked' },
            ];

            const persistent: any = { groupingOrderings: { 'Project A': { status: [] } } };
            const groups = generateAvailableGroups(tasks as any, 'status', persistent, 'Project A');

            // Default ordering from groupingUtils: Not Started < In Progress < Blocked
            expect(groups).toEqual(['Not Started', 'In Progress', 'Blocked']);
        });

        it('deduplicates stored order entries before appending discovered groups', () => {
            const tasks: any[] = [
                { category: 'internal' },
                { category: 'external' },
            ];

            const persistent: any = {
                groupingOrderings: {
                    'Project A': {
                        category: ['internal', 'internal', 'external']
                    }
                }
            };

            const groups = generateAvailableGroups(tasks as any, 'category', persistent, 'Project A');

            expect(groups).toEqual(['internal', 'external']);
        });

        it('normalizes whitespace around group values', () => {
            const tasks: any[] = [
                { category: 'internal' },
                { category: ' internal ' },
            ];

            const groups = generateAvailableGroups(tasks as any, 'category');

            expect(groups).toEqual(['internal']);
        });
    });
});



