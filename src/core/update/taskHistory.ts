import { App, Notice } from "obsidian";
import type { AppStateManager } from "../AppStateManager";
import { applyTaskMutation, TaskHistoryEntry } from "./applyTaskMutation";

const MAX_HISTORY = 50;

/**
 * Undo/redo stacks for drag/resize/move mutations. Each entry holds the
 * inverse mutation needed to revert one applied change. Entries are produced
 * by applyTaskMutation (which targets the file's post-mutation id, so an undo
 * still finds the task after a start-date rename) and routed here.
 *
 * Pure data — orchestration (applying the inverse, re-routing the resulting
 * inverse to the opposite stack) lives in undoTaskMutation/redoTaskMutation
 * to keep AppStateManager free of update-logic imports.
 */
export class TaskHistory {
    private undoStack: TaskHistoryEntry[] = [];
    private redoStack: TaskHistoryEntry[] = [];

    /** A fresh user action: undoable, and it invalidates any pending redo. */
    public recordForward(entry: TaskHistoryEntry): void {
        this.undoStack.push(entry);
        if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
        this.redoStack = [];
    }

    public takeUndo(): TaskHistoryEntry | undefined {
        return this.undoStack.pop();
    }

    public takeRedo(): TaskHistoryEntry | undefined {
        return this.redoStack.pop();
    }

    public pushRedo(entry: TaskHistoryEntry): void {
        this.redoStack.push(entry);
        if (this.redoStack.length > MAX_HISTORY) this.redoStack.shift();
    }

    public pushUndo(entry: TaskHistoryEntry): void {
        this.undoStack.push(entry);
        if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    }

    public canUndo(): boolean { return this.undoStack.length > 0; }
    public canRedo(): boolean { return this.redoStack.length > 0; }

    public clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}

export async function undoTaskMutation(app: App, appStateManager: AppStateManager): Promise<void> {
    const history = appStateManager.taskHistory;
    const entry = history.takeUndo();
    if (!entry) {
        new Notice("Nothing to undo");
        return;
    }

    const inverse = await applyTaskMutation(app, appStateManager, entry.mutation);
    if (inverse) {
        // Applying the inverse produced the inverse-of-the-inverse: that is how
        // to redo the action we just undid. Keep the original label across flips.
        history.pushRedo({ mutation: inverse.mutation, label: entry.label });
        new Notice(`Undid ${entry.label}`);
    } else {
        new Notice(`Can't undo ${entry.label} — task no longer available`);
    }
}

export async function redoTaskMutation(app: App, appStateManager: AppStateManager): Promise<void> {
    const history = appStateManager.taskHistory;
    const entry = history.takeRedo();
    if (!entry) {
        new Notice("Nothing to redo");
        return;
    }

    const inverse = await applyTaskMutation(app, appStateManager, entry.mutation);
    if (inverse) {
        history.pushUndo({ mutation: inverse.mutation, label: entry.label });
        new Notice(`Redid ${entry.label}`);
    } else {
        new Notice(`Can't redo ${entry.label} — task no longer available`);
    }
}
