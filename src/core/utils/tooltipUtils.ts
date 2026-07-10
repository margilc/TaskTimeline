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
