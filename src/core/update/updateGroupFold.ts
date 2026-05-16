import { IAppState, IPersistentState } from '../../interfaces/IAppState';

export interface UpdateGroupFoldData {
    groupName: string;
    folded?: boolean;
}

export function updateGroupFold(currentState: IAppState, data: UpdateGroupFoldData): IAppState {
    if (!data.groupName) return currentState;

    const persistent = currentState.persistent;
    const projectId = getGroupFoldProjectId(persistent);
    const groupBy = getGroupFoldVariable(persistent);
    const foldedGroups = { ...(persistent.foldedGroups || {}) };
    const projectFoldedGroups = { ...(foldedGroups[projectId] || {}) };
    const currentFoldedGroupNames = projectFoldedGroups[groupBy] || [];
    const isCurrentlyFolded = currentFoldedGroupNames.includes(data.groupName);
    const shouldFold = data.folded ?? !isCurrentlyFolded;

    const nextFoldedGroupNames = shouldFold
        ? [...new Set([...currentFoldedGroupNames, data.groupName])]
        : currentFoldedGroupNames.filter((groupName) => groupName !== data.groupName);

    foldedGroups[projectId] = {
        ...projectFoldedGroups,
        [groupBy]: nextFoldedGroupNames
    };

    return {
        ...currentState,
        persistent: {
            ...persistent,
            foldedGroups
        }
    };
}

export function isGroupFolded(
    persistent: IPersistentState,
    groupName: string,
    projectId = getGroupFoldProjectId(persistent),
    groupBy = getGroupFoldVariable(persistent)
): boolean {
    return Boolean(persistent.foldedGroups?.[projectId]?.[groupBy]?.includes(groupName));
}

function getGroupFoldProjectId(persistent: IPersistentState): string {
    return persistent.currentProjectName || 'All Projects';
}

function getGroupFoldVariable(persistent: IPersistentState): string {
    return persistent.boardGrouping?.groupBy || 'none';
}
