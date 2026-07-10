import { IAppState, IPersistentState, IVolatileState } from '../../interfaces/IAppState';

/**
 * Move a group one step up or down in the stored ordering for the current
 * project + groupBy. Returns null when nothing changes (unknown group, or
 * already at the edge).
 */
export function updateGroupOrder(
    state: IAppState,
    data: { groupName: string; direction: 'up' | 'down' }
): { persistent: IPersistentState; volatile: IVolatileState } | null {
    const persistent = state.persistent;
    const projectId = persistent.currentProjectName || 'All Projects';
    const groupBy = persistent.boardGrouping?.groupBy || 'none';
    const availableGroups = persistent.boardGrouping?.availableGroups || [];

    const currentIndex = availableGroups.indexOf(data.groupName);
    if (currentIndex === -1) return null;

    const targetIndex = data.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= availableGroups.length) return null;

    const newOrder = [...availableGroups];
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];

    const groupingOrderings = { ...(persistent.groupingOrderings || {}) };
    groupingOrderings[projectId] = {
        ...(groupingOrderings[projectId] || {}),
        [groupBy]: newOrder
    };

    return {
        persistent: {
            ...persistent,
            boardGrouping: {
                ...persistent.boardGrouping!,
                availableGroups: newOrder
            },
            groupingOrderings
        },
        volatile: state.volatile,
    };
}
