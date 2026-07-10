import { App, Notice, TFile } from "obsidian";
import { ITask } from "../../interfaces/ITask";
import type { AppStateManager } from "../AppStateManager";
import { updateTaskFrontmatter } from "../utils/taskFileUtils";
import { canonicalizeFile } from "../utils/canonicalizeFile";
import { EMPTY_GROUP_LABELS } from "../utils/groupingUtils";
import { taskIdFromPath } from "../utils/taskUtils";

export interface TaskGroupAssignment {
    groupBy: string;
    value: string;
}

export interface TaskMutation {
    taskId: string;
    newStart?: string;
    newEnd?: string;
    newGroupValue?: TaskGroupAssignment;
}

/** Inverse mutation + human label needed to revert one applied change. */
export interface TaskHistoryEntry {
    mutation: TaskMutation;
    label: string;
}

interface TaskSnapshot {
    start: string;
    end: string;
    status: string;
    category: string;
    priority: number;
}

interface MutationPatch {
    start?: string;
    end?: string;
    status?: string;
    category?: string;
    priority?: number;
}

/** The in-memory patch and the frontmatter writes/deletes for one mutation,
 *  built together so the optimistic state and the file can never diverge. */
interface MutationChange {
    patch: MutationPatch;
    writes: Record<string, string | number | undefined>;
    deletes: string[];
}

function buildChange(mutation: TaskMutation): MutationChange {
    const patch: MutationPatch = {};
    const writes: Record<string, string | number | undefined> = {};
    const deletes: string[] = [];

    // `!== undefined`, not truthiness: newEnd === '' means "clear the end
    // date" (the undo of a resize on a task that had no end).
    if (mutation.newStart !== undefined) {
        patch.start = mutation.newStart;
        writes.start = mutation.newStart;
    }
    if (mutation.newEnd !== undefined) {
        patch.end = mutation.newEnd;
        if (mutation.newEnd === '') deletes.push('end');
        else writes.end = mutation.newEnd;
    }

    if (mutation.newGroupValue) {
        const { groupBy, value } = mutation.newGroupValue;
        if (groupBy === 'status' || groupBy === 'category') {
            if (value === EMPTY_GROUP_LABELS[groupBy]) {
                patch[groupBy] = '';
                deletes.push(groupBy);
            } else {
                patch[groupBy] = value;
                writes[groupBy] = value;
            }
        } else if (groupBy === 'priority') {
            if (value === EMPTY_GROUP_LABELS.priority) {
                // No patch field: the parser re-derives the default priority
                // once the frontmatter key is deleted.
                deletes.push('priority');
            } else {
                const n = parseInt(value, 10);
                if (!Number.isNaN(n)) {
                    patch.priority = n;
                    writes.priority = n;
                }
            }
        }
    }

    return { patch, writes, deletes };
}

function groupValueFromSnapshot(groupBy: string, prev: TaskSnapshot): string {
    if (groupBy === 'status') return prev.status ? prev.status : EMPTY_GROUP_LABELS.status;
    if (groupBy === 'category') return prev.category ? prev.category : EMPTY_GROUP_LABELS.category;
    if (groupBy === 'priority') return prev.priority ? String(prev.priority) : EMPTY_GROUP_LABELS.priority;
    return '';
}

/**
 * Build the mutation that reverts `forward`, restoring the pre-change values
 * from `prev`. Targeted at `taskId` — the file's id AFTER `forward` settled,
 * which differs from the original when a start-date change renamed the file.
 */
function buildInverseMutation(forward: TaskMutation, prev: TaskSnapshot, taskId: string): TaskMutation {
    const inverse: TaskMutation = { taskId };
    if (forward.newStart !== undefined) inverse.newStart = prev.start;
    if (forward.newEnd !== undefined) inverse.newEnd = prev.end;
    if (forward.newGroupValue) {
        inverse.newGroupValue = {
            groupBy: forward.newGroupValue.groupBy,
            value: groupValueFromSnapshot(forward.newGroupValue.groupBy, prev),
        };
    }
    return inverse;
}

function describeMutation(m: TaskMutation): string {
    if (m.newGroupValue && m.newStart === undefined && m.newEnd === undefined) {
        return `${m.newGroupValue.groupBy} change`;
    }
    if (m.newStart !== undefined && m.newEnd !== undefined) return 'move';
    if (m.newStart !== undefined || m.newEnd !== undefined) return 'resize';
    return 'change';
}

export async function applyTaskMutation(
    app: App,
    appStateManager: AppStateManager,
    mutation: TaskMutation
): Promise<TaskHistoryEntry | null> {
    const tasks = appStateManager.getVolatileState().currentTasks || [];
    const task = tasks.find((t: ITask) => t.id === mutation.taskId);
    if (!task) return null;

    const prev: TaskSnapshot = {
        start: task.start,
        end: task.end,
        status: task.status,
        category: task.category,
        priority: task.priority,
    };

    const { patch, writes, deletes } = buildChange(mutation);

    // Detect no-op (same dates and same group value)
    const willChange =
        (patch.start !== undefined && patch.start !== prev.start) ||
        (patch.end !== undefined && patch.end !== prev.end) ||
        (patch.status !== undefined && patch.status !== prev.status) ||
        (patch.category !== undefined && patch.category !== prev.category) ||
        (patch.priority !== undefined && patch.priority !== prev.priority) ||
        (mutation.newGroupValue?.groupBy === 'priority' && mutation.newGroupValue.value === EMPTY_GROUP_LABELS.priority && prev.priority !== 0) ||
        (mutation.newGroupValue?.groupBy === 'status' && mutation.newGroupValue.value === EMPTY_GROUP_LABELS.status && prev.status !== '') ||
        (mutation.newGroupValue?.groupBy === 'category' && mutation.newGroupValue.value === EMPTY_GROUP_LABELS.category && prev.category !== '');

    if (!willChange) return null;

    appStateManager.applyOptimisticTaskUpdate(mutation.taskId, patch as Partial<ITask>);

    const startChanged = mutation.newStart !== undefined && mutation.newStart !== prev.start;
    const oldPath = task.filePath;

    // A start-date change renames the file to a new YYYYMMDD_<id>.md, which
    // changes the task's id. Track where it lands so the undo entry can target
    // the file's final id and re-locate the task after the rename settles.
    let finalPath = oldPath;
    let succeeded = true;

    // Mark OLD before any write so the synchronous modify-event handler sees
    // the marker and defers. Mark every rename candidate canonicalize tries
    // via the onWillRename callback. The finally unmarks all collected paths.
    const markedPaths = new Set<string>([oldPath]);
    appStateManager.markMutationStart(oldPath);
    try {
        await appStateManager.withFileLock(oldPath, async () => {
            await updateTaskFrontmatter(app, oldPath, writes, deletes);
            if (startChanged) {
                const file = app.vault.getAbstractFileByPath(oldPath);
                if (file instanceof TFile) {
                    const renamed = await canonicalizeFile(app, file, (predictedNewPath) => {
                        if (!markedPaths.has(predictedNewPath)) {
                            markedPaths.add(predictedNewPath);
                            appStateManager.markMutationStart(predictedNewPath);
                        }
                    });
                    finalPath = renamed.path;
                }
            }
        });
    } catch (err) {
        console.error('TaskTimeline: drag/resize write failed; re-syncing from disk', err);
        await appStateManager.resyncFileFromDisk(oldPath);
        new Notice('Failed to update task — refreshed from disk.');
        succeeded = false;
    } finally {
        for (const p of markedPaths) {
            appStateManager.markMutationEnd(p);
        }
    }

    if (!succeeded) return null;

    return {
        mutation: buildInverseMutation(mutation, prev, taskIdFromPath(finalPath)),
        label: describeMutation(mutation),
    };
}
