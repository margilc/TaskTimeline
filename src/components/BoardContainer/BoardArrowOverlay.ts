const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * SVG overlay for drawing soft curved lines between linked task cards.
 * Single anchor point at card center, no arrowheads.
 * Placed inside the scrollable board-content so lines scroll with cards.
 */
export class BoardArrowOverlay {
    private svg: SVGSVGElement;
    private lineGroup: SVGGElement;
    private scrollParent: HTMLElement;

    constructor(scrollParent: HTMLElement) {
        this.scrollParent = scrollParent;

        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.classList.add('board-arrow-overlay');

        this.lineGroup = document.createElementNS(SVG_NS, 'g');
        this.svg.appendChild(this.lineGroup);

        scrollParent.appendChild(this.svg);
    }

    /** Resize SVG to cover full scrollable area. Call after layout changes. */
    updateSize(): void {
        const w = this.scrollParent.scrollWidth;
        const h = this.scrollParent.scrollHeight;
        this.svg.setAttribute('width', String(w));
        this.svg.setAttribute('height', String(h));
        this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    /** Draw soft curved lines from source card center to all linked target card centers. */
    showArrows(sourceTaskId: string, linkedTaskIds: string[]): void {
        this.clearArrows();

        const sourceCard = this.findCard(sourceTaskId);
        if (!sourceCard) return;

        const parentOffset = this.getParentOffset();
        const srcCenter = this.cardCenter(sourceCard.getBoundingClientRect(), parentOffset);

        for (let i = 0; i < linkedTaskIds.length; i++) {
            const targetCard = this.findCard(linkedTaskIds[i]);
            if (!targetCard) continue;

            const tgtCenter = this.cardCenter(targetCard.getBoundingClientRect(), parentOffset);

            // Alternate bow direction for multiple lines to reduce overlap
            const bowSign = i % 2 === 0 ? 1 : -1;
            const d = this.buildSoftCurve(srcCenter, tgtCenter, bowSign);

            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#000000');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-opacity', '0.5');
            path.classList.add('board-arrow-path');

            this.lineGroup.appendChild(path);

            // Small circle at target center
            const dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', String(tgtCenter.x));
            dot.setAttribute('cy', String(tgtCenter.y));
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#000000');
            dot.setAttribute('fill-opacity', '0.5');
            dot.classList.add('board-arrow-path');
            this.lineGroup.appendChild(dot);
        }

        // Small circle at source center
        const srcDot = document.createElementNS(SVG_NS, 'circle');
        srcDot.setAttribute('cx', String(srcCenter.x));
        srcDot.setAttribute('cy', String(srcCenter.y));
        srcDot.setAttribute('r', '4');
        srcDot.setAttribute('fill', '#000000');
        srcDot.setAttribute('fill-opacity', '0.5');
        srcDot.classList.add('board-arrow-path');
        this.lineGroup.appendChild(srcDot);
    }

    /** Remove all drawn lines. */
    clearArrows(): void {
        while (this.lineGroup.firstChild) {
            this.lineGroup.removeChild(this.lineGroup.firstChild);
        }
    }

    /** Remove SVG from DOM. */
    destroy(): void {
        this.clearArrows();
        this.svg.remove();
    }

    // ── Private helpers ──────────────────────────────────────────────

    private findCard(taskId: string): HTMLElement | null {
        return this.scrollParent.querySelector(
            `.task-timeline-task[data-task-id="${taskId}"]`
        ) as HTMLElement | null;
    }

    private getParentOffset(): { left: number; top: number } {
        const rect = this.scrollParent.getBoundingClientRect();
        return {
            left: rect.left - this.scrollParent.scrollLeft,
            top: rect.top - this.scrollParent.scrollTop,
        };
    }

    private cardCenter(r: DOMRect, offset: { left: number; top: number }): { x: number; y: number } {
        return {
            x: r.left - offset.left + r.width / 2,
            y: r.top - offset.top + r.height / 2,
        };
    }

    /**
     * Cubic bezier with 90-degree exit/entry angles.
     * Control points extend along the best cardinal direction (up/down/left/right)
     * from each center, so the curve always leaves and arrives axis-aligned.
     */
    private buildSoftCurve(
        from: { x: number; y: number },
        to: { x: number; y: number },
        _bowSign: number
    ): string {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const tension = Math.min(dist * 0.4, 120);

        // Pick best cardinal direction at each endpoint
        const exitDir = this.bestCardinal(dx, dy);
        const entryDir = this.bestCardinal(-dx, -dy);

        const cp1x = from.x + exitDir.x * tension;
        const cp1y = from.y + exitDir.y * tension;
        const cp2x = to.x + entryDir.x * tension;
        const cp2y = to.y + entryDir.y * tension;

        return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
    }

    /** Return the cardinal unit vector (right/left/down/up) most aligned with (dx, dy). */
    private bestCardinal(dx: number, dy: number): { x: number; y: number } {
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        }
        return dy >= 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
}
