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
    
    // Find the task for debug output
    const task = volatile.currentTasks?.find(t => t.id === resizeData.taskId);
    const taskName = task?.name || resizeData.taskId;
    
    // DEBUG 1: RESIZE STARTED
    console.log(`\n=== 1. RESIZE STARTED ===`);
    console.log(`📄 CARD: "${taskName}"`);
    console.log(`🎯 RESIZE TYPE: ${resizeData.resizeType} edge`);
    console.log(`📊 INITIAL COLUMN: ${resizeData.initialColumn}`);
    console.log(`📍 MOUSE POSITION: x=${resizeData.mousePosition.x}, y=${resizeData.mousePosition.y}`);
    console.log(`=========================\n`);
    
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
    
    // Only log if column actually changed to avoid spam
    const prevColumn = volatile.resizeState.targetColumn || resizeData.targetColumn;
    if (prevColumn !== resizeData.targetColumn) {
        console.log(`🔄 RESIZE MOVE: ${resizeData.resizeType} edge → column ${resizeData.targetColumn}`);
    }
    
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
    
    // Find the task for debug output
    const task = volatile.currentTasks?.find(t => t.id === resizeData.taskId);
    const taskName = task?.name || resizeData.taskId;
    
    // DEBUG 2: RESIZE ENDED
    console.log(`\n=== 2. RESIZE ENDED ===`);
    console.log(`📄 CARD: "${taskName}"`);
    console.log(`🎯 RESIZE TYPE: ${resizeData.resizeType} edge`);
    console.log(`📊 FROM COLUMN: ${resizeData.initialColumn}`);
    console.log(`📊 TO COLUMN: ${resizeData.targetColumn}`);
    console.log(`📍 FINAL MOUSE: x=${resizeData.mousePosition.x}, y=${resizeData.mousePosition.y}`);
    
    // Check if it's a meaningful resize
    const isSameColumn = resizeData.initialColumn === resizeData.targetColumn;
    const change = resizeData.targetColumn - resizeData.initialColumn;
    
    if (!isSameColumn) {
        console.log(`✅ SUCCESS: ${resizeData.resizeType} edge moved ${change > 0 ? '+' : ''}${change} columns`);
        console.log(`======================\n`);
        
        try {
            // Update the actual task file
            await updateTaskResize(app, persistent, volatile, resizeData);
        } catch (error) {
            console.error(`❌ FAILED to resize task "${taskName}":`, error);
            console.log(`======================\n`);
        }
    } else {
        console.log(`🚫 FAILURE: No change (same column)`);
        console.log(`======================\n`);
    }
    
    // Clear resize state
    newVolatile.resizeState = {
        isActive: false
    };
    
    return { persistent, volatile: newVolatile };
}