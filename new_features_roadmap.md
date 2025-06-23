# TaskTimeline Plugin - New Features Roadmap

## 01 - Architecture and Guidance

### Core Architecture Pattern
TaskTimeline follows a **three-component architecture** with centralized state management:

1. **AppStateManager** (`src/core/AppStateManager.ts`)
   - Integrated state management, vault events, and business logic orchestration
   - Persistent (saved to disk) and volatile (runtime only) state portions
   - Convention-based event system: `update_<NAME>_pending/done` pattern

2. **UI Components** (`src/components/`)
   - Pure presentation layer that listens to state changes via event emitter
   - Each component manages its own DOM and cleanup lifecycle
   - Listen to `update_<NAME>_done` events and redraw via `appStateManager.getState()`

3. **Business Logic Functions** (`src/core/update/`)
   - Pure functions that accept app and state, return new state
   - Single responsibility per file
   - Zero references to legacy code

### Directory Structure
```
src/
├── core/                  # State management and business logic
│   ├── AppStateManager.ts # Central state + events + vault listening
│   ├── update/           # Pure business logic functions
│   └── utils/            # Core utilities
├── components/           # UI components (NavBar, BoardContainer, Debug)
├── views/               # Main Obsidian ItemView
├── interfaces/          # TypeScript interfaces
├── enums/              # Enums and constants
└── main.ts             # Plugin entry point
```

### Established Patterns

**Event System:**
- UI Components emit `update_<NAME>_pending` events
- AppStateManager handles business logic and emits `update_<NAME>_done` events
- Components listen to done events and redraw

**Code Quality Standards:**
- Maximum 3 lines of comments per file
- Single responsibility per file
- Absolutely minimal files with no unnecessary code
- Follow `update_<NAME>_pending/done` convention

**State Management:**
- Persistent state: project settings, color mappings, timeline dates
- Volatile state: current viewport, minimap data, layout cache
- All state changes flow through AppStateManager

### Key Components

**Navigation (`src/components/NavBar/`):**
- NavProjectsSelection, NavViewsSelection, NavColorMapSelection
- NavTimeSlider (drag functionality), NavMinimap (task density visualization)
- Unified CSS design system with `.nav-control-base` styling

**Board Layout (`src/components/BoardContainer/`):**
- BoardContainer, BoardTaskCard, BoardTaskGroup, BoardTimelineHeader
- Intelligent task positioning with conflict detection
- Greedy row assignment algorithm with grouping (status/priority/category)

### Performance & Testing Strategy

**What Needs Testing:**
- Board layout algorithms (`updateLayout.ts`, `updateTaskPositions.ts`)
- Minimap functionality and timeline viewport calculations
- Task parsing and frontmatter validation
- Date utilities and boundary calculations
- Performance tests for layout with 50+ tasks

**What Doesn't Need Testing:**
- UI components (should be simple enough)
- AppStateManager (requires excessive mocking)
- CSS styling and visual interactions
- Basic getter/setter functions

**Performance Benchmarks:**
- 50 tasks: 11.91ms layout time
- 100 tasks: 8.23ms layout time  
- Cache hits: 0.02ms
- Comprehensive test coverage: 50+ passing tests

### Development Commands
- `npm run dev` - Build and watch (auto-copies to test vault)
- `npm run test` - Run Jest tests
- `npm run graph:deps` - Generate dependency graph

### Critical Implementation Notes

**Task File Format:**
- Filename: `YYYYMMDD_IDENTIFIER.md`
- Required frontmatter: `name`, `start`
- Optional: `end`, `priority`, `projectId`, `responsible`
- Progress via markdown checkboxes

**Color System:**
- 8 predefined colors + HIDE option + white default
- Nested color mappings per project with persistent state
- Dynamic task card coloring with contrast-aware text

**Timeline Views:**
- Day/Week/Month with dynamic column generation
- Viewport management with minimap navigation
- Snapped date boundaries for alignment consistency

### Timeline Components Reference

**NavTimelineSelection** - Parent component containing both:
- **NavMinimap** - Task density visualization with grayscale squares
- **NavTimeSlider** - Timeline navigation component with two key elements:
  - **track** - The timeline with tickmarks spanning from snapped global min to snapped global max
  - **selector** - The draggable viewport selector (the actual slider element)

## 02 - New Features

### Slider Component Rework

**Current Implementation:**
- NavTimelineSelection contains NavMinimap + NavTimeSlider
- NavTimeSlider has track (timeline with tickmarks) and selector (draggable element)
- Track spans from `state.volatile.globalMinDateSnapped` to `state.volatile.globalMaxDateSnapped`
- Selector represents current viewport and is draggable to change timeline view

**Existing Infrastructure Analysis:**

1. **Snapping Already Exists** (`updateSnappedDateBoundaries.ts`)
   - ✅ Monday-start snapping for WEEK: `daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1`
   - ✅ Month-start snapping for MONTH: `setUTCDate(1)`
   - ✅ Day normalization: `setUTCHours(0, 0, 0, 0)`

2. **Date Utilities Available** (`dateUtils.ts`)
   - ✅ `getWeekNumber()` - ISO week calculation
   - ✅ `formatDateByTimeUnit()` - already formats "2025 - W26" for weeks
   - ✅ Monday detection in `isDateInRange()`: `startOfWeekDate.setDate(normalizedDate.getDate() - dayOfWeek + 1)`
   - ✅ Month detection: `getMonthYear()`

3. **Timeline Generation** (`timelineUtils.ts`)
   - ✅ `normalizeToTimePeriodStart()` - snaps to period boundaries
   - ✅ `generateTimeMarkers()` - creates tick marks
   - Need: Enhanced to return metadata for emphasis

**Required Business Logic Changes:**

1. **Viewport Snapping** - Extend existing snapping logic to viewport updates
2. **Enhanced Tick Generation** - Modify `generateTimeMarkers()` for selective/emphasized ticks
3. **Column Header Styling** - Add month-start detection to `generateColumnHeaders()`
4. **Enhanced Week Labels** - Extend `formatDateByTimeUnit()` to include month abbreviation
5. **Drag State Separation** - Implement preview mode in `NavTimeSlider.ts`

**✅ COMPLETED - Slider Component Rework (v1.0.565)**

All phases completed successfully:

**Phase A - Viewport Snapping Infrastructure:**
- ✅ Created `snapViewportToTimeUnit()` with numberOfColumns parameter support
- ✅ Applied snapping on initialization using snapped start dates + numberOfColumns calculation  
- ✅ Implemented immediate snapping during drag operations
- ✅ Fixed timezone issues in `normalizeDate()` using UTC consistently

**Phase B - Enhanced Tick Mark System:**
- ✅ Extended `generateTimeMarkersWithMetadata()` to return `{date: string, type: 'normal'|'emphasized'}`
- ✅ Month view: January ticks emphasized
- ✅ Week/Day views: Monday-only ticks with month-start Monday emphasis
- ✅ Updated NavTimeSlider to use metadata for `.emphasized` CSS classes

**Phase C - Improved Column Headers:**
- ✅ Extended `generateColumnHeaders()` with `isEmphasized` flag
- ✅ Month view: January emphasis
- ✅ Week view: Enhanced labels with month abbreviation for month-start weeks only
- ✅ Day view: All Mondays emphasized (simplified from month-start only)
- ✅ Updated `BoardTimelineHeader` with `emphasized-header` CSS class

**Phase D - Drag Behavior Rework:**
- ✅ Implemented immediate snapping during drag (simplified approach)
- ✅ Removed preview/separate positioning complexity
- ✅ Applied snapping logic consistently throughout drag operations

**Phase E - Integration & Polish:**
- ✅ Fixed week emphasis logic to detect actual month-start weeks
- ✅ Corrected week month labels to show starting month, not ending month
- ✅ Enhanced CSS to only change background color (no borders/sizing)
- ✅ Fixed viewport initialization snapping to use earlier snapping points
- ✅ Optimized minimum selector width for proper visual proportions
- ✅ Added comprehensive debug state dump functionality

**Additional Improvements:**
- ✅ Created efficient build commands (`npm run build-quick`)
- ✅ Fixed card click behavior to reuse split panes intelligently 
- ✅ Positioned debug and settings buttons cleanly in top-right corner
- ✅ Enhanced date calculation accuracy across all time units

---

### Next Feature: [Feature Name TBD]

**Current Status:** 🚧 Ready for next development cycle

**Analysis Needed:**
- [ ] Identify high-priority user experience improvements
- [ ] Evaluate existing component architecture for extension points
- [ ] Review performance characteristics with current feature set
- [ ] Consider integration opportunities with Obsidian ecosystem

**Potential Areas for Enhancement:**
- Advanced task filtering and search capabilities
- Enhanced task dependency visualization
- Improved mobile/responsive design
- Additional export/import formats
- Performance optimizations for large datasets
- Advanced color theming and customization options

**Architecture Considerations:**
- Maintain three-component pattern (AppStateManager + UI Components + Business Logic)
- Follow established event system (`update_<NAME>_pending/done`)
- Preserve test coverage and performance benchmarks
- Ensure backward compatibility with existing task file format