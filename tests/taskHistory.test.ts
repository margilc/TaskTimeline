// Notice is constructed inside the orchestration helpers; applyTaskMutation is
// mocked so we can drive the inverse it returns and assert undo/redo routing.
jest.mock('obsidian', () => ({ Notice: jest.fn() }));
jest.mock('../src/core/update/applyTaskMutation', () => ({ applyTaskMutation: jest.fn() }));

import { TaskHistory, undoTaskMutation, redoTaskMutation } from '../src/core/update/taskHistory';
import { applyTaskMutation } from '../src/core/update/applyTaskMutation';

const mockApply = applyTaskMutation as jest.Mock;

const entry = (taskId: string, label = 'move') => ({ mutation: { taskId }, label });

beforeEach(() => {
    mockApply.mockReset();
});

describe('TaskHistory stack', () => {
    it('recordForward makes an entry undoable and clears any redo', () => {
        const h = new TaskHistory();
        h.pushRedo(entry('r'));
        expect(h.canRedo()).toBe(true);

        h.recordForward(entry('a'));
        expect(h.canUndo()).toBe(true);
        expect(h.canRedo()).toBe(false);
    });

    it('takeUndo / takeRedo are LIFO and drain to undefined', () => {
        const h = new TaskHistory();
        h.recordForward(entry('a'));
        h.recordForward(entry('b'));

        expect(h.takeUndo()?.mutation.taskId).toBe('b');
        expect(h.takeUndo()?.mutation.taskId).toBe('a');
        expect(h.takeUndo()).toBeUndefined();
    });

    it('clear empties both stacks', () => {
        const h = new TaskHistory();
        h.recordForward(entry('a'));
        h.pushRedo(entry('r'));

        h.clear();
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });

    it('caps the undo stack (drops the oldest entries)', () => {
        const h = new TaskHistory();
        for (let i = 0; i < 60; i++) h.recordForward(entry(`e${i}`));

        let count = 0;
        while (h.takeUndo()) count++;
        expect(count).toBe(50);
    });
});

describe('undo / redo orchestration', () => {
    const makeAsm = () => ({ taskHistory: new TaskHistory() } as any);

    it('undo applies the inverse and routes its result onto the redo stack', async () => {
        const asm = makeAsm();
        // Undo entry targets the post-move id; applying it yields the redo
        // inverse, which targets the reverted id.
        asm.taskHistory.recordForward(entry('newId', 'move'));
        mockApply.mockResolvedValue({ mutation: { taskId: 'oldId' }, label: 'move' });

        await undoTaskMutation({} as any, asm);

        expect(mockApply).toHaveBeenCalledWith({}, asm, { taskId: 'newId' });
        expect(asm.taskHistory.canUndo()).toBe(false);
        const redo = asm.taskHistory.takeRedo();
        expect(redo?.mutation.taskId).toBe('oldId');
        expect(redo?.label).toBe('move'); // original label survives the flip
    });

    it('redo applies and routes its result back onto the undo stack', async () => {
        const asm = makeAsm();
        asm.taskHistory.pushRedo(entry('oldId', 'move'));
        mockApply.mockResolvedValue({ mutation: { taskId: 'newId' }, label: 'move' });

        await redoTaskMutation({} as any, asm);

        expect(mockApply).toHaveBeenCalledWith({}, asm, { taskId: 'oldId' });
        expect(asm.taskHistory.canRedo()).toBe(false);
        expect(asm.taskHistory.takeUndo()?.mutation.taskId).toBe('newId');
    });

    it('undo with an empty stack does not call applyTaskMutation', async () => {
        const asm = makeAsm();
        await undoTaskMutation({} as any, asm);
        expect(mockApply).not.toHaveBeenCalled();
    });

    it('consumes the entry but adds no redo when the inverse cannot be applied', async () => {
        const asm = makeAsm();
        asm.taskHistory.recordForward(entry('gone', 'move'));
        mockApply.mockResolvedValue(null); // task no longer available

        await undoTaskMutation({} as any, asm);

        expect(asm.taskHistory.canUndo()).toBe(false);
        expect(asm.taskHistory.canRedo()).toBe(false);
    });
});
