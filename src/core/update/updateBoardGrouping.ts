import { App } from 'obsidian';
import { IAppState } from '../../interfaces/IAppState';
import { generateAvailableGroups } from '../utils/groupingUtils';

export function updateBoardGrouping(app: App, currentState: IAppState, groupBy: string): IAppState {
    const tasks = currentState.volatile.currentTasks || [];
    const projectId = currentState.volatile.selectedProject?.id;
    const availableGroups = generateAvailableGroups(tasks, groupBy, currentState.persistent, projectId);
    
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