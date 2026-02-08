import { ITask } from '../../interfaces/ITask';

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
    element.style.color = 'var(--text-muted)';
    element.style.fontStyle = 'italic';
    
    return element;
}