import { App } from "obsidian";
import { AppStateManager, ZOOM_TIME_UNITS } from "../../../core/AppStateManager";
import { PluginEvent } from "../../../enums/events";
import { TimeUnit } from "../../../enums/TimeUnit";
import { ITask } from "../../../interfaces/ITask";
import { applyTaskMutation } from "../../../core/update/applyTaskMutation";
import {
    pointerToColumnIndex,
    groupAtPointer,
    snappedDatesForColumnRange,
    readCardLayout,
    buildBackdropSVG,
    clampColumn,
    ColumnHeader,
} from "./dragGeometry";
import { GridGhost } from "./DragGhost";

type Mode = 'IDLE' | 'POTENTIAL' | 'DRAGGING' | 'RESIZING_L' | 'RESIZING_R';
type HandleZone = 'BODY' | 'LEFT' | 'RIGHT';
// A drag is constrained to a single axis, decided at the first crossed cell:
//   HORIZONTAL = change dates (time), group locked to source
//   VERTICAL   = change group, dates locked to source
//   NONE       = no cell crossed yet; ghost sits on the card
type DragAxis = 'NONE' | 'HORIZONTAL' | 'VERTICAL';

const DRAG_THRESHOLD_PX = 4;
const AUTO_SCROLL_EDGE = 40;
const AUTO_SCROLL_STEP = 12;

interface PointerCtx {
    pointerId: number;
    taskId: string;
    sourceCard: HTMLElement;
    sourceGroupEl: HTMLElement;
    startClientX: number;
    startClientY: number;
    handle: HandleZone;
    originalXStart: number;
    originalXEnd: number;
    originalY: number;
    originalSpan: number;
    originalGroup: string;
    // The data column the pointer was over at drag-start. Axis detection
    // measures column crossings relative to this, not the card's edge, so
    // grabbing a multi-column card mid-body doesn't read as an instant move.
    originPointerCol: number;
}

interface GroupRectEntry {
    groupName: string;
    rect: DOMRect;
    element: HTMLElement;
    folded: boolean;
}

export class CardInteractionController {
    private app: App;
    private appStateManager: AppStateManager;
    private groupsContainer: HTMLElement;
    private contentElement: HTMLElement;

    private mode: Mode = 'IDLE';
    private dragAxis: DragAxis = 'NONE';
    private ctx: PointerCtx | null = null;
    private latestEvent: PointerEvent | null = null;
    private rafId: number | null = null;

    private ghost: GridGhost | null = null;
    private backdropEl: SVGSVGElement | null = null;

    private groupRects: GroupRectEntry[] = [];
    private columnHeaders: ColumnHeader[] = [];
    private columnWidth = 100;
    private columnGap = 0;
    private timeUnit: TimeUnit = TimeUnit.DAY;
    private groupBy: string = 'none';
    private totalColumns = 0;

    private lastTargetStart = 1;
    private lastTargetEnd = 1;
    private lastTargetGroup: { name: string; element: HTMLElement } | null = null;

    private boundPointerDown: (e: PointerEvent) => void;
    private boundPointerMove: (e: PointerEvent) => void;
    private boundPointerUp: (e: PointerEvent) => void;
    private boundKeyDown: (e: KeyboardEvent) => void;
    private boundScroll: () => void;

    constructor(
        app: App,
        appStateManager: AppStateManager,
        groupsContainer: HTMLElement,
        contentElement: HTMLElement
    ) {
        this.app = app;
        this.appStateManager = appStateManager;
        this.groupsContainer = groupsContainer;
        this.contentElement = contentElement;

        this.boundPointerDown = this.onPointerDown.bind(this);
        this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerUp = this.onPointerUp.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
        this.boundScroll = this.refreshGroupRects.bind(this);

        this.groupsContainer.addEventListener('pointerdown', this.boundPointerDown);
    }

    public isActive(): boolean {
        return this.mode === 'DRAGGING' || this.mode === 'RESIZING_L' || this.mode === 'RESIZING_R';
    }

    public destroy(): void {
        this.cancelDrag();
        this.groupsContainer.removeEventListener('pointerdown', this.boundPointerDown);
    }

    private snapshotState(initialGroupEl: HTMLElement): void {
        const state = this.appStateManager.getState();
        const boardLayout = state.volatile.boardLayout;
        const zoomState = state.volatile.zoomState;
        if (!boardLayout || !zoomState) return;

        this.columnHeaders = boardLayout.columnHeaders as ColumnHeader[];
        this.columnWidth = zoomState.columnWidth;
        this.timeUnit = ZOOM_TIME_UNITS[zoomState.modeIndex] as TimeUnit;
        this.groupBy = state.persistent.boardGrouping?.groupBy || 'none';
        this.totalColumns = this.columnHeaders.length;

        // Query the actual column-gap once at drag-start (varies by theme).
        const cs = window.getComputedStyle(initialGroupEl);
        const parsed = parseFloat(cs.columnGap || '0');
        this.columnGap = Number.isFinite(parsed) ? parsed : 0;

        this.refreshGroupRects();
    }

    private refreshGroupRects(): void {
        const entries: GroupRectEntry[] = [];
        const groupEls = this.groupsContainer.querySelectorAll<HTMLElement>('.board-task-group');
        for (const el of Array.from(groupEls)) {
            const groupName = el.dataset.groupName;
            if (!groupName) continue;
            entries.push({
                groupName,
                rect: el.getBoundingClientRect(),
                element: el,
                folded: el.dataset.folded === 'true',
            });
        }
        this.groupRects = entries;
    }

    private onPointerDown(e: PointerEvent): void {
        if (e.button !== 0) return;
        if (this.mode !== 'IDLE') return;

        const target = e.target as HTMLElement;
        const card = target.closest('.task-timeline-task') as HTMLElement | null;
        if (!card) return;
        if (card.classList.contains('task-timeline-folded-card')) return;

        const taskId = card.getAttribute('data-task-id');
        if (!taskId) return;

        const task = this.appStateManager.getVolatileState().currentTasks?.find((t: ITask) => t.id === taskId);
        if (!task) return;

        const sourceGroupEl = card.closest('.board-task-group') as HTMLElement | null;
        if (!sourceGroupEl) return;

        // Determine handle zone purely from the pointer target. The resize
        // handles are absolutely positioned 8px overlays with z-index above the
        // card body, so pointerdowns within the visible handle hit the handle
        // element directly. Pointerdowns elsewhere are unambiguously a drag,
        // even for narrow cards where an offsetX fallback would have
        // misclassified body-drags as resizes.
        let handle: HandleZone = 'BODY';
        if (target.classList?.contains('resize-handle-left')) {
            handle = 'LEFT';
        } else if (target.classList?.contains('resize-handle-right')) {
            handle = 'RIGHT';
        }

        this.snapshotState(sourceGroupEl);

        // CRITICAL: layout positions (xStart/xEnd/y) are NOT on volatile.currentTasks.
        // They live only on the rendered card's inline grid-placement style.
        // Reading them from the DOM is the only correct source.
        const layout = readCardLayout(card);

        this.ctx = {
            pointerId: e.pointerId,
            taskId,
            sourceCard: card,
            sourceGroupEl,
            startClientX: e.clientX,
            startClientY: e.clientY,
            handle,
            originalXStart: layout.xStart,
            originalXEnd: layout.xEnd,
            originalY: layout.y,
            originalSpan: layout.span,
            // Identify the source group by the rendered group element's own name
            // (the same value refreshGroupRects/groupAtPointer compare against).
            // Deriving it from the task via getGroupValue is wrong for ungrouped
            // boards, where the task's value is 'default' but the rendered group
            // is 'All Tasks' — that mismatch left resize unable to find its own
            // group, so the ghost never placed and the drop never committed.
            originalGroup: sourceGroupEl.dataset.groupName ?? '',
            originPointerCol: pointerToColumnIndex(
                e.clientX, this.contentElement, this.columnWidth, this.columnGap, this.totalColumns
            ),
        };

        this.mode = 'POTENTIAL';

        try { card.setPointerCapture(e.pointerId); } catch { /* ignore */ }

        document.addEventListener('pointermove', this.boundPointerMove);
        document.addEventListener('pointerup', this.boundPointerUp);
        document.addEventListener('pointercancel', this.boundPointerUp);
    }

    private onPointerMove(e: PointerEvent): void {
        if (!this.ctx || e.pointerId !== this.ctx.pointerId) return;

        if (this.mode === 'POTENTIAL') {
            const dx = Math.abs(e.clientX - this.ctx.startClientX);
            const dy = Math.abs(e.clientY - this.ctx.startClientY);
            if (dx + dy < DRAG_THRESHOLD_PX) return;
            this.beginDrag();
        }

        this.latestEvent = e;
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(() => this.tick());
        }
    }

    private beginDrag(): void {
        if (!this.ctx) return;

        this.dragAxis = 'NONE';

        if (this.ctx.handle === 'LEFT') this.mode = 'RESIZING_L';
        else if (this.ctx.handle === 'RIGHT') this.mode = 'RESIZING_R';
        else this.mode = 'DRAGGING';

        this.ctx.sourceCard.classList.add('is-dragging-source');

        // Mount ghost INSIDE the source group's grid. Re-parents on group change.
        this.ghost = new GridGhost(this.ctx.sourceCard, this.ctx.sourceGroupEl);

        // Mount the SVG column+row-divider backdrop inside .groups-container.
        // Use scrollHeight (not clientHeight) so the lines extend the full
        // scrollable area, not just the visible viewport.
        const totalHeight = Math.max(this.groupsContainer.scrollHeight, this.groupsContainer.clientHeight);

        // Compute INTER-GROUP horizontal lines: one between each pair of adjacent
        // groups (= N-1 lines for N groups). Each line sits at the bottom edge
        // of the upper group, which corresponds to the visible inter-group gap.
        // Folded groups participate naturally — their offsetHeight is one row
        // tall, so the line lands at the bottom of the folded strip.
        const rowBoundariesY: number[] = [];
        const groupEls = this.groupsContainer.querySelectorAll<HTMLElement>('.board-task-group');
        for (let g = 0; g < groupEls.length - 1; g++) {
            const groupEl = groupEls[g];
            rowBoundariesY.push(groupEl.offsetTop + groupEl.offsetHeight);
        }

        // The first column in CSS grid is the group-header column. Backdrop
        // starts at x = columnWidth (after the header, including the gap
        // between header and data col 1).
        this.backdropEl = buildBackdropSVG(
            this.totalColumns,
            this.columnWidth,
            this.columnGap,
            this.columnWidth,
            totalHeight,
            rowBoundariesY
        );
        this.groupsContainer.appendChild(this.backdropEl);

        // Visually emphasize the grid during the drag.
        this.groupsContainer.classList.add('is-drag-active');

        this.contentElement.addEventListener('scroll', this.boundScroll);
        document.addEventListener('keydown', this.boundKeyDown, true);

        this.appStateManager.emit(PluginEvent.TaskDragStarted, { taskId: this.ctx.taskId });
    }

    private tick(): void {
        this.rafId = null;
        if (!this.latestEvent || !this.ctx || !this.ghost) return;

        const e = this.latestEvent;
        this.applyAutoScroll(e);

        const pointerCol = pointerToColumnIndex(
            e.clientX, this.contentElement, this.columnWidth, this.columnGap, this.totalColumns
        );

        const isResize = this.mode === 'RESIZING_L' || this.mode === 'RESIZING_R';

        // A drag changes time OR group, never both. Lock to the axis of the
        // first crossed cell boundary; until then dragAxis is NONE and the ghost
        // simply stays on the card. Resize is always horizontal and skips this.
        if (this.mode === 'DRAGGING' && this.dragAxis === 'NONE') {
            this.dragAxis = this.decideDragAxis(e, pointerCol);
        }

        // Compute target column range. originalSpan/originalXStart/originalXEnd
        // come from the card's inline grid-placement style (the only correct source).
        // Dates only move for a horizontal drag; otherwise columns stay put.
        let targetStart: number;
        let targetEnd: number;

        if (this.mode === 'RESIZING_L') {
            targetStart = clampColumn(pointerCol, this.totalColumns);
            targetEnd = this.ctx.originalXEnd;
            if (targetStart > targetEnd) targetStart = targetEnd;
        } else if (this.mode === 'RESIZING_R') {
            targetStart = this.ctx.originalXStart;
            targetEnd = clampColumn(pointerCol, this.totalColumns);
            if (targetEnd < targetStart) targetEnd = targetStart;
        } else if (this.dragAxis === 'HORIZONTAL') {
            const span = this.ctx.originalSpan;
            targetStart = clampColumn(pointerCol, this.totalColumns);
            targetEnd = targetStart + span - 1;
            if (targetEnd > this.totalColumns) {
                targetEnd = this.totalColumns;
                targetStart = Math.max(1, targetEnd - span + 1);
            }
        } else {
            // Vertical (group-only) drag, or no axis chosen yet: dates stay fixed.
            targetStart = this.ctx.originalXStart;
            targetEnd = this.ctx.originalXEnd;
        }
        this.lastTargetStart = targetStart;
        this.lastTargetEnd = targetEnd;

        // Compute target group. The group only moves for a vertical drag; resize,
        // horizontal drag, and the undecided state all stay in the source group.
        let targetGroupEntry: GroupRectEntry | undefined;
        if (this.dragAxis === 'VERTICAL') {
            const found = groupAtPointer(e.clientY, this.groupRects);
            if (found) targetGroupEntry = this.groupRects.find(g => g.groupName === found.groupName);
        } else {
            targetGroupEntry = this.groupRects.find(g => g.groupName === this.ctx!.originalGroup);
        }
        if (!targetGroupEntry) return;
        this.lastTargetGroup = { name: targetGroupEntry.groupName, element: targetGroupEntry.element };

        // Ghost row policy:
        //   - RESIZE / same-group drag: preview at the card's current row, so the
        //     ghost honestly tracks the new position instead of snapping to the top.
        //   - DRAG into a different group: the row is auto-computed at next layout
        //     and unknowable up front, so show row 1 of the target group.
        const sameGroup = targetGroupEntry.groupName === this.ctx.originalGroup;
        const dataRow = (isResize || sameGroup) ? this.ctx.originalY + 1 : 1;

        const span = Math.max(1, targetEnd - targetStart + 1);
        this.ghost.place(targetGroupEntry.element, targetStart, span, dataRow);
    }

    /**
     * Decide a drag's single axis at the first crossed cell boundary: a column
     * crossing → HORIZONTAL (move time), a group crossing → VERTICAL (change
     * group). If both are crossed in the same frame, the larger pixel delta from
     * the start point wins. Returns NONE until a boundary is actually crossed.
     * On ungrouped boards no other group exists, so this only ever yields
     * HORIZONTAL or NONE.
     */
    private decideDragAxis(e: PointerEvent, pointerCol: number): DragAxis {
        if (!this.ctx) return 'NONE';

        const colCrossed = pointerCol !== this.ctx.originPointerCol;
        const found = groupAtPointer(e.clientY, this.groupRects);
        const groupCrossed = !!found && found.groupName !== this.ctx.originalGroup;

        if (colCrossed && groupCrossed) {
            const dx = Math.abs(e.clientX - this.ctx.startClientX);
            const dy = Math.abs(e.clientY - this.ctx.startClientY);
            return dy > dx ? 'VERTICAL' : 'HORIZONTAL';
        }
        if (groupCrossed) return 'VERTICAL';
        if (colCrossed) return 'HORIZONTAL';
        return 'NONE';
    }

    private applyAutoScroll(e: PointerEvent): void {
        const rect = this.contentElement.getBoundingClientRect();
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        let scrolled = false;
        if (dx < AUTO_SCROLL_EDGE) {
            this.contentElement.scrollLeft -= AUTO_SCROLL_STEP;
            scrolled = true;
        } else if (dx > w - AUTO_SCROLL_EDGE) {
            this.contentElement.scrollLeft += AUTO_SCROLL_STEP;
            scrolled = true;
        }
        if (dy < AUTO_SCROLL_EDGE) {
            this.contentElement.scrollTop -= AUTO_SCROLL_STEP;
            scrolled = true;
        } else if (dy > h - AUTO_SCROLL_EDGE) {
            this.contentElement.scrollTop += AUTO_SCROLL_STEP;
            scrolled = true;
        }
        if (scrolled) this.refreshGroupRects();
    }

    private onPointerUp(e: PointerEvent): void {
        if (!this.ctx || e.pointerId !== this.ctx.pointerId) return;

        if (this.mode === 'POTENTIAL') {
            // No drag occurred. Click goes through to the card's existing handler.
            this.endDrag(false);
            return;
        }

        // Snapshot everything we need from ctx into locals BEFORE teardown.
        const priorMode: Mode = this.mode;
        const dragAxis = this.dragAxis;
        const taskId = this.ctx.taskId;
        const originalGroup = this.ctx.originalGroup;
        const originalXStart = this.ctx.originalXStart;
        const originalXEnd = this.ctx.originalXEnd;
        const originalSpan = this.ctx.originalSpan;
        const sourceCard = this.ctx.sourceCard;
        const groupBy = this.groupBy;
        const totalColumns = this.totalColumns;
        const columnHeaders = this.columnHeaders;
        const timeUnit = this.timeUnit;
        const dropStart = this.lastTargetStart;
        const dropEnd = this.lastTargetEnd;
        const dropGroup = this.lastTargetGroup;

        // 1) Install the click suppressor SYNCHRONOUSLY, before the synthetic
        //    click fires. Without this, the card's bubble-phase click handler
        //    would open the task file on every drag/resize release.
        this.installClickSuppressor();

        // 2) Tear down visuals SYNCHRONOUSLY so the user sees the source card
        //    return to normal styling immediately. The new card will appear at
        //    the dropped position within ~1 frame via the optimistic update.
        this.teardownVisuals();

        if (!dropGroup) {
            // No target — treat as cancel; unfade and reset.
            this.unfadeSource();
            this.endDrag(true);
            return;
        }

        const task = this.appStateManager.getVolatileState().currentTasks?.find((t: ITask) => t.id === taskId);
        if (!task) {
            this.unfadeSource();
            this.endDrag(true);
            return;
        }

        const span = originalSpan;

        let startCol: number;
        let endCol: number;
        let sendStart = true;
        let sendEnd = true;

        if (priorMode === 'RESIZING_L') {
            startCol = dropStart;
            endCol = originalXEnd;
            if (startCol > endCol) startCol = endCol;
            sendEnd = false;
        } else if (priorMode === 'RESIZING_R') {
            startCol = originalXStart;
            endCol = dropEnd;
            if (endCol < startCol) endCol = startCol;
            sendStart = false;
        } else {
            // DRAGGING — only the locked axis is committed.
            startCol = dropStart;
            endCol = dropStart + span - 1;
            if (endCol > totalColumns) {
                endCol = totalColumns;
                startCol = Math.max(1, endCol - span + 1);
            }
            if (dragAxis !== 'HORIZONTAL') {
                // Vertical (group-only) or undecided drag: leave dates untouched.
                // Sending the snapped column dates here would shift the task to a
                // unit boundary on week/month zoom, silently changing time too.
                sendStart = false;
                sendEnd = false;
            }
        }

        const { start: newStart, end: newEnd } = snappedDatesForColumnRange(startCol, endCol, columnHeaders, timeUnit);
        const groupChanged = priorMode === 'DRAGGING' && dragAxis === 'VERTICAL' && dropGroup.name !== originalGroup;

        const mutation: Parameters<typeof applyTaskMutation>[2] = { taskId };
        if (sendStart) mutation.newStart = newStart;
        if (sendEnd) mutation.newEnd = newEnd;
        if (groupChanged && groupBy !== 'none') {
            mutation.newGroupValue = { groupBy, value: dropGroup.name };
        }

        // Detect no-op (same dates, same group) BEFORE firing. If nothing changes,
        // renderBoard won't run, so unfade the source card explicitly.
        const isNoOp =
            (mutation.newStart === undefined || mutation.newStart === task.start) &&
            (mutation.newEnd === undefined || mutation.newEnd === task.end) &&
            (mutation.newGroupValue === undefined);

        if (isNoOp) {
            sourceCard.classList.remove('is-dragging-source');
            this.endDrag(true);
            return;
        }

        // Real change: leave the source card faded; renderBoard will replace it
        // with a fresh card at the new position within one frame.
        this.endDrag(true);

        // Fire-and-forget; rollback is handled inside applyTaskMutation. The
        // returned inverse (null on no-op/failure) becomes an undo entry.
        void applyTaskMutation(this.app, this.appStateManager, mutation).then((inverse) => {
            if (inverse) this.appStateManager.taskHistory.recordForward(inverse);
        });
    }

    private installClickSuppressor(): void {
        const suppressor = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
            document.removeEventListener('click', suppressor, true);
        };
        document.addEventListener('click', suppressor, true);
        setTimeout(() => document.removeEventListener('click', suppressor, true), 0);
    }

    /**
     * Tear down ghost + backdrop and any visual overlay state.
     * Does NOT unfade the source card — renderBoard will replace it cleanly
     * when the optimistic update runs. The source is unfaded explicitly only
     * when no renderBoard is expected (no-op mutation, Escape).
     */
    private teardownVisuals(): void {
        if (this.ghost) {
            this.ghost.destroy();
            this.ghost = null;
        }
        if (this.backdropEl && this.backdropEl.parentNode) {
            this.backdropEl.parentNode.removeChild(this.backdropEl);
        }
        this.backdropEl = null;
        this.groupsContainer.classList.remove('is-drag-active');
    }

    private unfadeSource(): void {
        if (this.ctx) {
            this.ctx.sourceCard.classList.remove('is-dragging-source');
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.isActive()) {
            e.preventDefault();
            this.cancelDrag();
        }
    }

    private cancelDrag(): void {
        if (this.mode === 'IDLE') return;
        // Escape mid-drag: tear down visuals, unfade source (no renderBoard incoming),
        // no write, no click suppressor (no click coming).
        this.teardownVisuals();
        this.unfadeSource();
        this.endDrag(false);
    }

    private endDrag(wasRealDrag: boolean): void {
        if (this.ctx) {
            try { this.ctx.sourceCard.releasePointerCapture(this.ctx.pointerId); } catch { /* ignore */ }
        }

        document.removeEventListener('pointermove', this.boundPointerMove);
        document.removeEventListener('pointerup', this.boundPointerUp);
        document.removeEventListener('pointercancel', this.boundPointerUp);
        document.removeEventListener('keydown', this.boundKeyDown, true);
        this.contentElement.removeEventListener('scroll', this.boundScroll);

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (wasRealDrag) {
            this.appStateManager.emit(PluginEvent.TaskDragEnded, {});
        }

        this.mode = 'IDLE';
        this.dragAxis = 'NONE';
        this.ctx = null;
        this.latestEvent = null;
        this.lastTargetGroup = null;
    }
}
