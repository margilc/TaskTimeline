import { TFile } from '../__mocks__/obsidian';
import {
    nameToIdentifier,
    identifierToName,
    parseTaskFilename,
    formatDateForFilename,
    taskFileName,
    updateTaskFrontmatter,
} from '../src/core/utils/taskFileUtils';

describe('task filename primitives', () => {
    it('nameToIdentifier strips punctuation, underscores spaces, truncates to 20', () => {
        expect(nameToIdentifier('Fix: the #42 bug!')).toBe('Fix_the_42_bug');
        expect(nameToIdentifier('A very long task name that keeps going')).toHaveLength(20);
        expect(identifierToName('Fix_the_42_bug')).toBe('Fix the 42 bug');
    });

    it('parseTaskFilename round-trips taskFileName', () => {
        expect(parseTaskFilename(taskFileName('20260110', 'Meeting'))).toEqual({ dateStr: '20260110', identifier: 'Meeting' });
        expect(parseTaskFilename(taskFileName('20260110', 'Meeting', 2))).toEqual({ dateStr: '20260110', identifier: 'Meeting_2' });
        expect(parseTaskFilename('notes.md')).toBeNull();
    });

    it('formatDateForFilename uses the UTC calendar date', () => {
        expect(formatDateForFilename(new Date('2026-01-10'))).toBe('20260110');
    });
});

describe('updateTaskFrontmatter (the function that writes user files)', () => {
    function makeApp(frontmatter: Record<string, unknown>, file: TFile | null) {
        return {
            vault: { getAbstractFileByPath: jest.fn(() => file) },
            fileManager: {
                processFrontMatter: jest.fn(async (_f: TFile, cb: (fm: any) => void) => cb(frontmatter)),
            },
        } as any;
    }

    it('applies writes and deletes atomically via processFrontMatter', async () => {
        const frontmatter: Record<string, unknown> = { name: 'T', start: '2026-01-10', end: '2026-01-12', status: 'active' };
        const file = new TFile('Taskdown/P/20260110_T.md');
        const app = makeApp(frontmatter, file);

        await updateTaskFrontmatter(app, file.path, { start: '2026-02-01', priority: 3 }, ['end', 'status']);

        expect(frontmatter).toEqual({ name: 'T', start: '2026-02-01', priority: 3 });
    });

    it('skips undefined write values', async () => {
        const frontmatter: Record<string, unknown> = { name: 'T' };
        const file = new TFile('Taskdown/P/20260110_T.md');
        const app = makeApp(frontmatter, file);

        await updateTaskFrontmatter(app, file.path, { end: undefined, start: '2026-01-10' });

        expect(frontmatter).toEqual({ name: 'T', start: '2026-01-10' });
    });

    it('throws when the file cannot be resolved', async () => {
        const app = makeApp({}, null);
        await expect(updateTaskFrontmatter(app, 'gone.md', { start: 'x' })).rejects.toThrow('File not found');
    });
});
