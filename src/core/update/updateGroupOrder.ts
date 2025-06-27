import { App } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState } from '../../interfaces/IAppState';

export function getStableGroupOrder(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    discoveredGroups: string[],
    projectId: string,
    groupBy: string
): { persistent: IPersistentState, orderedGroups: string[] } {
    
    const newPersistent = { ...persistent };
    
    // Initialize groupingOrderings if not exists
    if (!newPersistent.groupingOrderings) {
        newPersistent.groupingOrderings = {};
    }
    
    // Initialize project ordering if not exists
    if (!newPersistent.groupingOrderings[projectId]) {
        newPersistent.groupingOrderings[projectId] = {};
    }
    
    // Initialize variable ordering if not exists
    if (!newPersistent.groupingOrderings[projectId][groupBy]) {
        newPersistent.groupingOrderings[projectId][groupBy] = [];
    }
    
    const existingOrder = newPersistent.groupingOrderings[projectId][groupBy];
    const orderedGroups: string[] = [];
    
    // First, add all existing groups in their current order
    for (const group of existingOrder) {
        if (discoveredGroups.includes(group)) {
            orderedGroups.push(group);
        }
    }
    
    // Then, add any new groups alphabetically at the end
    const newGroups = discoveredGroups.filter(group => !existingOrder.includes(group));
    
    if (newGroups.length > 0) {
        // Sort new groups using the same logic as before
        const sortedNewGroups = sortGroupsByType(newGroups, groupBy);
        
        // Insert new groups in appropriate positions based on type
        if (groupBy === 'status' || groupBy === 'priority') {
            // For status and priority, maintain the predefined order
            const fullSortedList = sortGroupsByType([...orderedGroups, ...sortedNewGroups], groupBy);
            orderedGroups.length = 0;
            orderedGroups.push(...fullSortedList);
        } else {
            // For categories and others, append alphabetically
            orderedGroups.push(...sortedNewGroups);
        }
        
        // Update persistent state with new order
        newPersistent.groupingOrderings[projectId][groupBy] = [...orderedGroups];
        
    }
    
    return { persistent: newPersistent, orderedGroups };
}

function sortGroupsByType(groups: string[], groupBy: string): string[] {
    return groups.sort((a, b) => {
        if (groupBy === 'priority') {
            return sortPriorityGroups(a, b);
        }
        if (groupBy === 'status') {
            return sortStatusGroups(a, b);
        }
        return a.localeCompare(b);
    });
}

function sortPriorityGroups(a: string, b: string): number {
    const getPriorityValue = (group: string): number => {
        if (group === 'No Priority') return -1;
        const match = group.match(/Priority (\d+)/);
        return match ? parseInt(match[1], 10) : -1;
    };
    
    const priorityA = getPriorityValue(a);
    const priorityB = getPriorityValue(b);
    
    if (priorityA === -1 && priorityB === -1) return 0;
    if (priorityA === -1) return 1;
    if (priorityB === -1) return -1;
    
    return priorityB - priorityA;
}

function sortStatusGroups(a: string, b: string): number {
    const statusOrder = [
        'Not Started', 'In Progress', 'Blocked', 'Review', 
        'Completed', 'Cancelled', 'No Status'
    ];
    
    const indexA = statusOrder.indexOf(a);
    const indexB = statusOrder.indexOf(b);
    
    if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
    }
    
    if (indexA === -1 && indexB !== -1) return 1;
    if (indexA !== -1 && indexB === -1) return -1;
    
    return a.localeCompare(b);
}