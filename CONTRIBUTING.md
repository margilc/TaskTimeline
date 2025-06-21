# Contributing to TaskTimeline

Thank you for your interest in contributing to TaskTimeline! This document provides guidelines and information for contributing to the project.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm (comes with Node.js)
- Git
- Obsidian (for testing)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/TaskTimeline.git
   cd TaskTimeline
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Mode**
   ```bash
   npm run dev
   ```
   This will build the plugin and watch for changes, automatically copying files to your test vault.

4. **Run Tests**
   ```bash
   npm test
   ```

## Architecture Overview

TaskTimeline follows a three-component architecture:

### 1. AppStateManager (`src/core/AppStateManager.ts`)
- Central state management with persistent and volatile state
- Integrated vault event handling
- Business logic orchestration

### 2. UI Components (`src/components/`)
- Pure presentation layer components
- Event-driven updates through `update_<NAME>_done` events
- Self-contained DOM management and cleanup

### 3. Business Logic (`src/core/update/`)
- Pure functions accepting `app: App`, `state: IAppState`, and parameters
- Return new state objects without side effects
- Follow `update_<NAME>_pending/done` convention

## Development Guidelines

### Code Quality Standards

- **Minimal Comments**: Maximum 3 lines of comments per file
- **Single Responsibility**: Each file serves one clear purpose
- **Zero Legacy References**: No deprecated code or unused imports
- **Convention Consistency**: All events follow `update_<NAME>_pending/done` pattern
- **Performance Optimized**: Intelligent caching and algorithm optimization

### File Structure
```
src/
├── core/                    # Core application logic
│   ├── AppStateManager.ts   # State + events + vault listening
│   ├── update/              # Business logic functions
│   └── utils/               # Core utilities
├── components/              # UI components
│   ├── NavBar/              # Navigation components
│   ├── BoardContainer/      # Board view components
│   └── Debug/               # Development utilities
├── views/                   # Main view classes
├── interfaces/              # TypeScript interfaces
├── enums/                   # Enums and constants
└── main.ts                  # Plugin entry point
```

### Naming Conventions

- **Variables/Functions**: camelCase
- **Classes/Interfaces**: PascalCase (interfaces start with 'I')
- **Constants**: UPPER_CASE
- **Files**: PascalCase for components, camelCase for utilities
- **CSS Classes**: kebab-case

## Contributing Process

### 1. Choose an Issue

- Look for issues labeled `good first issue` for beginners
- Check if the issue is already assigned before starting work
- Comment on the issue to indicate you're working on it

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Make Changes

- Follow the architecture patterns described above
- Write tests for new functionality
- Ensure all existing tests pass
- Update documentation if needed

### 4. Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- colorUtils.test.ts

# Generate dependency graph
npm run graph:deps
```

### 5. Commit Guidelines

Use conventional commit format:

```
feat: add new timeline granularity options
fix: resolve task card positioning issue
docs: update API documentation
test: add tests for date utilities
refactor: simplify state management logic
```

### 6. Submit Pull Request

1. Push your branch to your fork
2. Create a pull request with a clear title and description
3. Include screenshots for UI changes
4. Reference related issues using `Fixes #123`

## Testing

### Test Structure

- **Unit Tests**: Located in `tests/` directory
- **Test Framework**: Jest with ts-jest
- **Test Helpers**: Shared utilities in `tests/testHelpers.ts`
- **Test Data**: Sample files in `tests/data/`

### Writing Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { yourFunction } from '../src/utils/yourUtility';

describe('yourFunction', () => {
  it('should handle normal case', () => {
    const result = yourFunction(input);
    expect(result).toBe(expectedOutput);
  });

  it('should handle edge case', () => {
    const result = yourFunction(edgeInput);
    expect(result).toBe(expectedEdgeOutput);
  });
});
```

### Performance Testing

The plugin includes performance benchmarks. When making changes that could affect performance:

1. Run performance tests: `npm test -- layoutPerformance.test.ts`
2. Ensure no significant regression in timing
3. Update benchmarks if optimizations are made

## Documentation

### Code Documentation

- Use TypeScript types for self-documenting code
- Add JSDoc comments only for complex algorithms
- Keep comments minimal and focus on "why" not "what"

### User Documentation

- Update README.md for new features
- Add examples for new configuration options
- Update CHANGELOG.md following semantic versioning

## Release Process

1. **Version Bumping**: Use semantic versioning (MAJOR.MINOR.PATCH)
2. **Changelog**: Update CHANGELOG.md with new features and fixes
3. **Testing**: Ensure all tests pass and manual testing is complete
4. **Documentation**: Update README and other docs as needed
5. **Release**: Create GitHub release with proper tags

## Getting Help

- **Issues**: Use GitHub Issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Discord**: Join the Obsidian community Discord for real-time help

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributor graphs

## License

By contributing to TaskTimeline, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to TaskTimeline! Your help makes this plugin better for the entire Obsidian community.