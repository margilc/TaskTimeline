import { isPathIgnored } from '../src/core/utils/ignoreUtils';

describe('isPathIgnored', () => {
    test('returns false for empty or missing pattern lists', () => {
        expect(isPathIgnored('Taskdown/p/20240101_t.md', [])).toBe(false);
        expect(isPathIgnored('Taskdown/p/20240101_t.md', undefined)).toBe(false);
        expect(isPathIgnored('Taskdown/p/20240101_t.md', null)).toBe(false);
        expect(isPathIgnored('Taskdown/p/20240101_t.md', ['   '])).toBe(false);
    });

    describe('CLAUDE.md vs .claude/ folder', () => {
        test('the .claude/ folder pattern does NOT match a CLAUDE.md file', () => {
            // ".claude/" targets the folder (a ".claude/" path segment); a
            // CLAUDE.md file has no such segment, so it is not matched.
            expect(isPathIgnored('Taskdown/CLAUDE.md', ['.claude/'])).toBe(false);
        });

        test('a CLAUDE.md pattern ignores the file at any depth', () => {
            expect(isPathIgnored('Taskdown/CLAUDE.md', ['CLAUDE.md'])).toBe(true);
            expect(isPathIgnored('Taskdown/ProjectA/CLAUDE.md', ['CLAUDE.md'])).toBe(true);
        });
    });

    test('matching is case-insensitive', () => {
        expect(isPathIgnored('Taskdown/claude.md', ['CLAUDE.md'])).toBe(true);
        expect(isPathIgnored('Taskdown/CLAUDE.md', ['claude.md'])).toBe(true);
        expect(isPathIgnored('Taskdown/Templates/x.md', ['templates/'])).toBe(true);
        expect(isPathIgnored('Taskdown/.Claude/x.md', ['.claude/'])).toBe(true);
    });

    describe('default patterns (templates/ and .claude/)', () => {
        const patterns = ['templates/', '.claude/'];

        test('ignores files inside a templates folder at any depth', () => {
            expect(isPathIgnored('Taskdown/templates/base.md', patterns)).toBe(true);
            expect(isPathIgnored('Taskdown/ProjectA/templates/note.md', patterns)).toBe(true);
        });

        test('ignores the templates folder itself (trailing-slash form)', () => {
            expect(isPathIgnored('Taskdown/templates/', patterns)).toBe(true);
        });

        test('ignores everything inside a .claude folder', () => {
            expect(isPathIgnored('.claude/plans/foo.md', patterns)).toBe(true);
            expect(isPathIgnored('Taskdown/.claude/notes.md', patterns)).toBe(true);
        });

        test('does not ignore normal task files', () => {
            expect(isPathIgnored('Taskdown/ProjectA/20240101_task.md', patterns)).toBe(false);
            expect(isPathIgnored('Taskdown/All Projects/20240101_task.md', patterns)).toBe(false);
        });

        test('trailing-slash pattern does not match a similarly named file', () => {
            // "my_templates.md" has no "templates/" segment, so it is kept.
            expect(isPathIgnored('Taskdown/ProjectA/my_templates.md', patterns)).toBe(false);
            expect(isPathIgnored('Taskdown/ProjectA/notes.claude.md', patterns)).toBe(false);
        });
    });

    describe('glob wildcards', () => {
        test('* matches within a single path segment only', () => {
            expect(isPathIgnored('Taskdown/draft_x.md', ['draft_*.md'])).toBe(true);
            // "*" must not cross a "/" boundary
            expect(isPathIgnored('Taskdown/sub/x.md', ['Taskdown/*.md'])).toBe(false);
        });

        test('** matches across path separators', () => {
            expect(isPathIgnored('Taskdown/archive/2023/old.md', ['archive/**'])).toBe(true);
            expect(isPathIgnored('Taskdown/a/b/c/deep.md', ['a/**/deep.md'])).toBe(true);
        });

        test('handles folder names containing spaces', () => {
            expect(isPathIgnored('Taskdown/Old Stuff/x.md', ['Old Stuff/'])).toBe(true);
        });
    });

    test('any matching pattern in the list triggers an ignore', () => {
        const patterns = ['templates/', 'archive/'];
        expect(isPathIgnored('Taskdown/archive/x.md', patterns)).toBe(true);
        expect(isPathIgnored('Taskdown/live/x.md', patterns)).toBe(false);
    });
});
