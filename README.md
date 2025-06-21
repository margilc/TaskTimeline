# TaskTimeline

Transform your task-based markdown files into an interactive, timeline-based board view for project management in Obsidian.

## Overview

TaskTimeline is an Obsidian plugin that revolutionizes task management by visualizing markdown-based tasks on an interactive timeline board. It seamlessly integrates with Obsidian's note-taking workflow, offering a powerful yet intuitive way to plan, track, and manage projects directly within your vault.

## Key Features

- **Timeline-Based Visualization**: Tasks are displayed on a board across days, weeks, or months
- **Multiple Time Views**: Switch between Day, Week, and Month views for different perspectives
- **Markdown-Powered**: Leverages the simplicity and flexibility of markdown for task creation
- **Frontmatter Integration**: Uses frontmatter for rich metadata like dates, categories, and priorities
- **Progress Tracking**: Visualizes task completion through automatic parsing of markdown checkboxes
- **Color-Coded Organization**: Customize colors based on category, status, or priority
- **Project Management**: Organize tasks into project folders for better structure
- **Task Creation**: Create new tasks directly from the timeline interface
- **File Integration**: Click task cards to open and edit the underlying markdown files
- **Real-time Updates**: Automatically updates when task files are modified in the vault

## Screenshots

### Main Timeline View
*Interactive timeline board showing tasks across multiple days with color coding by category*

![Timeline Board](https://via.placeholder.com/800x400?text=TaskTimeline+Board+View)

### Navigation Controls
*Project selection, view switching, and color customization controls*

![Navigation Controls](https://via.placeholder.com/800x200?text=Navigation+Controls)

### Task Creation
*Simple modal for creating new tasks with frontmatter metadata*

![Task Creation](https://via.placeholder.com/400x300?text=New+Task+Modal)

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Navigate to Community plugins
3. Browse and search for "TaskTimeline"
4. Click Install and then Enable

### Manual Installation

1. Download the latest release from the [GitHub releases page](https://github.com/margilc/TaskTimeline/releases)
2. Extract the files to your vault's `.obsidian/plugins/task-timeline/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

## Usage

### Creating Task Files

Tasks are markdown files with frontmatter metadata:

```yaml
---
name: "Develop Login Module"
start: 2024-01-15
end: 2024-02-05
priority: 1
projectId: "WebApp"
responsible: "John Doe"
---

# Develop Login Module

This task involves creating the user authentication system.

## Subtasks

- [x] Design user interface
- [ ] Implement backend authentication
- [ ] Add password validation
- [ ] Write unit tests
```

### Task File Requirements

- **Filename format**: `YYYYMMDD_IDENTIFIER.md` (e.g., `20240115_DevelopLoginModule.md`)
- **Required frontmatter**: `name` and `start` date
- **Optional frontmatter**: `end`, `category`, `status`, `priority` (1-5)
- **Progress tracking**: Uses markdown checkboxes in the content

### Timeline Views

1. **Day View**: Individual day columns for detailed daily planning
2. **Week View**: Daily columns for weekly overview  
3. **Month View**: Daily columns for monthly planning

### Customization

Access plugin settings through:
- Obsidian Settings → Plugin Options → TaskTimeline
- Configure task directory, color mappings, and display preferences
- Set default views and card display options

## Configuration

### Settings Options

- **Task Directory**: Specify where your task files are stored (default: "Taskdown")
- **Open by Default**: Automatically open timeline on startup
- **Open in New Pane**: Open timeline in a separate pane
- **Number of Columns**: Customize timeline width (3-10 columns)
- **Timeline Date Range**: Set global start and end dates for the timeline

### Project Organization

Organize tasks by creating project folders under your task directory:

```yaml
---
name: "Database Design"
start: 2024-01-20
projectId: "E-commerce Platform"
---
```

## Troubleshooting

### Common Issues

**Tasks not appearing on the board:**
- Verify task files have required `name` and `start` frontmatter
- Check that files are in the configured task directory
- Ensure dates are in YYYY-MM-DD format

**Performance issues with many tasks:**
- The plugin is optimized for large task sets with intelligent caching
- Consider organizing tasks into subdirectories by project or time period

**Color customization not working:**
- Restart Obsidian after changing color settings
- Verify project IDs match exactly between tasks and color mappings

### Getting Help

- Report issues on [GitHub Issues](https://github.com/margilc/TaskTimeline/issues)
- Check the [documentation](https://github.com/margilc/TaskTimeline/wiki) for detailed guides
- Join the discussion in the [Obsidian Community Forum](https://forum.obsidian.md/)

## Advanced Features

### Available Commands
- **"Open Task Timeline"**: Command palette option to open the timeline view
- **Ribbon Icon**: Click the calendar-clock icon in the left ribbon to open timeline
- **Modal Interactions**: Escape key closes the task creation modal

### Performance Optimization
- **Layout caching**: Automatic caching for fast rendering with cache invalidation
- **Event-driven updates**: Efficient re-rendering only when data changes
- **Memory management**: Proper cleanup on component destruction
- **File watching**: Optimized vault event handling for real-time updates

### Integration with Obsidian Features
- **File watching**: Automatically updates when task files change
- **Vault events**: Responds to file creation, deletion, and moves
- **Plugin API**: Uses standard Obsidian plugin architecture
- **Settings sync**: Integrates with Obsidian's settings system

## Development

### Architecture

TaskTimeline follows a three-component architecture:

1. **AppStateManager**: Central state management with event orchestration
2. **UI Components**: Pure presentation layer with event-driven updates
3. **Business Logic**: Pure functions for state updates in `src/core/update/`

### Building from Source

```bash
# Clone the repository
git clone https://github.com/margilc/TaskTimeline.git
cd TaskTimeline

# Install dependencies
npm install

# Build for development (with file watching)
npm run dev

# Build for production
node esbuild.config.mjs production

# Run tests
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Attribution

TaskTimeline was inspired by project management tools like Gantt charts and kanban boards, adapted specifically for Obsidian's markdown-centric workflow.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes and version updates.

---

**Funding**: If you find TaskTimeline helpful, consider [sponsoring the development](https://github.com/sponsors/margilc) to support continued improvements and new features.