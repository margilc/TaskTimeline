import { ITask } from '../../interfaces/ITask';
import { IPersistentState } from '../../interfaces/IAppState';

export function getGroupValue(task: ITask, groupBy: string): string {
    switch (groupBy) {
        case 'status':
            return task.status || 'No Status';
        case 'priority':
            return task.priority ? task.priority.toString() : 'No Priority';
        case 'category':
            return task.category || 'No Category';
        default:
            return 'default';
    }
}

export function groupTasks(tasks: ITask[], groupBy: string): Record<string, ITask[]> {
    if (groupBy === 'none' || !groupBy) {
        return { 'All Tasks': tasks };
    }
    
    const grouped: Record<string, ITask[]> = {};
    
    for (const task of tasks) {
        const groupValue = getGroupValue(task, groupBy);
        
        if (!grouped[groupValue]) {
            grouped[groupValue] = [];
        }
        grouped[groupValue].push(task);
    }
    
    return grouped;
}

export function generateAvailableGroups(
    tasks: ITask[], 
    groupBy: string, 
    persistent?: IPersistentState,
    projectId?: string
): string[] {
    if (groupBy === 'none' || !groupBy) {
        return ['All Tasks'];
    }
    
    const uniqueGroups = new Set<string>();
    
    for (const task of tasks) {
        const groupValue = getGroupValue(task, groupBy);
        uniqueGroups.add(groupValue);
    }
    
    const discoveredGroups = Array.from(uniqueGroups);
    
    if (persistent && projectId) {
        return getStableOrder(discoveredGroups, persistent, projectId, groupBy);
    }
    
    return discoveredGroups.sort((a, b) => {
        if (groupBy === 'priority') {
            return sortPriorityGroups(a, b);
        }
        if (groupBy === 'status') {
            return sortStatusGroups(a, b);
        }
        return a.localeCompare(b);
    });
}

function getStableOrder(
    discoveredGroups: string[], 
    persistent: IPersistentState, 
    projectId: string, 
    groupBy: string
): string[] {
    const groupingOrderings = persistent.groupingOrderings || {};
    const projectOrderings = groupingOrderings[projectId] || {};
    const existingOrder = projectOrderings[groupBy] || [];
    
    // If there is no stored order yet, use the default ordering for this groupBy.
    // Once the user has a stored order (via drag-reorder), that order is authoritative.
    if (existingOrder.length === 0) {
        return discoveredGroups.sort((a, b) => {
            if (groupBy === 'priority') return sortPriorityGroups(a, b);
            if (groupBy === 'status') return sortStatusGroups(a, b);
            return a.localeCompare(b);
        });
    }
    
    const orderedGroups: string[] = [];
    
    // First, add all existing groups in their stored order
    for (const group of existingOrder) {
        if (discoveredGroups.includes(group)) {
            orderedGroups.push(group);
        }
    }
    
    // Then, add any new groups that weren't in the stored order
    const newGroups = discoveredGroups.filter(group => !existingOrder.includes(group));
    
    if (newGroups.length > 0) {
        // Sort only the newly discovered groups, then append to the end.
        // Important: do NOT re-sort the whole list, or it will override user drag order.
        const sortedNewGroups = newGroups.sort((a, b) => {
            if (groupBy === 'priority') return sortPriorityGroups(a, b);
            if (groupBy === 'status') return sortStatusGroups(a, b);
            return a.localeCompare(b);
        });
        orderedGroups.push(...sortedNewGroups);
    }
    
    return orderedGroups;
}

function sortPriorityGroups(a: string, b: string): number {
    const getPriorityValue = (group: string): number => {
        if (group === 'No Priority') return -1;
        // Handle both old format "Priority 1" and new format "1"
        const match = group.match(/(?:Priority )?(\d+)/);
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
        'To Do', 'Not Started', 'In Progress', 'Blocked', 'Review', 
        'Done', 'Completed', 'Cancelled', 'No Status'
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