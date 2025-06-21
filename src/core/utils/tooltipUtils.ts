export function positionTooltip(anchor: HTMLElement, tooltip: HTMLElement): void {
    if (!anchor || !tooltip) return;
    
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default position: above and centered on the anchor
    let left = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);
    let top = anchorRect.top - tooltipRect.height - 8; // 8px gap
    
    // Adjust horizontal position if tooltip would go off-screen
    if (left < 8) {
        left = 8; // Minimum margin from left edge
    } else if (left + tooltipRect.width > viewportWidth - 8) {
        left = viewportWidth - tooltipRect.width - 8; // Minimum margin from right edge
    }
    
    // Adjust vertical position if tooltip would go off-screen
    if (top < 8) {
        // Position below the anchor instead
        top = anchorRect.bottom + 8;
    }
    
    // If still off-screen below, position within viewport
    if (top + tooltipRect.height > viewportHeight - 8) {
        top = viewportHeight - tooltipRect.height - 8;
    }
    
    // Apply positioning
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.zIndex = '1000';
}

export function positionTooltipAtMouse(mouseEvent: MouseEvent, tooltip: HTMLElement): void {
    if (!tooltip) return;
    
    const offset = 10; // Small offset from cursor
    
    // Simple positioning relative to mouse
    const left = mouseEvent.clientX + offset;
    const top = mouseEvent.clientY + offset;
    
    // Apply positioning
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.zIndex = '10000';
    tooltip.style.display = 'block';
}