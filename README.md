# TaskTimeline

Transform task-based markdown files into an interactive timeline board for project management in Obsidian.

## Overview

TaskTimeline renders the markdown task files in your vault as cards on a scrollable, zoomable timeline board. Tasks stay plain markdown — the board is just a view. Edit a file and the board updates; drag a card and the file's frontmatter updates.

## Features

- **Timeline board** with day, week, and month zoom levels — scroll-wheel zoom is cursor-anchored and transitions smoothly between time units
- **Drag & drop**: move a card horizontally to shift its dates (duration is preserved, even on week/month zoom) or vertically to change its group; drag the card edges to resize start/end
- **Undo/redo** for drag/resize/move changes (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y), also available as commands
- **Grouping** by status, category, or priority, with per-project group ordering, fold/unfold, and reordering from the group headers
- **Color mappings**: per-project colors by category/status/priority, including a "hide" value to filter tasks off the board; optional custom default card color
- **Progress bars** from markdown checkboxes in the task body
- **Task links**: `[[wikilinks]]` between task files draw arrows on hover
- **Quick creation**: click a date column header or group header to open the New Task modal pre-filled; templates from your templates folder can pre-fill fields and body
- **Horizontal task view**: files with `horizontal_mode: true` open in a column-per-section editing view with inline markdown editing, checkbox toggling, and `[[link]]`/`#tag` autocompletion
- **Filename sync**: files are kept in the `YYYYMMDD_IDENTIFIER.md` convention — change a task's `start` or `name` and the file is renamed to match (collisions get an `_N` suffix)
- **Ignore list**: exclude folders/files from the board with glob patterns
- **Right-click-drag panning**, sticky header row and group column, light/dark theme aware

## Task file format

Tasks are markdown files named `YYYYMMDD_IDENTIFIER.md` (e.g. `20260115_DevelopLoginModule.md`):

```yaml
---
name: Develop Login Module
start: 2026-01-15
end: 2026-02-05
category: development
status: In Progress
priority: 2
---

# Develop Login Module

## Subtasks
- [x] Design user interface
- [ ] Implement backend authentication
```

- **Required**: `name`, `start` (YYYY-MM-DD)
- **Optional**: `end` (YYYY-MM-DD, may equal `start`), `category`, `status`, `priority` (1–5, default 5), `horizontal_mode: true`
- **Progress** is parsed from checkboxes (`- [ ]`, `* [x]`, `+ [ ]`, `1. [ ]`) outside code blocks

## Projects

Folders directly under the task directory are projects:

```
Taskdown/
├── WebApp/
│   ├── 20260115_DevelopLoginModule.md
│   └── 20260120_DatabaseDesign.md
└── Marketing/
    └── 20260201_LaunchPlan.md
```

The project picker in the nav bar switches between them (or shows all).

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/margilc/TaskTimeline/releases)
2. Copy them into `<vault>/.obsidian/plugins/task-timeline/`
3. Reload Obsidian and enable the plugin in Settings → Community plugins

Open the board via the calendar-clock ribbon icon or the "Open Task Timeline" command.

## Settings

- **Task Directory** — where task files live (default `Taskdown`; committed on blur)
- **Ignore list** — one glob pattern per line, matched against whole path segments (`templates/`, `.claude/`, `archive/**`)
- **Open by default / Open in new pane**
- **Row height**, **min/max column width**, **zoom step**, **min/max font size**
- **Default card color** — leave at the default to follow your theme

## Development

```bash
npm install
npm run dev     # watch build; copies main.js/manifest.json/styles.css into the test vault
npm run build   # one-off production build (no copy)
npm test        # tsc --noEmit + jest
```

Releases are tag-driven: pushing a bare-semver tag (e.g. `2.2.0`) triggers the GitHub Actions workflow that builds `main.js` and publishes the release. `./create_release.sh -v <version>` automates the version bump, commit, tag, and push.

## License

MIT — see [LICENSE](LICENSE).

---

**Funding**: If TaskTimeline is useful to you, consider [sponsoring development](https://github.com/sponsors/margilc).
