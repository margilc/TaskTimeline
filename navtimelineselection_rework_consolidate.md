# NavTimelineSelection Rework - Consolidated Plan

## Overview

Consolidation of `navtimelineselection_rework_gpt.md` and `navtimelineselection_rework_claude.md` into verified working packages.

---

## WORK PACKAGE 0: Bug Fixes (PREREQUISITE)

**Rationale:** Both plans identify state bugs that cause jank. Fix these FIRST to avoid chasing phantom UI issues.

### WP0.1: Fix getCurrentDate() returning wrong value

**File:** `src/core/AppStateManager.ts:719-721`

**Current (BROKEN):**
```typescript
public getCurrentDate(): string {
    return new Date().toISOString();  // Always returns "now"
}
```

**Fixed:**
```typescript
public getCurrentDate(): string {
    return this.state.persistent.currentDate || new Date().toISOString();
}
```

**Verification:** Current date indicator should remain stable across re-renders.

---

### WP0.2: Fix TimeUnit case mismatch in snapped boundaries

**File:** `src/core/update/updateSnappedDateBoundaries.ts:10-48`

**Current (BROKEN):**
```typescript
const timeUnit = currentState.persistent.currentTimeUnit || 'DAY';  // Defaults to uppercase
switch (timeUnit) {
    case 'DAY':   // NEVER matches - stored as 'day'
    case 'WEEK':  // NEVER matches - stored as 'week'
    case 'MONTH': // NEVER matches - stored as 'month'
}
```

**Fixed:** Import and use `TimeUnit` enum:
```typescript
import { TimeUnit } from '../../enums/TimeUnit';
// ...
const timeUnit = (currentState.persistent.currentTimeUnit as TimeUnit) || TimeUnit.DAY;
switch (timeUnit) {
    case TimeUnit.DAY:   // 'day'
    case TimeUnit.WEEK:  // 'week'
    case TimeUnit.MONTH: // 'month'
}
```

**Verification:** Switching time units should snap boundaries correctly.

---

## WORK PACKAGE 1: Remove Tick Marks from NavTimeSlider

**File:** `src/components/NavBar/NavTimeSlider.ts`

### WP1.1: Remove createTickMarks() call from render()

**Location:** Line 68 - remove the call to `this.createTickMarks(...)`

### WP1.2: Remove createTickMarks() method entirely

**Location:** Lines 75-98 - delete the entire method

### WP1.3: Keep these intact (DO NOT MODIFY):
- `setupDragHandlers()` - lines 142-169
- `handleMouseMove` - lines 208-224
- `handleMouseUp` - lines 226-240
- `updateSelectorPosition()` - lines 242-272
- `calculateSnappedViewportFromPosition()` - lines 296-331

**Verification:** Slider should render with viewport selector and current date indicator only (no tick marks).

---

## WORK PACKAGE 2: Restructure NavTimelineSelection Layout

**File:** `src/components/NavBar/NavTimelineSelection.ts`

### WP2.1: Update render() method - new DOM structure

**Current order:** Title → Minimap → Slider

**New order:** Title → Slider → Minimap → Axis

```typescript
private render(): void {
    this.container.empty();
    // ... validation code unchanged ...

    // 1. Title
    const titleElement = document.createElement("h3");
    titleElement.textContent = "Timeline";
    this.container.appendChild(titleElement);

    // 2. Track container (groups slider + minimap visually)
    const trackContainer = document.createElement("div");
    trackContainer.className = "nav-timeline-track-container";

    // 3. Slider FIRST (on top)
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "nav-timeslider-container";
    this.navTimeSlider = new NavTimeSlider(sliderContainer, this.appStateManager);
    trackContainer.appendChild(sliderContainer);

    // 4. Minimap SECOND (below slider)
    const minimapContainer = document.createElement("div");
    minimapContainer.className = "nav-minimap-container";
    this.navMinimap = new NavMinimap(minimapContainer, this.appStateManager);
    trackContainer.appendChild(minimapContainer);

    this.container.appendChild(trackContainer);

    // 5. Axis (tick marks + labels) LAST
    const axisContainer = document.createElement("div");
    axisContainer.className = "nav-timeline-axis";
    this.createAxis(axisContainer);
    this.container.appendChild(axisContainer);
}
```

### WP2.2: Add createAxis() method

```typescript
private createAxis(container: HTMLElement): void {
    const state = this.appStateManager.getState();

    if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) {
        return;
    }

    const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
    const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
    const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();

    if (globalDurationMs <= 0) return;

    // --- Tick marks ---
    const tickContainer = document.createElement("div");
    tickContainer.className = "axis-tick-marks-container";

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
            const tick = document.createElement("div");
            tick.className = marker.type === 'emphasized'
                ? "axis-tick-mark emphasized"
                : "axis-tick-mark";
            tick.style.left = `${positionPercent}%`;
            tickContainer.appendChild(tick);
        }
    });

    container.appendChild(tickContainer);

    // --- Labels at fixed percentages ---
    const labelsContainer = document.createElement("div");
    labelsContainer.className = "axis-labels-container";

    const labelConfigs = [
        { percent: 0, align: 'left' },
        { percent: 25, align: 'center' },
        { percent: 50, align: 'center' },
        { percent: 75, align: 'center' },
        { percent: 100, align: 'right' }
    ];

    labelConfigs.forEach(({ percent, align }) => {
        const dateMs = globalMinDate.getTime() + (percent / 100) * globalDurationMs;
        const date = new Date(dateMs);

        const label = document.createElement("div");
        label.className = `axis-label axis-label-${align}`;
        label.textContent = this.formatDateLabel(date);

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

private formatDateLabel(date: Date): string {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}
```

### WP2.3: Add import for generateTimeMarkersWithMetadata

```typescript
import { calculateDefaultViewport, generateTimeMarkersWithMetadata } from '../../core/utils/timelineUtils';
```

---

## WORK PACKAGE 3: CSS Updates

**File:** `styles.css`

### WP3.1: Add track container styles (NEW)

```css
.nav-timeline-track-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0;
}

/* Slider on top - round top corners only */
.nav-timeline-track-container .slider-track {
    border-radius: var(--border-radius) var(--border-radius) 0 0;
    border-bottom: none;
}

/* Minimap below - round bottom corners only */
.nav-timeline-track-container .minimap-visualization {
    border-radius: 0 0 var(--border-radius) var(--border-radius);
    border-top: none;
}
```

### WP3.2: Add axis styles (NEW)

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
}

.axis-label-right {
    text-align: right;
}
```

### WP3.3: Adjust max-height if needed

Update `.nav-timeline-selection` max-height from 100px to accommodate new axis row (~125px).

---

## WORK PACKAGE 4: Cleanup Old CSS

**File:** `styles.css`

### WP4.1: Remove/deprecate slider tick mark styles

The following can be removed once tick marks are moved to axis:
- `.slider-tick-marks-container` (lines 445-453)
- `.slider-tick-mark` (lines 456-463)
- `.slider-tick-mark.emphasized` (lines 466-470)

---

## Target DOM Structure

```
.nav-timeline-selection (GREY background)
├── <h3> "Timeline"
├── .nav-timeline-track-container
│   ├── .nav-timeslider-container
│   │   └── .nav-time-slider
│   │       └── .slider-track (WHITE background)
│   │           ├── .current-date-indicator
│   │           └── .viewport-selector-container
│   │               └── .viewport-selector
│   └── .nav-minimap-container
│       └── .nav-minimap
│           └── .minimap-visualization (WHITE background)
│               └── .minimap-square × N
└── .nav-timeline-axis (NO background - inherits grey)
    ├── .axis-tick-marks-container
    │   └── .axis-tick-mark × N
    └── .axis-labels-container
        └── .axis-label × 5 (0%, 25%, 50%, 75%, 100%)
```

---

## Files Modified Summary

| File | Work Package | Change Type |
|------|--------------|-------------|
| `src/core/AppStateManager.ts` | WP0.1 | Bug fix (1 line) |
| `src/core/update/updateSnappedDateBoundaries.ts` | WP0.2 | Bug fix (~10 lines) |
| `src/components/NavBar/NavTimeSlider.ts` | WP1 | Remove tick marks (-25 lines) |
| `src/components/NavBar/NavTimelineSelection.ts` | WP2 | Major restructure (+65 lines) |
| `styles.css` | WP3, WP4 | Add axis styles, adjust borders (+50 lines, -15 lines) |

**Files NOT modified:**
- `src/components/NavBar/NavMinimap.ts`
- `src/core/utils/timelineUtils.ts`
- `src/core/update/updateTimelineViewport.ts`

---

## Acceptance Checklist

### Visual
- [ ] `.nav-timeline-selection` remains grey
- [ ] Slider track remains white
- [ ] Minimap visualization remains white
- [ ] Axis row has no white background (grey shows through)
- [ ] Slider is ABOVE minimap
- [ ] Axis is BELOW minimap
- [ ] Labels at 0/25/50/75/100% formatted as DD/MM/YYYY
- [ ] 0% label left-aligned, 100% right-aligned, others centered
- [ ] Labels positioned directly under tick marks

### Interaction
- [ ] Dragging viewport selector is smooth (no stutter)
- [ ] Viewport clamps within [0%, 100%] and never inverts
- [ ] Snapping consistent across day/week/month
- [ ] Current date indicator stable (doesn't jump on re-render)
- [ ] Time unit change recalculates viewport and minimap
- [ ] Tasks update triggers minimap regeneration

### Technical
- [ ] `npm run test` passes
- [ ] No event listener leaks (destroy() works)
- [ ] No console errors

---

## Execution Order

1. **WP0** - Fix bugs first (blocks everything else)
2. **WP1** - Remove tick marks from slider
3. **WP2** - Restructure NavTimelineSelection
4. **WP3** - Add new CSS
5. **WP4** - Clean up old CSS
6. **Test** - Full acceptance checklist
