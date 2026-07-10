import type { TFile as ObsidianTFile } from 'obsidian';
import { TFile } from '../__mocks__/obsidian';
import { canonicalizeFile } from '../src/core/utils/canonicalizeFile';

// The runtime class IS the mock (jest maps 'obsidian' there); the cast only
// reconciles the nominal type for tsc.
const asReal = (f: TFile) => f as unknown as ObsidianTFile;

function taskContent(name: string, start: string): string {
    return `---\nname: ${name}\nstart: ${start}\n---\n\nBody`;
}

/** Fake vault/fileManager pair: renameFile mutates the TFile in place like
 *  Obsidian does; existingPaths simulates registry collisions. */
function makeApp(file: TFile, content: string, existingPaths: string[] = []) {
    const existing = new Set(existingPaths);
    const renames: string[] = [];
    const app: any = {
        vault: {
            read: jest.fn(async () => content),
            getAbstractFileByPath: jest.fn((path: string) => {
                if (path === file.path) return file;
                return existing.has(path) ? new TFile(path) : null;
            }),
        },
        fileManager: {
            renameFile: jest.fn(async (f: TFile, newPath: string) => {
                renames.push(newPath);
                existing.delete(f.path);
                Object.assign(f, new TFile(newPath));
            }),
        },
    };
    return { app, renames };
}

describe('canonicalizeFile', () => {
    it('no-ops when the filename already matches frontmatter', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(file, taskContent('Meeting', '2026-01-10'));

        const result = await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual([]);
        expect(result).toBe(file);
    });

    it('treats collision-bumped _N filenames as aligned', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting_2.md');
        const { app, renames } = makeApp(file, taskContent('Meeting', '2026-01-10'));

        await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual([]);
    });

    it('renames when the start date changed', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(file, taskContent('Meeting', '2026-02-01'));

        const result = await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual(['Taskdown/P/20260201_Meeting.md']);
        expect(result.path).toBe('Taskdown/P/20260201_Meeting.md');
    });

    it('renames when the name changed', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(file, taskContent('Standup', '2026-01-10'));

        await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual(['Taskdown/P/20260110_Standup.md']);
    });

    it('bumps to _N when the target filename is taken', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(
            file,
            taskContent('Meeting', '2026-02-01'),
            ['Taskdown/P/20260201_Meeting.md', 'Taskdown/P/20260201_Meeting_1.md']
        );

        await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual(['Taskdown/P/20260201_Meeting_2.md']);
    });

    it('reports each rename candidate through onWillRename before renaming', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app } = makeApp(file, taskContent('Meeting', '2026-02-01'));
        const predicted: string[] = [];

        await canonicalizeFile(app, asReal(file), (path) => predicted.push(path));

        expect(predicted).toEqual(['Taskdown/P/20260201_Meeting.md']);
    });

    it('retries with a strictly higher _N when the registry disagrees with the filesystem', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(file, taskContent('Meeting', '2026-02-01'));
        // Registry says the path is free, but the rename fails once anyway
        // (NTFS-through-WSL style disagreement).
        (app.fileManager.renameFile as jest.Mock).mockImplementationOnce(async () => {
            throw new Error('Destination file already exists!');
        });

        await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual(['Taskdown/P/20260201_Meeting_1.md']);
        expect(app.fileManager.renameFile).toHaveBeenCalledTimes(2);
    });

    it('does not rename to NaNNaNNaN for calendar-invalid dates', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(file, taskContent('Meeting', '2026-99-99'));

        const result = await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual([]);
        expect(result).toBe(file);
    });

    it('no-ops on unparseable files', async () => {
        const file = new TFile('Taskdown/P/20260110_Meeting.md');
        const { app, renames } = makeApp(file, 'no frontmatter here');

        await canonicalizeFile(app, asReal(file));

        expect(renames).toEqual([]);
    });
});
