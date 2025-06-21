import { ITask } from '../../interfaces/ITask';

export function getGroupValue(task: ITask, groupBy: string): string {
    switch (groupBy) {
        case 'status':
            return task.status || 'No Status';
        case 'priority':
            return task.priority ? `Priority ${task.priority}` : 'No Priority';
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

export function generateAvailableGroups(tasks: ITask[], groupBy: string): string[] {
    if (groupBy === 'none' || !groupBy) {
        return ['All Tasks'];
    }
    
    const uniqueGroups = new Set<string>();
    
    for (const task of tasks) {
        const groupValue = getGroupValue(task, groupBy);
        uniqueGroups.add(groupValue);
    }
    
    return Array.from(uniqueGroups).sort((a, b) => {
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