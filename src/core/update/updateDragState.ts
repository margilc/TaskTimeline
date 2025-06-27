import { App } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState, IDragOperation } from '../../interfaces/IAppState';
import { updateTaskPosition } from './updateTaskPosition';
import { getGroupValue } from '../utils/groupingUtils';

function findPositionedTask(taskId: string, volatile: IVolatileState): any | null {
    if (!volatile.boardLayout?.taskGrids) {
        return null;
    }
    
    for (const taskGrid of volatile.boardLayout.taskGrids) {
        const task = taskGrid.tasks.find(t => t.id === taskId);
        if (task) {
            return task;
        }
    }
    return null;
}

function findTaskWithGroup(taskId: string, volatile: IVolatileState): { task: any, groupName: string } | null {
    if (!volatile.boardLayout?.taskGrids) {
        return null;
    }
    
    for (const taskGrid of volatile.boardLayout.taskGrids) {
        const task = taskGrid.tasks.find(t => t.id === taskId);
        if (task) {
            return { task, groupName: taskGrid.group };
        }
    }
    return null;
}

export function updateDragStart(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    dragData: { taskId: string, initialPosition: { x: number, y: number } }
): IAppState {
    const newVolatile = { ...volatile };
    
    // Find the positioned task and its current group from the board layout
    const taskWithGroup = findTaskWithGroup(dragData.taskId, volatile);
    if (!taskWithGroup) {
        console.error(`Drag start: Task ${dragData.taskId} not found in board layout`);
        return { persistent, volatile };
    }
    
    const { task: positionedTask, groupName: boardLayoutGroupName } = taskWithGroup;
    
    // Get the actual current group from the task data (source of truth)
    const originalTask = volatile.currentTasks?.find(t => t.id === dragData.taskId);
    const boardGrouping = persistent.boardGrouping;
    const groupBy = boardGrouping?.groupBy || 'status';
    const actualGroupName = originalTask ? getGroupValue(originalTask, groupBy) : 'unknown';
    
    // DEBUG 1: CARD PICKED - based on the card itself
    console.log(`\n=== 1. CARD PICKED ===`);
    console.log(`📄 CARD: "${positionedTask.name}"`);
    console.log(`🏷️  ${groupBy} field: "${originalTask?.[groupBy] || 'undefined'}"`);
    console.log(`📍 INFERRED GROUP: "${actualGroupName}"`);
    console.log(`📊 COLUMN: ${positionedTask.xStart || 1}${positionedTask.xEnd ? `-${positionedTask.xEnd}` : ''}`);
    console.log(`📋 ROW: ${positionedTask.y || 0}`);
    console.log(`======================\n`);
    
    // Use the actual task data as source of truth, not the board layout position
    const sourcePosition = {
        column: positionedTask.xStart || 1,
        row: positionedTask.y || 0,
        group: actualGroupName  // Use actual data, not board layout
    };
    
    newVolatile.dragState = {
        isActive: true,
        taskId: dragData.taskId,
        initialPosition: dragData.initialPosition,
        currentPosition: dragData.initialPosition,
        targetGrid: sourcePosition
    };
    
    return { persistent, volatile: newVolatile };
}

export function updateDragMove(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    dragData: { taskId: string, mousePosition: { x: number, y: number } }
): IAppState {
    if (!volatile.dragState?.isActive || volatile.dragState.taskId !== dragData.taskId) {
        return { persistent, volatile };
    }
    
    const newVolatile = { ...volatile };
    newVolatile.dragState = {
        ...newVolatile.dragState,
        currentPosition: dragData.mousePosition
    };
    
    // Just track the mouse position - visual feedback handled by UI
    return { persistent, volatile: newVolatile };
}

export async function updateDragEnd(
    app: App,
    persistent: IPersistentState,
    volatile: IVolatileState,
    dragData: { taskId: string, mousePosition: { x: number, y: number } }
): Promise<IAppState> {
    if (!volatile.dragState?.isActive || volatile.dragState.taskId !== dragData.taskId) {
        return { persistent, volatile };
    }
    
    const newVolatile = { ...volatile };
    
    // Find the positioned task and its current group from the board layout
    const taskWithGroup = findTaskWithGroup(dragData.taskId, volatile);
    if (!taskWithGroup) {
        console.error(`Drag end: Task ${dragData.taskId} not found in board layout`);
        newVolatile.dragState = { isActive: false };
        return { persistent, volatile: newVolatile };
    }
    
    const { task: positionedTask, groupName: boardLayoutGroupName } = taskWithGroup;
    
    // Get the actual current group from the task data (source of truth)
    const originalTask = volatile.currentTasks?.find(t => t.id === dragData.taskId);
    const boardGrouping = persistent.boardGrouping;
    const groupBy = boardGrouping?.groupBy || 'status';
    const actualSourceGroupName = originalTask ? getGroupValue(originalTask, groupBy) : 'unknown';
    
    const sourcePosition = {
        column: positionedTask.xStart || 1,
        row: positionedTask.y || 0,
        group: actualSourceGroupName  // Use actual data, not board layout
    };
    
    // Calculate target group from mouse position using board layout data
    const targetGroupName = calculateTargetGroup(dragData.mousePosition.x, dragData.mousePosition.y, volatile);
    
    if (!targetGroupName) {
        console.log(`🚫 CANCELED: Drop outside valid area`);
        newVolatile.dragState = { isActive: false };
        return { persistent, volatile: newVolatile };
    }
    
    // For row-only dragging, preserve the original column, calculate target row
    const targetPosition = {
        column: sourcePosition.column, // Always preserve column
        row: calculateTargetRow(dragData.mousePosition.y, targetGroupName, volatile),
        group: targetGroupName
    };
    
    // DEBUG 2: CARD DROPPED - based on drop position
    console.log(`\n=== 2. CARD DROPPED ===`);
    console.log(`📄 CARD: "${positionedTask.name}"`);
    console.log(`📍 DROP POSITION: x=${dragData.mousePosition.x}, y=${dragData.mousePosition.y}`);
    console.log(`🎯 INFERRED TARGET GROUP: "${targetGroupName}"`);
    console.log(`📊 COLUMN: ${targetPosition.column} (preserved)`);
    console.log(`📋 ROW: ${targetPosition.row}`);
    console.log(`🔄 FROM: "${sourcePosition.group}" TO: "${targetPosition.group}"`);
    
    // Check if it's a meaningful move (only check group since we preserve column)
    const isSamePosition = sourcePosition.group === targetPosition.group;
    
    if (!isSamePosition) {
        console.log(`✅ SUCCESS: Moving from "${sourcePosition.group}" to "${targetPosition.group}"`);
        console.log(`======================\n`);
        
        try {
            // Create the full drag operation for updateTaskPosition
            const fullDragOperation: IDragOperation = {
                taskId: dragData.taskId,
                sourcePosition,
                targetPosition,
                mousePosition: dragData.mousePosition
            };
            
            // Update the actual task file
            await updateTaskPosition(app, persistent, volatile, fullDragOperation);
        } catch (error) {
            console.error(`❌ FAILED to move task "${positionedTask.name}":`, error);
            console.log(`======================\n`);
        }
    } else {
        console.log(`🚫 FAILURE: Same group (no change needed)`);
        console.log(`======================\n`);
    }
    
    // Clear drag state
    newVolatile.dragState = {
        isActive: false
    };
    
    return { persistent, volatile: newVolatile };
}

// Robust target group calculation using mouse position and DOM structure
function calculateTargetGroup(mouseX: number, mouseY: number, volatile: IVolatileState): string | null {
    if (!volatile.boardLayout?.taskGrids) {
        return null;
    }
    
    // Get all group elements from DOM and match with data
    const taskGroups = document.querySelectorAll('.board-task-group');
    const availableGroups = volatile.boardLayout.taskGrids.map(grid => grid.group);
    
    for (let i = 0; i < taskGroups.length; i++) {
        const groupElement = taskGroups[i] as HTMLElement;
        const rect = groupElement.getBoundingClientRect();
        
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
            // Use the group from our data that corresponds to this DOM element
            return availableGroups[i] || null;
        }
    }
    
    return null;
}

// Calculate target row within a specific group
function calculateTargetRow(mouseY: number, targetGroupName: string, volatile: IVolatileState): number {
    if (!volatile.boardLayout?.taskGrids) {
        return 0;
    }
    
    // Find the group index to locate the corresponding DOM element
    const groupIndex = volatile.boardLayout.taskGrids.findIndex(grid => grid.group === targetGroupName);
    if (groupIndex === -1) {
        return 0;
    }
    
    const taskGroups = document.querySelectorAll('.board-task-group');
    const groupElement = taskGroups[groupIndex] as HTMLElement;
    
    if (!groupElement) {
        return 0;
    }
    
    const groupRect = groupElement.getBoundingClientRect();
    const groupHeader = groupElement.querySelector('.group-header') as HTMLElement;
    const groupHeaderHeight = groupHeader?.getBoundingClientRect().height || 40;
    
    // Calculate row within group
    const relativeY = Math.max(0, mouseY - groupRect.top - groupHeaderHeight);
    const estimatedRowHeight = 80; // This could be made dynamic based on actual task heights
    const targetRow = Math.floor(relativeY / estimatedRowHeight);
    
    return Math.max(0, targetRow);
}