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

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
