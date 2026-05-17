/**
 * A drag/resize ghost rendered as a CHILD of the target group's CSS Grid.
 *
 * This delegates ALL pixel placement (column-gap, row-gap, padding, etc.) to
 * the browser's grid layout — by construction the ghost lands exactly where a
 * real card would, so there is no manual math to drift between columns or
 * span the wrong number of rows.
 *
 * The ghost is `pointer-events: none` and has a high z-index so it visually
 * overlays sibling cards without intercepting events.
 */
export class GridGhost {
    private el: HTMLElement;
    private currentParent: HTMLElement;

    constructor(sourceCard: HTMLElement, initialParent: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'task-drag-ghost task-timeline-task';

        // Copy presentational styles so the ghost looks like the source card.
        const computed = window.getComputedStyle(sourceCard);
        this.el.style.backgroundColor = computed.backgroundColor;
        this.el.style.color = computed.color;
        this.el.style.fontSize = computed.fontSize;
        this.el.style.padding = computed.padding;

        // Clone visible content. Skip the resize handles — they are interaction-only.
        for (const child of Array.from(sourceCard.children)) {
            if ((child as HTMLElement).classList?.contains('resize-handle')) continue;
            this.el.appendChild(child.cloneNode(true));
        }

        this.currentParent = initialParent;
        initialParent.appendChild(this.el);
    }

    /**
     * Update the ghost's grid placement. If targetParent differs from the current
     * parent (group changed during drag), re-parent the element first.
     *
     * @param targetParent The .board-task-group element to place the ghost inside.
     * @param dataColStart 1-based data column index (the leading group-header column adds +1 in CSS).
     * @param spanColumns  Number of columns the ghost spans (>=1).
     * @param dataRowStart 1-based row inside the group (1 == top row).
     */
    place(targetParent: HTMLElement, dataColStart: number, spanColumns: number, dataRowStart: number): void {
        if (targetParent !== this.currentParent) {
            targetParent.appendChild(this.el); // moves out of current parent
            this.currentParent = targetParent;
        }
        const cssColStart = Math.max(2, dataColStart + 1);
        const span = Math.max(1, spanColumns);
        this.el.style.gridColumnStart = String(cssColStart);
        this.el.style.gridColumnEnd = `span ${span}`;
        this.el.style.gridRowStart = String(Math.max(1, dataRowStart));
    }

    destroy(): void {
        if (this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
    }
}
