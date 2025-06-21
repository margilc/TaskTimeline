import { ITask } from '../../interfaces/ITask';

export function filterTasks(tasks: ITask[], filters: {
    status?: string[];
    priority?: number[];
    category?: string[];
    dateRange?: { start: Date, end: Date };
}): ITask[] {
    return tasks.filter(task => {
        if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(task.status)) return false;
        }
        
        if (filters.priority && filters.priority.length > 0) {
            if (!filters.priority.includes(task.priority)) return false;
        }
        
        if (filters.category && filters.category.length > 0) {
            if (!filters.category.includes(task.category)) return false;
        }
        if (filters.dateRange) {
            const taskStart = new Date(task.start);
            const taskEnd = task.end ? new Date(task.end) : taskStart;
            
            if (taskEnd < filters.dateRange.start || taskStart > filters.dateRange.end) {
                return false;
            }
        }
        
        return true;
    });
}

export function groupTasksBy(tasks: ITask[], groupBy: string): Record<string, ITask[]> {
    const groups: Record<string, ITask[]> = {};
    
    for (const task of tasks) {
        let groupKey = 'default';
        
        switch (groupBy) {
            case 'status':
                groupKey = task.status || 'No Status';
                break;
            case 'priority':
                groupKey = task.priority ? `Priority ${task.priority}` : 'No Priority';
                break;
            case 'category':
                groupKey = task.category || 'No Category';
                break;
            default:
                groupKey = 'All Tasks';
        }
        
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(task);
    }
    
    return groups;
}

export function sortTasks(tasks: ITask[], sortBy: 'priority' | 'duration' | 'start' | 'name'): ITask[] {
    return [...tasks].sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                return (b.priority || 0) - (a.priority || 0);
            
            case 'duration':
                const aDuration = getDurationDays(a);
                const bDuration = getDurationDays(b);
                return bDuration - aDuration;
            
            case 'start':
                return new Date(a.start).getTime() - new Date(b.start).getTime();
            
            case 'name':
                return a.name.localeCompare(b.name);
            
            default:
                return 0;
        }
    });
}

export function getDurationDays(task: ITask): number {
    if (!task.end) return 1;
    
    const start = new Date(task.start);
    const end = new Date(task.end);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays);
}

export function getTaskProgress(task: ITask): number {
    if (task.totalSubtasks === 0) {
        switch (task.status?.toLowerCase()) {
            case 'completed':
            case 'done':
                return 100;
            case 'in progress':
            case 'active':
                return 50;
            case 'not started':
            case 'new':
                return 0;
            default:
                return 0;
        }
    }
    
    return Math.round((task.completedSubtasks / task.totalSubtasks) * 100);
}

export function getPriorityColor(priority: number): string {
    switch (priority) {
        case 1:
            return '#ff6b6b';
        case 2:
            return '#feca57';
        case 3:
            return '#48dbfb';
        default:
            return '#ddd';
    }
}

export function getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
        case 'completed':
        case 'done':
            return '#2ecc71';
        case 'in progress':
        case 'active':
            return '#3498db';
        case 'blocked':
            return '#e74c3c';
        case 'review':
            return '#f39c12';
        case 'not started':
        case 'new':
            return '#95a5a6';
        default:
            return '#bdc3c7';
    }
}

export function isTaskOverdue(task: ITask): boolean {
    if (!task.end) return false;
    
    const today = new Date();
    const endDate = new Date(task.end);
    
    return endDate < today && task.status?.toLowerCase() !== 'completed';
}

export function getUniqueValues(tasks: ITask[], field: keyof ITask): string[] {
    const values = new Set<string>();
    
    for (const task of tasks) {
        const value = task[field];
        if (value !== undefined && value !== null && value !== '') {
            values.add(String(value));
        }
    }
    
    return Array.from(values).sort();
}

export function validateTask(task: ITask): { isValid: boolean, errors: string[] } {
    const errors: string[] = [];
    
    if (!task.name || task.name.trim() === '') {
        errors.push('Task name is required');
    }
    
    if (!task.start) {
        errors.push('Task start date is required');
    } else {
        const startDate = new Date(task.start);
        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date format');
        }
    }
    
    if (task.end) {
        const endDate = new Date(task.end);
        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date format');
        } else if (task.start) {
            const startDate = new Date(task.start);
            if (endDate < startDate) {
                errors.push('End date cannot be before start date');
            }
        }
    }
    
    if (task.priority !== undefined && (task.priority < 1 || task.priority > 5)) {
        errors.push('Priority must be between 1 and 5');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

export function createEmptyStateElement(message: string, className: string = 'empty-state'): HTMLElement {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = message;
    
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.padding = '2rem';
    element.style.color = '#666';
    element.style.fontStyle = 'italic';
    
    return element;
}