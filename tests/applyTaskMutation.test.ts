import { applyTaskMutation } from '../src/core/update/applyTaskMutation';

// Mock the obsidian module. We provide a constructor for TFile so
// `instanceof TFile` checks in applyTaskMutation work against our fake files.
jest.mock('obsidian', () => {
    class FakeTFile {
        path: string;
        constructor(path: string) { this.path = path; }
    }
    return {
        Notice: jest.fn().mockImplementation((msg: string) => ({ msg })),
        TFile: FakeTFile,
    };
});

import { TFile as FakeTFileImport } from 'obsidian';
const FakeTFile = FakeTFileImport as unknown as new (path: string) => { path: string };

// Mock the frontmatter helper and the new canonicalize utility.
jest.mock('../src/core/utils/frontmatterUtils', () => ({
    updateTaskFrontmatter: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/core/utils/canonicalizeFile', () => ({
    canonicalizeFile: jest.fn().mockResolvedValue(undefined),
}));

import { updateTaskFrontmatter } from '../src/core/utils/frontmatterUtils';
import { canonicalizeFile } from '../src/core/utils/canonicalizeFile';

const mockUpdateFm = updateTaskFrontmatter as jest.Mock;
const mockCanonicalize = canonicalizeFile as jest.Mock;

function makeApp(filesByPath: Record<string, any> = {}) {
    return {
        vault: {
            getAbstractFileByPath: jest.fn((p: string) => filesByPath[p] ?? null),
        },
    } as any;
}

function makeAppStateManager(task: any) {
    // withFileLock just runs fn() immediately for unit tests.
    const withFileLock = jest.fn(async (_filePath: string, fn: () => Promise<any>) => fn());
    return {
        getVolatileState: () => ({ currentTasks: [task] }),
        applyOptimisticTaskUpdate: jest.fn(),
        resyncFileFromDisk: jest.fn().mockResolvedValue(undefined),
        withFileLock,
        markMutationStart: jest.fn(),
        markMutationEnd: jest.fn(),
        isMutationInProgress: jest.fn().mockReturnValue(false),
    } as any;
}

const makeTask = (overrides: any = {}) => ({
    id: 't1',
    name: 'Task',
    start: '2026-01-10',
    end: '2026-01-12',
    category: 'Dev',
    status: 'To Do',
    filePath: 'Taskdown/Project/20260110_task.md',
    content: '',
    priority: 3,
    totalSubtasks: 0,
    completedSubtasks: 0,
    ...overrides,
});

beforeEach(() => {
    mockUpdateFm.mockClear();
    mockCanonicalize.mockClear();
    mockUpdateFm.mockResolvedValue(undefined);
    // canonicalizeFile resolves to the (possibly renamed) TFile. The default
    // mock doesn't rename, so it returns the file it was handed.
    mockCanonicalize.mockImplementation(async (_app: any, file: any) => file);
});

describe('applyTaskMutation - horizontal drag', () => {
    it('writes new start and end, canonicalizes file when start changed', async () => {
        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(asm.applyOptimisticTaskUpdate).toHaveBeenCalledWith('t1', {
            start: '2026-02-01', end: '2026-02-03',
        });
        expect(asm.withFileLock).toHaveBeenCalledWith(task.filePath, expect.any(Function));
        expect(mockUpdateFm).toHaveBeenCalledWith(
            app,
            task.filePath,
            { start: '2026-02-01', end: '2026-02-03' },
            []
        );
        expect(mockCanonicalize).toHaveBeenCalledWith(app, fakeFile, expect.any(Function));
    });

    it('does not canonicalize when start is unchanged (end-only update)', async () => {
        const task = makeTask();
        const app = makeApp();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, { taskId: 't1', newEnd: '2026-01-15' });

        expect(mockUpdateFm).toHaveBeenCalledWith(
            app, task.filePath, { end: '2026-01-15' }, []
        );
        expect(mockCanonicalize).not.toHaveBeenCalled();
    });
});

describe('applyTaskMutation - grouping changes', () => {
    it('writes status field for status grouping', async () => {
        const task = makeTask();
        const app = makeApp();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newGroupValue: { groupBy: 'status', value: 'Done' },
        });

        expect(mockUpdateFm).toHaveBeenCalledWith(
            app, task.filePath, { status: 'Done' }, []
        );
        expect(mockCanonicalize).not.toHaveBeenCalled();
    });

    it('writes priority as a number for priority grouping', async () => {
        const task = makeTask();
        const app = makeApp();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newGroupValue: { groupBy: 'priority', value: '5' },
        });

        expect(mockUpdateFm).toHaveBeenCalledWith(
            app, task.filePath, { priority: 5 }, []
        );
    });

    it('deletes priority key on "No Priority"', async () => {
        const task = makeTask();
        const app = makeApp();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newGroupValue: { groupBy: 'priority', value: 'No Priority' },
        });

        expect(mockUpdateFm).toHaveBeenCalledWith(
            app, task.filePath, {}, ['priority']
        );
    });

    it('deletes status key on "No Status"', async () => {
        const task = makeTask();
        const app = makeApp();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newGroupValue: { groupBy: 'status', value: 'No Status' },
        });

        expect(mockUpdateFm).toHaveBeenCalledWith(
            app, task.filePath, {}, ['status']
        );
    });
});

describe('applyTaskMutation - no-op detection', () => {
    it('returns without writing if nothing changed', async () => {
        const task = makeTask();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(makeApp(), asm, {
            taskId: 't1',
            newStart: task.start,
            newEnd: task.end,
        });

        expect(mockUpdateFm).not.toHaveBeenCalled();
        expect(asm.applyOptimisticTaskUpdate).not.toHaveBeenCalled();
        expect(asm.withFileLock).not.toHaveBeenCalled();
    });

    it('returns when same-group drop is sent', async () => {
        const task = makeTask({ status: 'Done' });
        const asm = makeAppStateManager(task);

        await applyTaskMutation(makeApp(), asm, {
            taskId: 't1',
            newGroupValue: { groupBy: 'status', value: 'Done' },
        });

        expect(mockUpdateFm).not.toHaveBeenCalled();
    });
});

describe('applyTaskMutation - resync on failure', () => {
    it('re-syncs file from disk when frontmatter write throws', async () => {
        mockUpdateFm.mockRejectedValueOnce(new Error('disk error'));

        const task = makeTask();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(makeApp(), asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(asm.applyOptimisticTaskUpdate).toHaveBeenCalled();
        expect(asm.resyncFileFromDisk).toHaveBeenCalledWith(task.filePath);
    });

    it('re-syncs when canonicalize fails (avoids phantom OLD-path entry in index)', async () => {
        mockCanonicalize.mockRejectedValueOnce(new Error('rename collision'));

        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(asm.resyncFileFromDisk).toHaveBeenCalledWith(task.filePath);
    });
});

describe('applyTaskMutation - missing task', () => {
    it('returns silently when task id is not in state', async () => {
        const asm = makeAppStateManager(makeTask());
        await applyTaskMutation(makeApp(), asm, { taskId: 'unknown' });
        expect(mockUpdateFm).not.toHaveBeenCalled();
        expect(asm.applyOptimisticTaskUpdate).not.toHaveBeenCalled();
    });
});

describe('applyTaskMutation - lock ordering', () => {
    it('runs frontmatter write and canonicalize inside withFileLock', async () => {
        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        const callOrder: string[] = [];
        asm.withFileLock = jest.fn(async (_p: string, fn: () => Promise<any>) => {
            callOrder.push('lock-enter');
            const r = await fn();
            callOrder.push('lock-exit');
            return r;
        });
        mockUpdateFm.mockImplementation(async () => { callOrder.push('write'); });
        mockCanonicalize.mockImplementation(async (_app: any, file: any) => { callOrder.push('canonicalize'); return file; });

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(callOrder).toEqual(['lock-enter', 'write', 'canonicalize', 'lock-exit']);
    });
});

describe('applyTaskMutation - mutation tracking lifecycle', () => {
    it('marks OLD path before write and unmarks in finally (happy path)', async () => {
        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        const callOrder: string[] = [];
        asm.markMutationStart = jest.fn((p: string) => callOrder.push(`start:${p}`));
        asm.markMutationEnd = jest.fn((p: string) => callOrder.push(`end:${p}`));
        mockUpdateFm.mockImplementation(async () => { callOrder.push('write'); });

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(callOrder[0]).toBe(`start:${task.filePath}`);
        expect(callOrder).toContain('write');
        expect(callOrder[callOrder.length - 1]).toBe(`end:${task.filePath}`);
    });

    it('marks the predicted NEW path via canonicalize onWillRename callback', async () => {
        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        const predictedNew = 'Taskdown/Project/20260201_task.md';
        mockCanonicalize.mockImplementation(
            async (_app: any, _file: any, onWillRename?: (p: string) => void) => {
                onWillRename?.(predictedNew);
                return new FakeTFile(predictedNew);
            },
        );

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(asm.markMutationStart).toHaveBeenCalledWith(task.filePath);
        expect(asm.markMutationStart).toHaveBeenCalledWith(predictedNew);
        expect(asm.markMutationEnd).toHaveBeenCalledWith(task.filePath);
        expect(asm.markMutationEnd).toHaveBeenCalledWith(predictedNew);
    });

    it('unmarks all registered paths even when canonicalize throws', async () => {
        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        const predictedNew = 'Taskdown/Project/20260201_task.md';
        mockCanonicalize.mockImplementation(
            async (_app: any, _file: any, onWillRename?: (p: string) => void) => {
                onWillRename?.(predictedNew);
                throw new Error('rename collision');
            },
        );

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        expect(asm.markMutationEnd).toHaveBeenCalledWith(task.filePath);
        expect(asm.markMutationEnd).toHaveBeenCalledWith(predictedNew);
    });

    it('deduplicates if canonicalize tries the same predicted path twice (retries)', async () => {
        const task = makeTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);

        const same = 'Taskdown/Project/20260201_task.md';
        mockCanonicalize.mockImplementation(
            async (_app: any, _file: any, onWillRename?: (p: string) => void) => {
                onWillRename?.(same);
                onWillRename?.(same);
                return new FakeTFile(same);
            },
        );

        await applyTaskMutation(app, asm, {
            taskId: 't1',
            newStart: '2026-02-01',
            newEnd: '2026-02-03',
        });

        const startCalls = (asm.markMutationStart as jest.Mock).mock.calls.map((c: any[]) => c[0]);
        const samePathStarts = startCalls.filter((p: string) => p === same);
        expect(samePathStarts.length).toBe(1);
    });

    it('does not mark paths on no-op (no change)', async () => {
        const task = makeTask();
        const asm = makeAppStateManager(task);

        await applyTaskMutation(makeApp(), asm, {
            taskId: 't1',
            newStart: task.start,
            newEnd: task.end,
        });

        expect(asm.markMutationStart).not.toHaveBeenCalled();
        expect(asm.markMutationEnd).not.toHaveBeenCalled();
    });
});

describe('applyTaskMutation - inverse entry for undo', () => {
    // In production a task's id IS its filename without extension, so use a
    // realistic id that matches filePath (the inverse targets the file's id).
    const realTask = (overrides: any = {}) => makeTask({
        id: '20260110_task',
        filePath: 'Taskdown/Project/20260110_task.md',
        ...overrides,
    });

    it('returns null on a no-op mutation', async () => {
        const task = realTask();
        const asm = makeAppStateManager(task);
        const result = await applyTaskMutation(makeApp(), asm, {
            taskId: '20260110_task', newStart: task.start, newEnd: task.end,
        });
        expect(result).toBeNull();
    });

    it('returns null when the frontmatter write fails', async () => {
        mockUpdateFm.mockRejectedValueOnce(new Error('disk error'));
        const task = realTask();
        const asm = makeAppStateManager(task);
        const result = await applyTaskMutation(makeApp(), asm, {
            taskId: '20260110_task', newStart: '2026-02-01',
        });
        expect(result).toBeNull();
    });

    it('move: inverse restores old dates and targets the renamed id', async () => {
        const task = realTask();
        const fakeFile = new FakeTFile(task.filePath);
        const app = makeApp({ [task.filePath]: fakeFile });
        const asm = makeAppStateManager(task);
        // A start change renames the file; canonicalize reports the new path.
        const newPath = 'Taskdown/Project/20260201_task.md';
        mockCanonicalize.mockImplementation(async () => new FakeTFile(newPath));

        const result = await applyTaskMutation(app, asm, {
            taskId: '20260110_task', newStart: '2026-02-01', newEnd: '2026-02-03',
        });

        expect(result).toEqual({
            mutation: {
                taskId: '20260201_task',
                newStart: '2026-01-10',
                newEnd: '2026-01-12',
            },
            label: 'move',
        });
    });

    it('status change: inverse restores old status, same id (no rename)', async () => {
        const task = realTask({ status: 'To Do' });
        const asm = makeAppStateManager(task);

        const result = await applyTaskMutation(makeApp(), asm, {
            taskId: '20260110_task',
            newGroupValue: { groupBy: 'status', value: 'Done' },
        });

        expect(result).toEqual({
            mutation: {
                taskId: '20260110_task',
                newGroupValue: { groupBy: 'status', value: 'To Do' },
            },
            label: 'status change',
        });
    });

    it('priority set: inverse restores "No Priority" when prev had none', async () => {
        const task = realTask({ priority: 0 });
        const asm = makeAppStateManager(task);

        const result = await applyTaskMutation(makeApp(), asm, {
            taskId: '20260110_task',
            newGroupValue: { groupBy: 'priority', value: '5' },
        });

        expect(result).toEqual({
            mutation: {
                taskId: '20260110_task',
                newGroupValue: { groupBy: 'priority', value: 'No Priority' },
            },
            label: 'priority change',
        });
    });
});
