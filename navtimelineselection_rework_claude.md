# NavTimelineSelection Rework Plan

## Executive Summary

This document outlines a comprehensive rework of the NavTimelineSelection component to:
1. Rearrange the visual layout (slider+minimap on top, axis with labels below)
2. Add date labels at 0%, 25%, 50%, 75%, 100% positions
3. Preserve and verify all drag/drop logic integrity

---

## Part 1: Current Architecture Analysis

### 1.1 File Structure

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/NavBar/NavTimelineSelection.ts` | Orchestrator component | 114 |
| `src/components/NavBar/NavTimeSlider.ts` | Slider with drag logic | 385 |
| `src/components/NavBar/NavMinimap.ts` | Task density heatmap | 104 |
| `src/core/utils/timelineUtils.ts` | Viewport calculations, snapping | 299 |
| `src/core/update/updateTimelineViewport.ts` | State update handler | 18 |
| `src/core/update/updateSnappedDateBoundaries.ts` | Global boundary snapping | 58 |
| `styles.css` (lines 370-517) | All timeline CSS | ~150 |

### 1.2 Current DOM Hierarchy

```
.nav-timeline-selection (grey: var(--color-grey-100))
├── <h3> "Timeline"
├── .nav-minimap-container
│   └── .nav-minimap
│       └── .minimap-visualization (white: var(--color-white))
│           └── .minimap-square × N
└── .nav-timeslider-container
    └── .nav-time-slider
        └── .slider-track (white: var(--color-white))
            ├── .slider-tick-marks-container
            │   └── .slider-tick-mark × N (.emphasized for special)
            ├── .current-date-indicator (accent color, 3px)
            └── .viewport-selector-container
                └── .viewport-selector (draggable)
```

### 1.3 Current Visual Layout (top to bottom)

1. Title "Timeline"
2. **Minimap** (20px height, white background, grayscale squares)
3. **Slider Track** (25px height, white background)
   - Tick marks at bottom (inside track)
   - Current date indicator (full height red line)
   - Viewport selector (draggable overlay)

---

## Part 2: Drag/Drop Logic Deep Dive

### 2.1 Drag State Machine

```
                    ┌────────────────────┐
                    │   IDLE STATE       │
                    │   isDragging=false │
                    │   dragState=null   │
                    └────────┬───────────┘
                             │ mousedown on .viewport-selector
                             ▼
                    ┌────────────────────┐
                    │   DRAG INIT        │
                    │   Capture:         │
                    │   - startX         │
                    │   - startLeftPercent│
                    │   - trackWidth     │
                    │   Add .dragging    │
                    └────────┬───────────┘
                             │
                             ▼
         ┌───────────────────────────────────┐
         │         DRAGGING STATE            │
         │   Document listeners active       │
         │   requestAnimationFrame throttle  │
         └───────────────┬───────────────────┘
                         │ mousemove
                         ▼
         ┌───────────────────────────────────┐
         │   updateSelectorPosition()        │
         │   1. deltaX = currentX - startX   │
         │   2. deltaPercent = delta/trackW  │
         │   3. newLeft = start + delta      │
         │   4. clamp to [0, 100-width]      │
         │   5. calculateSnappedViewport()   │
         │   6. trigger UpdateViewportPending│
         └───────────────────────────────────┘
                         │ mouseup
                         ▼
                    ┌────────────────────┐
                    │   CLEANUP          │
                    │   - isDragging=false│
                    │   - Remove listeners│
                    │   - Cancel RAF      │
                    │   - Remove .dragging│
                    └────────────────────┘
```

### 2.2 Critical Code Paths

#### 2.2.1 Position Calculation (NavTimeSlider.ts:242-272)

```typescript
private updateSelectorPosition(currentX: number): void {
    // Get drag state
    const { startX, startLeftPercent, trackWidth } = this.dragState;

    // Calculate pixel delta
    const deltaX = currentX - startX;

    // Convert to percentage
    const deltaPercent = (deltaX / trackWidth) * 100;

    // Apply to starting position
    let newLeftPercent = startLeftPercent + deltaPercent;

    // Get current width from CSS
    const widthPercent = parseFloat(this.selector.style.width);

    // Clamp: cannot go past left edge or right edge
    newLeftPercent = Math.max(0, Math.min(100 - widthPercent, newLeftPercent));

    // Calculate snapped viewport and trigger update
    const snappedViewport = this.calculateSnappedViewportFromPosition(newLeftPercent, widthPercent);
    this.updateViewportFromSnappedPosition(snappedViewport);
}
```

#### 2.2.2 Viewport Snapping (NavTimeSlider.ts:296-331)

```typescript
private calculateSnappedViewportFromPosition(leftPercent, widthPercent): Viewport {
    // Get global snapped boundaries
    const globalMinDate = state.volatile.globalMinDateSnapped;
    const globalMaxDate = state.volatile.globalMaxDateSnapped;
    const globalDurationMs = globalMax - globalMin;

    // Convert percentages to absolute dates
    const newMinMs = globalMin + (leftPercent / 100) * globalDuration;
    const newMaxMs = globalMin + ((leftPercent + widthPercent) / 100) * globalDuration;

    // Apply time unit snapping (DAY->Monday, WEEK->Monday, MONTH->1st)
    return snapViewportToTimeUnit(viewport, timeUnit, numberOfColumns);
}
```

#### 2.2.3 Snapping Logic (timelineUtils.ts:82-133)

```typescript
export function snapViewportToTimeUnit(viewport, timeUnit, numberOfColumns): Viewport {
    // DAY/WEEK: Snap to Monday, span numberOfColumns periods
    // MONTH: Snap to 1st, span numberOfColumns months

    // Important: numberOfColumns is PRESERVED
    // The width is recalculated based on numberOfColumns, not preserved from drag
}
```

### 2.3 Identified Issues / Edge Cases

| Issue | Severity | Current Behavior | Impact |
|-------|----------|------------------|--------|
| CSS parsing for startLeftPercent | LOW | Parses `style.left` with fallback to 0 | Could fail if % not present |
| trackWidth captured at mousedown | LOW | Not updated during drag | Issues if window resized during drag |
| Width stays constant in numberOfColumns | MEDIUM | Width in columns preserved, not pixels | Intentional, may feel odd at extremes |
| No keyboard support | LOW | Arrow keys don't work | Accessibility gap |
| Document listeners not scoped | LOW | Added to document | Memory leak if destroy() not called |

### 2.4 Event Flow Diagram

```
User Drags Selector
        │
        ▼
NavTimeSlider.updateSelectorPosition()
        │
        ▼
NavTimeSlider.calculateSnappedViewportFromPosition()
        │
        ▼
trigger(UpdateTimelineViewportPending, viewport)
        │
        ▼
AppStateManager.handleUpdateTimelineViewportPending()
        │
        ▼
updateTimelineViewport() → updates state.volatile.timelineViewport
        │
        ▼
trigger(UpdateTimelineViewportDone)
        │
        ├─────────────────────────────┐
        ▼                             ▼
NavTimeSlider.render()        BoardContainer.render()
(selector repositioned)       (columns regenerated)
```

---

## Part 3: Proposed New Layout

### 3.1 Target DOM Hierarchy

```
.nav-timeline-selection (grey: var(--color-grey-100))
├── <h3> "Timeline"
│
├── .nav-timeline-track-container (NEW - contains slider+minimap stack)
│   │
│   ├── .nav-time-slider (MODIFIED - now contains viewport selector + current date only)
│   │   └── .slider-track (white: var(--color-white))
│   │       ├── .current-date-indicator
│   │       └── .viewport-selector-container
│   │           └── .viewport-selector (draggable)
│   │
│   └── .nav-minimap (positioned UNDER slider, aligned)
│       └── .minimap-visualization (white: var(--color-white))
│           └── .minimap-square × N
│
└── .nav-timeline-axis (NEW - contains tick marks and labels)
    ├── .axis-tick-marks-container
    │   └── .axis-tick-mark × N
    └── .axis-labels-container
        ├── .axis-label (0% - left aligned)
        ├── .axis-label (25% - center aligned)
        ├── .axis-label (50% - center aligned)
        ├── .axis-label (75% - center aligned)
        └── .axis-label (100% - right aligned)
```

### 3.2 Visual Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  Timeline                                                    (grey) │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [========VIEWPORT========]     │(red)                    (white)│ │ ← Slider
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ░░░░░▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░(white)│ │ ← Minimap
│ └─────────────────────────────────────────────────────────────────┘ │
│   │         │         │         │         │                         │ ← Tick marks
│ 01/01/2024  25/03/2024  17/06/2024  08/09/2024  31/12/2024         │ ← Labels
│ (left)    (center)    (center)    (center)    (right)               │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Label Specifications

| Position | Percentage | Alignment | CSS |
|----------|------------|-----------|-----|
| First | 0% | left | `left: 0%; text-align: left;` |
| Second | 25% | center | `left: 25%; transform: translateX(-50%);` |
| Third | 50% | center | `left: 50%; transform: translateX(-50%);` |
| Fourth | 75% | center | `left: 75%; transform: translateX(-50%);` |
| Last | 100% | right | `right: 0%; text-align: right;` |

**Date Format:** DD/MM/YYYY (e.g., "01/01/2024")

**Label Date Calculation:**
```typescript
const globalDuration = globalMaxDate - globalMinDate;
const labelDates = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    return new Date(globalMinDate.getTime() + pct * globalDuration);
});
```

---

## Part 4: Implementation Plan

### Phase 1: Preparation (No Functional Changes)

**Step 1.1: Create backup/test**
- [ ] Run `npm run test` to verify current tests pass
- [ ] Create a test file that exercises drag logic

**Step 1.2: Document current behavior**
- [ ] Manually test drag behavior, note exact snapping points
- [ ] Screenshot current layout for comparison

### Phase 2: Refactor NavTimeSlider (Move Tick Marks Out)

**Step 2.1: Extract tick mark generation**
- [ ] Move `createTickMarks()` logic to a shared utility or keep accessible
- [ ] Remove tick marks from NavTimeSlider's render()
- [ ] NavTimeSlider now only renders: track, current date indicator, viewport selector

**Step 2.2: Update NavTimeSlider CSS**
- [ ] Remove `.slider-tick-marks-container` from inside `.slider-track`
- [ ] Keep slider-track height for interaction area

### Phase 3: Refactor NavTimelineSelection (New Layout)

**Step 3.1: Create new container structure**
```typescript
// NavTimelineSelection.render()
// 1. Title
const titleElement = createEl("h3", { text: "Timeline" });

// 2. Track container (holds slider + minimap stacked)
const trackContainer = createEl("div", { cls: "nav-timeline-track-container" });

// 3. Slider (now on top)
const sliderContainer = createEl("div", { cls: "nav-timeslider-container" });
this.navTimeSlider = new NavTimeSlider(sliderContainer, this.appStateManager);
trackContainer.appendChild(sliderContainer);

// 4. Minimap (below slider)
const minimapContainer = createEl("div", { cls: "nav-minimap-container" });
this.navMinimap = new NavMinimap(minimapContainer, this.appStateManager);
trackContainer.appendChild(minimapContainer);

// 5. Axis (tick marks + labels)
const axisContainer = createEl("div", { cls: "nav-timeline-axis" });
this.createAxis(axisContainer);

this.container.appendChild(titleElement);
this.container.appendChild(trackContainer);
this.container.appendChild(axisContainer);
```

**Step 3.2: Implement createAxis() method**
```typescript
private createAxis(container: HTMLElement): void {
    const state = this.appStateManager.getState();
    const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
    const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
    const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();

    // Tick marks container
    const tickContainer = createEl("div", { cls: "axis-tick-marks-container" });

    // Generate tick marks (reuse existing logic)
    const timeUnit = this.appStateManager.getCurrentTimeUnit();
    const markers = generateTimeMarkersWithMetadata(
        globalMinDate.toISOString(),
        globalMaxDate.toISOString(),
        timeUnit
    );

    markers.forEach(marker => {
        const date = new Date(marker.date);
        const positionPercent = ((date.getTime() - globalMinDate.getTime()) / globalDurationMs) * 100;

        if (positionPercent >= 0 && positionPercent <= 100) {
            const tick = createEl("div", {
                cls: marker.type === 'emphasized' ? "axis-tick-mark emphasized" : "axis-tick-mark"
            });
            tick.style.left = `${positionPercent}%`;
            tickContainer.appendChild(tick);
        }
    });

    container.appendChild(tickContainer);

    // Labels container
    const labelsContainer = createEl("div", { cls: "axis-labels-container" });

    const labelPositions = [
        { percent: 0, align: 'left' },
        { percent: 25, align: 'center' },
        { percent: 50, align: 'center' },
        { percent: 75, align: 'center' },
        { percent: 100, align: 'right' }
    ];

    labelPositions.forEach(({ percent, align }) => {
        const dateMs = globalMinDate.getTime() + (percent / 100) * globalDurationMs;
        const date = new Date(dateMs);
        const formattedDate = this.formatDate(date); // DD/MM/YYYY

        const label = createEl("div", { cls: `axis-label axis-label-${align}` });
        label.textContent = formattedDate;

        if (align === 'left') {
            label.style.left = '0';
        } else if (align === 'right') {
            label.style.right = '0';
        } else {
            label.style.left = `${percent}%`;
        }

        labelsContainer.appendChild(label);
    });

    container.appendChild(labelsContainer);
}

private formatDate(date: Date): string {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}
```

### Phase 4: CSS Updates

**Step 4.1: New CSS for track container**
```css
.nav-timeline-track-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0; /* No gap - slider and minimap touch */
}

/* Slider on top - adjust border radius */
.nav-timeline-track-container .slider-track {
    border-radius: var(--border-radius) var(--border-radius) 0 0;
    border-bottom: none; /* Merge with minimap */
}

/* Minimap below - adjust border radius */
.nav-timeline-track-container .minimap-visualization {
    border-radius: 0 0 var(--border-radius) var(--border-radius);
    border-top: none; /* Merge with slider */
}
```

**Step 4.2: New CSS for axis**
```css
.nav-timeline-axis {
    width: 100%;
    position: relative;
    padding-top: 2px;
}

.axis-tick-marks-container {
    width: 100%;
    height: 8px;
    position: relative;
}

.axis-tick-mark {
    position: absolute;
    top: 0;
    width: 1px;
    height: 5px;
    background-color: var(--color-grey-400);
    transform: translateX(-50%);
}

.axis-tick-mark.emphasized {
    height: 8px;
    width: 2px;
    background-color: var(--color-grey-600);
}

.axis-labels-container {
    width: 100%;
    height: 16px;
    position: relative;
    font-size: 10px;
    color: var(--color-grey-600);
}

.axis-label {
    position: absolute;
    top: 0;
    white-space: nowrap;
}

.axis-label-left {
    text-align: left;
}

.axis-label-center {
    transform: translateX(-50%);
    text-align: center;
}

.axis-label-right {
    text-align: right;
}
```

**Step 4.3: Remove old tick CSS from slider-track**
```css
/* REMOVE these from .slider-track context */
/* .slider-tick-marks-container - move to axis */
/* .slider-tick-mark - move to axis */
```

### Phase 5: Verification & Testing

**Step 5.1: Manual testing checklist**
- [ ] Drag viewport selector - verify snapping works correctly
- [ ] Drag to left edge - verify cannot go past 0%
- [ ] Drag to right edge - verify cannot go past (100% - width%)
- [ ] Change time unit (DAY/WEEK/MONTH) - verify labels update
- [ ] Verify current date indicator position is correct
- [ ] Verify minimap squares still show correct task density
- [ ] Verify labels show correct dates at 0%, 25%, 50%, 75%, 100%
- [ ] Verify label alignments are correct

**Step 5.2: Edge case testing**
- [ ] Very short timeline (< 1 week)
- [ ] Very long timeline (> 1 year)
- [ ] Timeline starting on boundary dates
- [ ] Timeline with no tasks

**Step 5.3: Visual verification**
- [ ] Grey background only on outer container
- [ ] White background on slider-track and minimap-visualization
- [ ] Tick marks appear directly under slider/minimap
- [ ] Labels appear directly under tick marks
- [ ] No visual gaps or overlaps

---

## Part 5: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Drag logic breaks | MEDIUM | HIGH | Don't modify NavTimeSlider internal drag logic |
| Percentage calculations off | LOW | MEDIUM | Keep same math, just move DOM location |
| CSS specificity issues | MEDIUM | LOW | Use specific class names, test thoroughly |
| Event listener leaks | LOW | MEDIUM | Verify destroy() cleans up new elements |
| Performance regression | LOW | LOW | No additional calculations, just DOM restructure |

---

## Part 6: Files to Modify

| File | Changes |
|------|---------|
| `src/components/NavBar/NavTimelineSelection.ts` | Major - new structure, createAxis() |
| `src/components/NavBar/NavTimeSlider.ts` | Minor - remove createTickMarks() call |
| `styles.css` | Moderate - add axis styles, adjust track/minimap borders |

**Files NOT to modify:**
- `src/components/NavBar/NavMinimap.ts` - No changes needed
- `src/core/utils/timelineUtils.ts` - No changes needed
- `src/core/update/updateTimelineViewport.ts` - No changes needed
- `src/core/update/updateSnappedDateBoundaries.ts` - No changes needed

---

## Part 7: Rollback Plan

If issues are discovered:

1. **Immediate rollback**: `git checkout -- src/components/NavBar/ styles.css`
2. **Partial rollback**: Revert specific file changes
3. **CSS-only rollback**: Revert styles.css, keep JS changes

---

## Approval Checklist

Before proceeding with implementation:

- [ ] Plan reviewed and approved
- [ ] Current tests pass
- [ ] Current behavior documented/screenshotted
- [ ] Rollback plan understood

---

## Implementation Order

1. **Phase 2.1**: Remove tick marks from NavTimeSlider
2. **Phase 3.1**: Restructure NavTimelineSelection DOM
3. **Phase 3.2**: Implement createAxis() with tick marks and labels
4. **Phase 4.1-4.3**: Update CSS
5. **Phase 5**: Full testing

**Estimated LOC changes:**
- NavTimelineSelection.ts: +60 lines
- NavTimeSlider.ts: -25 lines
- styles.css: +40 lines, -5 lines (net +35)
