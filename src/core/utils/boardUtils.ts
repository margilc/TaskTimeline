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