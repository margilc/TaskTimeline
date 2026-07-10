# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Interaction Guidelines

**Critical Thinking Expected:**
- Challenge instructions that contradict previous guidance or established patterns
- Question approaches that violate good software engineering practices
- Point out potential issues with proposed solutions before implementing
- Ask for clarification when requirements are ambiguous or incomplete
- Suggest alternative approaches when the proposed solution has significant drawbacks

**Honest Assessment Required:**
- Only praise approaches when benefits genuinely outweigh costs
- Highlight trade-offs and potential problems with proposed solutions
- Provide constructive criticism when designs could be improved
- Don't assume every instruction is optimal - evaluate and question
- Prioritize code quality and architectural consistency over immediate requests

## Development Commands

- `npm run dev` — build and watch `src/` + `styles.css`; on each rebuild it copies `main.js`/`manifest.json`/`styles.css` into the test vault. It does **not** change the version.
- `npm test` — `tsc --noEmit` over the whole repo, then Jest
- `npm run check` — the typecheck alone
- `npm run build` — one-off production build (minified, no sourcemap); does not copy to the vault

## Releasing

A release is triggered by pushing a **git tag**. `.github/workflows/release.yml` then runs `npm run build` and creates a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached (CI builds `main.js`; it is git-ignored).

Conventions:
- Tag name = the version in `manifest.json`, **bare semver, no `v` prefix** (e.g. `2.1.5`).
- `minAppVersion` is `0.15.0`. `versions.json` maps each shipped version → minAppVersion; keep it to versions that were actually released.

`./create_release.sh -v X.Y.Z` automates the whole flow (validates, bumps `manifest.json`/`package.json`/`versions.json`, builds, commits, tags, pushes). The manual equivalent:
1. Set the version in `manifest.json`, `package.json`, and `package-lock.json` (`npm version X.Y.Z --no-git-tag-version` handles the latter two), and add `"X.Y.Z": "0.15.0"` to `versions.json`.
2. `npm run build && npm test` — both must be green.
3. Commit on `main`, then `git tag -a X.Y.Z -m X.Y.Z && git push origin main X.Y.Z`.

## Architecture Overview

This is an Obsidian plugin called TaskTimeline that renders markdown task files as an interactive timeline board.

### Core Architecture Pattern

1. **State Management Layer** (`src/core/`)
   - `AppStateManager` — central state manager with persistent (saved to `data.json`) and volatile (runtime) state, integrated vault event handling, a per-file write lock (`withFileLock`), and refcounted `mutationCounts` that let the synchronous modify-event handler defer to in-flight drag commits. Vault events are ignored until `initialize()` (deferred to `onLayoutReady`) has loaded persisted data and built the `TaskIndex`; `saveData` is gated on `loadData` having run.
   - `TaskIndex` — incremental path→task index; single-file reparse per vault event with change detection (an unchanged reparse skips the whole update pipeline).
   - `src/core/update/` — one function per state operation. Most are pure reducers over `{persistent, volatile}`; `createTask` and `applyTaskMutation` also perform vault I/O (they create/modify files), and `updateLayout` keeps a module-level cache (`clearLayoutCache`). Don't describe them as uniformly "pure".
   - `src/core/utils/` — headless helpers: parsing (`taskUtils`), filenames/frontmatter writes (`taskFileUtils`), rename canonicalization (`canonicalizeFile`), dates (`dateUtils`, UTC-frame; display uses UTC accessors, "today" is the local calendar day), grouping (`groupingUtils`), colors, links, ignore patterns, templates. No DOM code in `core/`.

2. **Component Layer** (`src/components/`)
   - `BoardContainer/` — board renderer (full re-render per layout change, gated during drags), timeline header, task groups/cards, arrow overlay, grouping dropdown, and `interaction/` (drag/drop + resize: `CardInteractionController` state machine, `DragGhost`, pure `dragGeometry`).
   - `NavBar/` — project picker, color-map controls, settings button.
   - `modals/` — `NewTaskModal` + `TaskCreationHelper`.
   - `common/` — `CustomDropdown`, tooltip and DOM helpers.
   - Components listen to state changes via the events emitter and clean up in `destroy()`.

3. **View Layer** (`src/views/`)
   - `TaskTimelineView` — main board ItemView (also handles undo/redo keys).
   - `HorizontalTaskView` — column-per-section editor for `horizontal_mode` files; tracks renames, merges saves per-column against external edits.
   - `viewTypes.ts` — the view type constants.

### Event System

Obsidian's `Events` class, event names in the `PluginEvent` enum. State operations follow `update_<NAME>_pending` → handler in `AppStateManager` → `update_<NAME>_done` (+ `appStateUpdated`). Layout updates are rAF-coalesced. Drag lifecycle: `task_drag_started` / `task_drag_ended` (the latter fires on every interaction end and releases deferred renders).

### Task File Format

- Filename: `YYYYMMDD_IDENTIFIER.md` — kept in sync with frontmatter by `canonicalizeFile` (collisions get `_N` suffixes; name-sync tolerates them)
- Required frontmatter: `name`, `start` (YYYY-MM-DD)
- Optional: `end`, `category`, `status`, `priority` (1–5, default 5), `horizontal_mode`
- `projectId`/`responsible` are **not** read — the project is the parent folder
- Progress from markdown checkboxes (`-`/`*`/`+`/ordered) outside code fences

### Development Notes

- esbuild targets `es2018` with Obsidian/CodeMirror externals; `.md` templates are inlined as raw strings
- Dates are UTC-frame throughout: frontmatter dates parse as UTC midnight, layout math and display both use UTC accessors; only "today" derives from the local calendar day
- A running log of notable changes is kept in `.claude/docs/working_history.md` (local, untracked)

## Test Configuration

- Jest + ts-jest (transpile-only; `npm run check` does the type checking)
- `__mocks__/obsidian.ts` is the **intentional** resolution shim for the types-only `obsidian` package, wired via `moduleNameMapper`; tests that need `TFile`/`TFolder` instances import the mock directly and cast at src boundaries
- Test files follow `*.test.ts`; build tasks with `makeTask`/`makeTasks` from `tests/testHelpers.ts` (complete `ITask`s, keeps tsc green)
- No timing-based assertions — scale coverage is the deterministic 200-task overlap test in `layout.core`
