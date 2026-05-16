import { IAppState, IPersistentState } from '../src/interfaces/IAppState';
import { isGroupFolded, updateGroupFold } from '../src/core/update/updateGroupFold';

function createState(persistent: Partial<IPersistentState> = {}): IAppState {
    return {
        persistent: {
            currentProjectName: 'Project A',
            boardGrouping: {
                groupBy: 'category',
                availableGroups: ['Development', 'Design']
            },
            foldedGroups: {},
            ...persistent
        },
        volatile: {}
    };
}

describe('group fold state', () => {
    it('toggles a group in the current project and grouping', () => {
        const folded = updateGroupFold(createState(), { groupName: 'Development' });

        expect(isGroupFolded(folded.persistent, 'Development')).toBe(true);
        expect(folded.persistent.foldedGroups?.['Project A'].category).toEqual(['Development']);

        const unfolded = updateGroupFold(folded, { groupName: 'Development' });

        expect(isGroupFolded(unfolded.persistent, 'Development')).toBe(false);
        expect(unfolded.persistent.foldedGroups?.['Project A'].category).toEqual([]);
    });

    it('keeps fold state scoped by project and grouping variable', () => {
        const state = createState({
            foldedGroups: {
                'Project A': {
                    category: ['Development'],
                    status: ['In Progress']
                },
                'Project B': {
                    category: ['Research']
                }
            }
        });

        const result = updateGroupFold(state, { groupName: 'Design' });

        expect(result.persistent.foldedGroups?.['Project A'].category).toEqual(['Development', 'Design']);
        expect(result.persistent.foldedGroups?.['Project A'].status).toEqual(['In Progress']);
        expect(result.persistent.foldedGroups?.['Project B'].category).toEqual(['Research']);
    });

    it('can explicitly set the folded value', () => {
        const folded = updateGroupFold(createState(), { groupName: 'Development', folded: true });
        const stillFolded = updateGroupFold(folded, { groupName: 'Development', folded: true });
        const unfolded = updateGroupFold(stillFolded, { groupName: 'Development', folded: false });

        expect(stillFolded.persistent.foldedGroups?.['Project A'].category).toEqual(['Development']);
        expect(unfolded.persistent.foldedGroups?.['Project A'].category).toEqual([]);
    });

    it('falls back to All Projects when no current project is set', () => {
        const result = updateGroupFold(createState({ currentProjectName: undefined }), {
            groupName: 'Development'
        });

        expect(result.persistent.foldedGroups?.['All Projects'].category).toEqual(['Development']);
    });
});
