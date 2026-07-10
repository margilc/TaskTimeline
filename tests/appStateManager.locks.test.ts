import { TFile } from '../__mocks__/obsidian';
import { AppStateManager } from '../src/core/AppStateManager';

function makePlugin() {
    return {
        app: {
            vault: {
                on: jest.fn(),
                read: jest.fn(),
                getAbstractFileByPath: jest.fn(),
            },
            fileManager: {
                processFrontMatter: jest.fn(),
            },
        },
        loadData: jest.fn(async () => ({})),
        saveData: jest.fn(async () => {}),
    } as any;
}

function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

describe('AppStateManager.withFileLock', () => {
    it('serializes work for the same path', async () => {
        const asm = new AppStateManager(makePlugin());
        const order: string[] = [];
        const gate = deferred();

        const first = asm.withFileLock('a.md', async () => {
            order.push('first:start');
            await gate.promise;
            order.push('first:end');
        });
        const second = asm.withFileLock('a.md', async () => {
            order.push('second');
        });

        gate.resolve();
        await Promise.all([first, second]);

        expect(order).toEqual(['first:start', 'first:end', 'second']);
    });

    it('runs the next writer even when the previous one threw', async () => {
        const asm = new AppStateManager(makePlugin());
        const first = asm.withFileLock('a.md', async () => { throw new Error('boom'); });
        const second = asm.withFileLock('a.md', async () => 'ok');

        await expect(first).rejects.toThrow('boom');
        await expect(second).resolves.toBe('ok');
    });
});

describe('AppStateManager mutation refcounts', () => {
    it('stays in progress until every start is matched by an end', () => {
        const asm = new AppStateManager(makePlugin());

        asm.markMutationStart('a.md');
        asm.markMutationStart('a.md');
        asm.markMutationEnd('a.md');
        expect(asm.isMutationInProgress('a.md')).toBe(true);

        asm.markMutationEnd('a.md');
        expect(asm.isMutationInProgress('a.md')).toBe(false);
    });

    it('extra ends never go negative', () => {
        const asm = new AppStateManager(makePlugin());
        asm.markMutationEnd('a.md');
        asm.markMutationStart('a.md');
        expect(asm.isMutationInProgress('a.md')).toBe(true);
        asm.markMutationEnd('a.md');
        expect(asm.isMutationInProgress('a.md')).toBe(false);
    });
});

describe('AppStateManager.syncNameFromFilename (rename-loop prevention)', () => {
    function setup(fileContent: string) {
        const plugin = makePlugin();
        const asm = new AppStateManager(plugin);
        plugin.app.vault.read.mockResolvedValue(fileContent);
        return { plugin, asm: asm as any };
    }

    it('skips the write when the frontmatter name already matches the new identifier', async () => {
        const { plugin, asm } = setup('---\nname: Meeting\nstart: 2026-01-10\n---\nBody');
        const file = new TFile('Taskdown/P/20260110_Meeting.md');

        await asm.syncNameFromFilename(file, 'Taskdown/P/20260110_Standup.md');

        expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });

    it('tolerates collision-bumped _N filenames (drag onto a taken date must not rename the task)', async () => {
        const { plugin, asm } = setup('---\nname: Meeting\nstart: 2026-01-10\n---\nBody');
        const file = new TFile('Taskdown/P/20260110_Meeting_1.md');

        await asm.syncNameFromFilename(file, 'Taskdown/P/20260109_Meeting.md');

        expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });

    it('writes the humanized name for a genuine manual rename', async () => {
        const { plugin, asm } = setup('---\nname: Meeting\nstart: 2026-01-10\n---\nBody');
        const file = new TFile('Taskdown/P/20260110_Weekly_Review.md');
        plugin.app.vault.getAbstractFileByPath.mockReturnValue(file);
        let written: any = null;
        plugin.app.fileManager.processFrontMatter.mockImplementation(async (_f: TFile, cb: (fm: any) => void) => {
            written = {};
            cb(written);
        });

        await asm.syncNameFromFilename(file, 'Taskdown/P/20260110_Meeting.md');

        expect(written).toEqual({ name: 'Weekly Review' });
    });
});

describe('AppStateManager startup guard', () => {
    it('never persists before loadData has run', async () => {
        const plugin = makePlugin();
        const asm = new AppStateManager(plugin) as any;

        await asm.saveData({ some: 'state' });

        expect(plugin.saveData).not.toHaveBeenCalled();
    });

    it('ignores vault events until initialized', async () => {
        const plugin = makePlugin();
        const asm = new AppStateManager(plugin) as any;
        const file = new TFile('Taskdown/P/20260110_Meeting.md');

        await asm.handleFileCreate(file);
        await asm.handleFileModify(file);

        expect(plugin.app.vault.read).not.toHaveBeenCalled();
        expect(plugin.saveData).not.toHaveBeenCalled();
    });
});
