import { App } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState, IResizeOperation } from '../../interfaces/IAppState';
import { updateTaskResize } from './updateTaskResize';

export function updateResizeStart(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    resizeData: { taskId: string, resizeType: 'start' | 'end', initialColumn: number, mousePosition: { x: number, y: number } }
): IAppState {
    const newVolatile = { ...volatile };
    
    
    newVolatile.resizeState = {
        isActive: true,
        taskId: resizeData.taskId,
        resizeType: resizeData.resizeType,
        initialColumn: resizeData.initialColumn,
        targetColumn: resizeData.initialColumn
    };
    
    return { persistent, volatile: newVolatile };
}

export function updateResizeMove(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    resizeData: { taskId: string, resizeType: 'start' | 'end', targetColumn: number, mousePosition: { x: number, y: number } }
): IAppState {
    if (!volatile.resizeState?.isActive || volatile.resizeState.taskId !== resizeData.taskId) {
        return { persistent, volatile };
    }
    
    const newVolatile = { ...volatile };
    
    
    newVolatile.resizeState = {
        ...newVolatile.resizeState,
        targetColumn: resizeData.targetColumn
    };
    
    return { persistent, volatile: newVolatile };
}

export async function updateResizeEnd(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    resizeData: IResizeOperation
): Promise<IAppState> {
    if (!volatile.resizeState?.isActive || volatile.resizeState.taskId !== resizeData.taskId) {
        return { persistent, volatile };
    }
    
    const newVolatile = { ...volatile };
    
    
    // Check if it's a meaningful resize
    const isSameColumn = resizeData.initialColumn === resizeData.targetColumn;
    const change = resizeData.targetColumn - resizeData.initialColumn;
    
    if (!isSameColumn) {
        try {
            await updateTaskResize(app, persistent, volatile, resizeData);
        } catch (error) {
            // Resize failed, but we still clear the resize state
        }
    }
    
    // Clear resize state
    newVolatile.resizeState = {
        isActive: false
    };
    
    return { persistent, volatile: newVolatile };
}