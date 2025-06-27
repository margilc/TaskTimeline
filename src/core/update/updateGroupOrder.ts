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

export function updateGroupOrder(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    reorderData: { sourceIndex: number, targetIndex: number, groupName: string }
): IAppState {
    const newPersistent = { ...persistent };
    
    // Get current project and grouping info
    const currentProject = persistent.currentProjectName;
    const boardGrouping = persistent.boardGrouping;
    const groupBy = boardGrouping?.groupBy || 'status';
    
    if (!currentProject || !groupBy) {
        return { persistent, volatile };
    }
    
    if (!newPersistent.groupingOrderings) {
        newPersistent.groupingOrderings = {};
    }
    if (!newPersistent.groupingOrderings[currentProject]) {
        newPersistent.groupingOrderings[currentProject] = {};
    }
    
    let currentOrder: string[];
    if (newPersistent.groupingOrderings[currentProject][groupBy]) {
        currentOrder = [...newPersistent.groupingOrderings[currentProject][groupBy]];
    } else {
        currentOrder = volatile.boardLayout?.taskGrids?.map(grid => grid.group) || [];
    }
    
    if (currentOrder.length === 0) {
        return { persistent, volatile };
    }
    
    if (reorderData.sourceIndex < 0 || reorderData.sourceIndex >= currentOrder.length ||
        reorderData.targetIndex < 0 || reorderData.targetIndex > currentOrder.length) {
        return { persistent, volatile };
    }
    
    const newOrder = [...currentOrder];
    const [movedGroup] = newOrder.splice(reorderData.sourceIndex, 1);
    newOrder.splice(reorderData.targetIndex, 0, movedGroup);
    
    newPersistent.groupingOrderings[currentProject][groupBy] = newOrder;
    
    if (newPersistent.boardGrouping && newPersistent.boardGrouping.groupBy === groupBy) {
        newPersistent.boardGrouping = {
            ...newPersistent.boardGrouping,
            availableGroups: newOrder
        };
    }
    
    return { persistent: newPersistent, volatile };
}