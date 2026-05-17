import { TimeUnit } from "../../../enums/TimeUnit";
import { addTime, normalizeDate } from "../../../core/utils/dateUtils";
import { snapToUnitBoundary } from "../../../core/update/updateLayout";

export interface ColumnHeader {
    date: Date;
    index: number;
}

/**
 * Recover layout positions (data-column indices and row) from a rendered card's
 * inline grid-placement style. `BoardTaskGroup.ts` sets these as the only
 * source of truth for the rendered position; `volatile.currentTasks` does NOT
 * carry xStart/xEnd/y. Always read from the DOM at pointerdown.
 */
export function readCardLayout(card: HTMLElement): { xStart: number; xEnd: number; y: number; span: number } {
    // gridColumnStart is set as String(Math.max(2, startX + 1)).
    const colStartCss = parseInt(card.style.gridColumnStart || '2', 10);
    const xStart = Math.max(1, colStartCss - 1);

    // gridColumnEnd is set as `span N`. Parse the number out.
    const colEndRaw = (card.style.gridColumnEnd || 'span 1').trim();
    const spanMatch = colEndRaw.match(/^span\s+(\d+)/);
    const span = spanMatch ? Math.max(1, parseInt(spanMatch[1], 10)) : 1;
    const xEnd = xStart + span - 1;

    // gridRowStart is set as String((task.y ?? 0) + 1).
    const rowStartCss = parseInt(card.style.gridRowStart || '1', 10);
    const y = Math.max(0, rowStartCss - 1);

    return { xStart, xEnd, y, span };
}

/**
 * Build an SVG overlay drawn over the data-column area during a drag.
 *
 * Vertical lines mark column boundaries; horizontal lines mark row boundaries
 * inside each group. Alignment is exact because we use the same column/row
 * unit math as the rendered CSS grid, and the row boundaries are computed
 * from the actual group offsets passed in.
 *
 * Hardcoded stroke color so the backdrop is visible regardless of theme.
 */
export function buildBackdropSVG(
    totalColumns: number,
    columnWidth: number,
    columnGap: number,
    leftOffset: number,
    totalHeight: number,
    rowBoundariesY: number[] = []
): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'drag-grid-backdrop');
    const unit = columnWidth + columnGap;
    const totalWidth = totalColumns * unit + columnGap; // include leading + trailing gap padding
    svg.setAttribute('width', String(totalWidth));
    svg.setAttribute('height', String(totalHeight));
    svg.style.position = 'absolute';
    svg.style.left = `${leftOffset}px`;
    svg.style.top = '0px';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';

    const STROKE = 'rgba(125, 175, 255, 0.22)';

    // Vertical column-boundary lines.
    for (let i = 0; i <= totalColumns; i++) {
        const x = i * unit;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', '0');
        line.setAttribute('x2', String(x));
        line.setAttribute('y2', String(totalHeight));
        line.setAttribute('stroke', STROKE);
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
    }

    // Horizontal row-boundary lines. Y values are in the SAME coordinate space
    // as the SVG (which is positioned at leftOffset; so relative to SVG top = 0).
    // Caller passes y-values relative to .groups-container; the SVG's top:0 is
    // also at .groups-container top, so coordinates match.
    for (const y of rowBoundariesY) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(totalWidth));
        line.setAttribute('y2', String(y));
        line.setAttribute('stroke', STROKE);
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
    }

    return svg;
}

/**
 * Returns the 1-based data column the pointer is over, clamped to [1, totalColumns].
 *
 * The grid layout is:
 *   |  group header (columnWidth) | gap | data col 1 (columnWidth) | gap | data col 2 | gap | ... |
 *
 * So data col N starts at x = columnWidth + columnGap + (N - 1) * (columnWidth + columnGap)
 *                       = N * (columnWidth + columnGap)
 * (in scrollable-content coordinates).
 *
 * A pointer in any "gap" between data col N and N+1 maps to col N (left wins).
 */
export function pointerToColumnIndex(
    clientX: number,
    contentEl: HTMLElement,
    columnWidth: number,
    columnGap: number,
    totalColumns: number
): number {
    if (totalColumns <= 0) return 1;
    const rect = contentEl.getBoundingClientRect();
    const contentX = (clientX - rect.left) + contentEl.scrollLeft;
    // Pointer inside header or in the gap before data col 1 → clamp to col 1
    const dataX = contentX - columnWidth - columnGap;
    if (dataX < 0) return 1;
    const unit = columnWidth + columnGap;
    const col1Based = Math.floor(dataX / unit) + 1;
    if (col1Based < 1) return 1;
    if (col1Based > totalColumns) return totalColumns;
    return col1Based;
}

/**
 * Returns the group whose vertical extent is closest to clientY.
 *
 * Distance is 0 when clientY is inside the rect (so that case always wins).
 * Otherwise it's the gap from clientY to the nearer of the rect's top/bottom edge.
 *
 * Single-pass distance minimization correctly handles:
 *   - pointer inside a group → that group (distance 0)
 *   - pointer in an inter-group gap → whichever group is nearer
 *   - pointer above the first → first group (smallest distance)
 *   - pointer below the last → last group
 *
 * The previous implementation special-cased only "above first" and fell through
 * to "return last" for everything else, which teleported the ghost to the
 * bottom-most group whenever the pointer hovered an inter-group gap above it.
 */
export function groupAtPointer(
    clientY: number,
    groupRects: Array<{ groupName: string; rect: DOMRect; element: HTMLElement }>
): { groupName: string; element: HTMLElement } | null {
    if (groupRects.length === 0) return null;

    let best: { groupName: string; element: HTMLElement } | null = null;
    let bestDistance = Infinity;

    for (const g of groupRects) {
        const d = clientY < g.rect.top
            ? g.rect.top - clientY
            : clientY > g.rect.bottom
                ? clientY - g.rect.bottom
                : 0;
        if (d < bestDistance) {
            bestDistance = d;
            best = { groupName: g.groupName, element: g.element };
            if (d === 0) break; // inside a group — can't do better
        }
    }
    return best;
}

function formatDateUTC(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function snappedDatesForColumnRange(
    startCol: number,
    endCol: number,
    columnHeaders: ColumnHeader[],
    timeUnit: TimeUnit
): { start: string; end: string } {
    const safeStart = Math.max(1, Math.min(startCol, columnHeaders.length));
    const safeEnd = Math.max(safeStart, Math.min(endCol, columnHeaders.length));

    const startHeader = columnHeaders[safeStart - 1];
    const endHeader = columnHeaders[safeEnd - 1];

    const start = snapToUnitBoundary(new Date(startHeader.date), timeUnit);

    let end: Date;
    if (timeUnit === TimeUnit.DAY) {
        end = normalizeDate(new Date(endHeader.date));
    } else if (timeUnit === TimeUnit.WEEK) {
        const weekStart = snapToUnitBoundary(new Date(endHeader.date), timeUnit);
        end = addTime(weekStart, 6, TimeUnit.DAY);
    } else {
        // MONTH: last day of the end column's month
        const ms = snapToUnitBoundary(new Date(endHeader.date), timeUnit);
        end = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 0));
    }

    return { start: formatDateUTC(start), end: formatDateUTC(end) };
}

export function clampColumn(col: number, totalColumns: number): number {
    if (totalColumns <= 0) return 1;
    if (col < 1) return 1;
    if (col > totalColumns) return totalColumns;
    return col;
}
