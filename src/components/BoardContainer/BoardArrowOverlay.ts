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

    /**
     * Draw soft curved lines from source card to each linked target card.
     * Each card exposes one anchor per column it spans (centered at the column,
     * at the card's vertical midline). For each line, pick the (src, tgt) anchor
     * pair that minimizes horizontal distance.
     */
    showArrows(sourceTaskId: string, linkedTaskIds: string[]): void {
        this.clearArrows();

        const sourceCard = this.findCard(sourceTaskId);
        if (!sourceCard) return;

        const parentOffset = this.getParentOffset();
        const srcAnchors = this.cardAnchors(sourceCard, parentOffset);
        if (srcAnchors.length === 0) return;

        for (let i = 0; i < linkedTaskIds.length; i++) {
            const targetCard = this.findCard(linkedTaskIds[i]);
            if (!targetCard) continue;

            const tgtAnchors = this.cardAnchors(targetCard, parentOffset);
            if (tgtAnchors.length === 0) continue;

            const { from, to } = this.pickClosestPair(srcAnchors, tgtAnchors);

            const d = this.buildSoftCurve(from, to);

            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#000000');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-opacity', '0.5');
            path.classList.add('board-arrow-path');
            this.lineGroup.appendChild(path);

            this.appendDot(from);
            this.appendDot(to);
        }
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

    /**
     * Anchor points along a card's vertical midline, one per column it spans,
     * each at the horizontal center of that column.
     *
     * Accounts for grid `column-gap`: a span-N card occupies
     * `N*colW + (N-1)*gap` pixels, so we recover colW and step by `colW + gap`.
     */
    private cardAnchors(
        card: HTMLElement,
        offset: { left: number; top: number }
    ): { x: number; y: number }[] {
        const r = card.getBoundingClientRect();
        const span = this.cardColumnSpan(card);
        const gap = this.gridColumnGap(card);
        const colWidth = (r.width - (span - 1) * gap) / span;
        const y = r.top - offset.top + r.height / 2;
        const leftEdge = r.left - offset.left;
        const anchors: { x: number; y: number }[] = [];
        for (let i = 0; i < span; i++) {
            anchors.push({ x: leftEdge + i * (colWidth + gap) + colWidth / 2, y });
        }
        return anchors;
    }

    /** Column gap of the card's grid parent (0 if none / not parseable). */
    private gridColumnGap(card: HTMLElement): number {
        const parent = card.parentElement;
        if (!parent) return 0;
        const cs = window.getComputedStyle(parent);
        const raw = cs.columnGap || cs.gap || '0';
        const n = parseFloat(raw);
        return isFinite(n) ? n : 0;
    }

    /** Parse `grid-column-end: span N` from the card's inline style; defaults to 1. */
    private cardColumnSpan(card: HTMLElement): number {
        const end = card.style.gridColumnEnd || '';
        const m = end.match(/span\s+(\d+)/);
        const span = m ? parseInt(m[1], 10) : 1;
        return Math.max(1, span);
    }

    /** Pick the (src, tgt) anchor pair with the smallest |Δx|. */
    private pickClosestPair(
        srcAnchors: { x: number; y: number }[],
        tgtAnchors: { x: number; y: number }[]
    ): { from: { x: number; y: number }; to: { x: number; y: number } } {
        let bestFrom = srcAnchors[0];
        let bestTo = tgtAnchors[0];
        let bestDist = Infinity;
        for (const s of srcAnchors) {
            for (const t of tgtAnchors) {
                const d = Math.abs(s.x - t.x);
                if (d < bestDist) {
                    bestDist = d;
                    bestFrom = s;
                    bestTo = t;
                }
            }
        }
        return { from: bestFrom, to: bestTo };
    }

    private appendDot(p: { x: number; y: number }): void {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', '#000000');
        dot.setAttribute('fill-opacity', '0.5');
        dot.classList.add('board-arrow-path');
        this.lineGroup.appendChild(dot);
    }

    /**
     * Cubic bezier with 90-degree exit/entry angles.
     * Control points extend along the best cardinal direction (up/down/left/right)
     * from each anchor, so the curve always leaves and arrives axis-aligned.
     */
    private buildSoftCurve(
        from: { x: number; y: number },
        to: { x: number; y: number }
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
