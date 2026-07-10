import type { TAbstractFile } from 'obsidian';
import { TFile, TFolder } from '../__mocks__/obsidian';
import { TaskIndex } from '../src/core/TaskIndex';

// The runtime class IS the mock (jest maps 'obsidian' there); the cast only
// reconciles the nominal type for tsc.
const asReal = (f: TFile) => f as unknown as TAbstractFile;

function taskContent(name: string, start: string, body = 'Body'): string {
    return `---\nname: ${name}\nstart: ${start}\n---\n\n${body}`;
}

/** In-memory vault: a folder tree plus per-path contents. */
function makeVault(contents: Record<string, string>) {
    const root = new TFolder('Taskdown');
    const folders = new Map<string, TFolder>([['Taskdown', root]]);
    const files = new Map<string, TFile>();

    for (const path of Object.keys(contents)) {
        const parts = path.split('/');
        let parentPath = parts[0];
        for (let i = 1; i < parts.length - 1; i++) {
            const folderPath = `${parentPath}/${parts[i]}`;
            if (!folders.has(folderPath)) {
                const folder = new TFolder(folderPath);
                folders.get(parentPath)!.children.push(folder);
                folders.set(folderPath, folder);
            }
            parentPath = folderPath;
        }
        const file = new TFile(path);
        folders.get(parentPath)!.children.push(file);
        files.set(path, file);
    }

    const app: any = {
        vault: {
            read: jest.fn(async (file: TFile) => {
                const content = contents[file.path];
                if (content === undefined) throw new Error('missing: ' + file.path);
                return content;
            }),
            getAbstractFileByPath: jest.fn((path: string) => folders.get(path) ?? files.get(path) ?? null),
        },
    };
    return { app, files, contents };
}

describe('TaskIndex', () => {
    it('initialize scans project folders recursively and skips ignored paths', async () => {
        const { app } = makeVault({
            'Taskdown/A/20260101_One.md': taskContent('One', '2026-01-01'),
            'Taskdown/B/20260102_Two.md': taskContent('Two', '2026-01-02'),
            'Taskdown/templates/20260103_Tpl.md': taskContent('Tpl', '2026-01-03'),
        });
        const index = new TaskIndex(app, 'Taskdown', ['templates/']);

        await index.initialize();

        expect(index.size()).toBe(2);
        expect(index.getTasks().map(t => t.name).sort()).toEqual(['One', 'Two']);
    });

    it('getTasks filters by project folder prefix', async () => {
        const { app } = makeVault({
            'Taskdown/A/20260101_One.md': taskContent('One', '2026-01-01'),
            'Taskdown/B/20260102_Two.md': taskContent('Two', '2026-01-02'),
        });
        const index = new TaskIndex(app, 'Taskdown', []);
        await index.initialize();

        expect(index.getTasks('A').map(t => t.name)).toEqual(['One']);
        expect(index.getTasks('All Projects')).toHaveLength(2);
    });

    it('handleFileModify reports whether the parsed task changed', async () => {
        const vault = makeVault({
            'Taskdown/A/20260101_One.md': taskContent('One', '2026-01-01'),
        });
        const index = new TaskIndex(vault.app, 'Taskdown', []);
        await index.initialize();
        const file = vault.files.get('Taskdown/A/20260101_One.md')!;

        // Same content re-parse (e.g. the echo of our own write): unchanged.
        expect(await index.handleFileModify(asReal(file))).toBe(false);

        vault.contents['Taskdown/A/20260101_One.md'] = taskContent('One', '2026-01-05');
        expect(await index.handleFileModify(asReal(file))).toBe(true);
        expect(index.getTasks()[0].start).toBe('2026-01-05');
    });

    it('removes a task whose file becomes unparseable', async () => {
        const vault = makeVault({
            'Taskdown/A/20260101_One.md': taskContent('One', '2026-01-01'),
        });
        const index = new TaskIndex(vault.app, 'Taskdown', []);
        await index.initialize();

        vault.contents['Taskdown/A/20260101_One.md'] = 'frontmatter is gone';
        const file = vault.files.get('Taskdown/A/20260101_One.md')!;
        expect(await index.handleFileModify(asReal(file))).toBe(true);
        expect(index.size()).toBe(0);
    });

    it('handleFileRename moves the entry to the new path', async () => {
        const vault = makeVault({
            'Taskdown/A/20260101_One.md': taskContent('One', '2026-01-01'),
        });
        const index = new TaskIndex(vault.app, 'Taskdown', []);
        await index.initialize();

        const oldPath = 'Taskdown/A/20260101_One.md';
        const newPath = 'Taskdown/A/20260105_One.md';
        vault.contents[newPath] = taskContent('One', '2026-01-05');
        const renamed = new TFile(newPath);

        await index.handleFileRename(asReal(renamed), oldPath);

        expect(index.size()).toBe(1);
        expect(index.getTasks()[0].filePath).toBe(newPath);
    });

    it('handleFileDelete drops the entry; irrelevant paths are ignored', async () => {
        const vault = makeVault({
            'Taskdown/A/20260101_One.md': taskContent('One', '2026-01-01'),
        });
        const index = new TaskIndex(vault.app, 'Taskdown', []);
        await index.initialize();

        expect(index.handleFileDelete(asReal(new TFile('Elsewhere/20260101_One.md')))).toBe(false);
        expect(index.handleFileDelete(asReal(vault.files.get('Taskdown/A/20260101_One.md')!))).toBe(true);
        expect(index.size()).toBe(0);
    });
});
