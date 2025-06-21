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

- `npm run dev` - Build and watch for changes in development mode (auto-copies to test vault)
- `npm run test` - Run Jest tests
- `npm run graph:deps` - Generate dependency graph visualization
- `esbuild.config.mjs production` - Build for production

## Architecture Overview

This is an Obsidian plugin called TaskTimeline that transforms markdown task files into an interactive timeline board view.

### Core Architecture Pattern

The plugin follows a centralized state management pattern with three main layers:

1. **State Management Layer** (`src/core/`)
   - `AppStateManager` - Central state manager with persistent and volatile state
   - Integrated vault event handling (no separate VaultEventEmitter)
   - State is split into persistent (saved to disk) and volatile (runtime only) portions

2. **Component Layer** (`src/components/`)
   - UI components that listen to state changes via event emitter pattern
   - Each component manages its own DOM and cleanup lifecycle
   - Components include NavBar, BoardContainer, Debug utilities

3. **View Layer** (`src/views/`)
   - `TaskTimelineView` - Main Obsidian ItemView that orchestrates all components

### Key Interfaces

- `IAppState` - Defines the complete application state structure
- `ITask` - Task data model with frontmatter properties
- `IProject` - Project grouping structure
- `IBoard` - Board layout and timeline configuration

### Event System

Uses Obsidian's native Events class for component communication:
- `PluginEvent` enum defines all event types following `update_<NAME>_pending/done` convention
- Components emit events through AppStateManager
- State changes trigger cascading updates to listening components
- Business logic functions are pure and located in `src/core/update/`

### Task File Format

Tasks are markdown files with YAML frontmatter:
- Filename format: `YYYYMMDD_IDENTIFIER.md`
- Required frontmatter: `name`, `start`
- Optional: `end`, `priority`, `projectId`, `responsible`
- Progress tracked via markdown checkboxes in content

### Development Notes

- Plugin builds to `main.js` and auto-copies to test vault during development
- TypeScript configuration targets ES6 with Obsidian-specific externals
- Uses esbuild for fast compilation and bundling
- File watching monitors both `src/` and `styles.css`

## Test Configuration

- Jest with ts-jest transformer
- No existing test mocks should be used (legacy)
- Test files should follow `*.test.ts` or `*.spec.ts` naming