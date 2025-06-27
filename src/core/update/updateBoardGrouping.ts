import { App } from 'obsidian';
import { IAppState } from '../../interfaces/IAppState';
import { generateAvailableGroups } from '../utils/groupingUtils';

export function updateBoardGrouping(app: App, currentState: IAppState, groupBy: string): IAppState {
    const tasks = currentState.volatile.currentTasks || [];
    const currentProjectName = currentState.persistent.currentProjectName;
    
    // Always use currentProjectName as the project identifier for grouping ordering
    const availableGroups = generateAvailableGroups(tasks, groupBy, currentState.persistent, currentProjectName);
    
    return {
        ...currentState,
        persistent: {
            ...currentState.persistent,
            boardGrouping: { groupBy, availableGroups }
        }
    };
}

export function getGroupingOptions(): string[] {
    return ['none', 'status', 'priority', 'category'];
}

export function getGroupingLabel(groupBy: string): string {
    switch (groupBy) {
        case 'none': return 'No Grouping';
        case 'status': return 'Group by Status';
        case 'priority': return 'Group by Priority';
        case 'category': return 'Group by Category';
        default: return 'Unknown Grouping';
    }
}