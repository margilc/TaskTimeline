import { generateAvailableGroups } from '../src/core/utils/groupingUtils';
import { updateGroupOrder } from '../src/core/update/updateGroupOrder';

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
    });

    describe('updateGroupOrder', () => {
        it('updates persistent.groupingOrderings[project][groupBy] and persistent.boardGrouping.availableGroups', () => {
            const persistent: any = {
                currentProjectName: 'Project A',
                boardGrouping: {
                    groupBy: 'status',
                    availableGroups: ['A', 'B', 'C']
                },
                groupingOrderings: {
                    'Project A': {
                        status: ['A', 'B', 'C']
                    }
                }
            };

            const volatile: any = {};

            const result = updateGroupOrder({} as any, persistent, volatile, {
                sourceIndex: 0,
                targetIndex: 2,
                groupName: 'A'
            });

            expect(result.persistent.groupingOrderings['Project A'].status).toEqual(['B', 'C', 'A']);
            expect(result.persistent.boardGrouping.availableGroups).toEqual(['B', 'C', 'A']);
        });
    });
});


