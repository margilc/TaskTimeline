# NavTimelineSelection rework (slider + minimap + axis) — plan

## Goals (non-negotiable)

- **Perfect, non-janky interaction** when dragging the slider viewport: stable clamping, stable snapping, no drift, no inconsistent state.
- **New layout**:
  1. **Top**: slider (viewport selector) + current date marker (inside slider)
  2. **Middle**: minimap
  3. **Bottom**: axis row containing:
     - tick marks (same visuals as today)
     - tick labels that are **independent** from tick marks
- **Container hierarchy must remain correct**:
  - `NavTimelineSelection` outer container stays **grey** (`.nav-timeline-selection`)
  - slider and minimap keep their **white backgrounds** (their existing white inner surfaces)
  - axis row should not introduce a new “white card” that breaks the intended look

## Current architecture (as of today)

- `src/components/NavBar/NavTimelineSelection.ts`
  - Renders title + minimap + slider (in that order)
  - Initializes default viewport when missing
  - Reacts to:
    - tasks updates → triggers minimap regeneration
    - time unit updates → recalculates default viewport and minimap
    - viewport/current/minimap updates → re-render

- `src/components/NavBar/NavTimeSlider.ts`
  - Renders a white track containing:
    - tick marks (time-unit generated)
    - current date indicator (vertical line)
    - draggable viewport selector (updates `timelineViewport` continuously during drag)

- `src/components/NavBar/NavMinimap.ts`
  - Renders a white “square strip” visualization (no navigation interactions yet)

## Known issues to address while reworking (jank risk)

- **Current date source bug**: `AppStateManager.getCurrentDate()` currently returns `new Date().toISOString()` instead of the persisted `state.persistent.currentDate`.
  - Symptom: “current date indicator” can drift or never reflect user state (and will change every render).

- **Snapped boundaries time-unit mismatch**: `updateSnappedDateBoundaries.ts` compares against `'DAY'|'WEEK'|'MONTH'`, but `currentTimeUnit` is stored as `'day'|'week'|'month'`.
  - Symptom: wrong snapping branch, inconsistent boundaries, incorrect ticks/labels and jumpiness.

These are directly related to timeline selection UX and must be corrected to make “perfect” interaction feasible.

## Layout rework design (DOM structure)

### Outer container (unchanged)
- `div.nav-timeline-selection` (grey background)

### Inner rows (new order)
1. `div.nav-timeslider-container` (contains `NavTimeSlider`)
2. `div.nav-minimap-container` (contains `NavMinimap`)
3. `div.nav-timeline-axis-container` (new axis row)

Axis row must be **structurally separate** from slider track to allow labels to be independent.

## Axis requirements

- Tick marks: **keep them visually identical** to existing slider tick marks.
- Tick labels:
  - exactly at **0%, 25%, 50%, 72%, 100%**
  - formatted as **DD/MM/YYYY**
  - alignment:
    - 0% label **left-aligned**
    - 100% label **right-aligned**
    - 25/50/72% **center-aligned**
  - placed **directly under** the tick marks (tight vertical spacing)

## Implementation strategy (minimize risk)

1. **Fix state correctness first** (prevents chasing phantom UI issues):
   - `AppStateManager.getCurrentDate()` should return persisted current date.
   - `updateSnappedDateBoundaries()` should switch on `TimeUnit.DAY|WEEK|MONTH` (lowercase), not uppercase strings.

2. **Split slider visuals**:
   - Slider track keeps **only**:
     - current date indicator
     - viewport selector drag surface
   - Tick marks move to axis row (reusing existing tick-mark rendering logic and CSS classes).

3. **Add fixed-percentage labels**:
   - Compute label date at each percent within `[globalMinDateSnapped, globalMaxDateSnapped]`.
   - Format using UTC fields to avoid timezone off-by-one.
   - Use absolute-positioned label elements with transforms to enforce requested alignment.

4. **Reorder layout in `NavTimelineSelection.render()`**:
   - slider first, minimap second, axis third
   - keep title as-is unless it breaks height constraints

## Acceptance checklist (must pass before shipping)

### Visual/layout
- [ ] `.nav-timeline-selection` remains grey.
- [ ] slider track remains a white “card”.
- [ ] minimap visualization remains a white “card”.
- [ ] axis row does not introduce a conflicting white card; it reads as part of the grey container.
- [ ] slider is above minimap; axis is below minimap.
- [ ] tick labels are at 0/25/50/72/100% and **DD/MM/YYYY**.
- [ ] label alignment is correct (0 left, 100 right, others centered).
- [ ] labels sit directly under their tick marks.

### Interaction correctness
- [ ] dragging viewport selector is smooth (no stutter/jump).
- [ ] viewport always clamps within [0%, 100%] and never inverts.
- [ ] snapping behavior is consistent across day/week/month.
- [ ] current date indicator is stable and reflects persisted `currentDate` (not “now”).
- [ ] no event listener leaks: destroying NavTimelineSelection removes listeners.

### Regression checks
- [ ] time unit change still recalculates viewport and minimap correctly.
- [ ] tasks update still triggers minimap regeneration.
- [ ] `npm test` passes.


