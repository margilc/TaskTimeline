import { App } from 'obsidian';
import { IAppState, IPersistentState, IVolatileState, IDragOperation } from '../../interfaces/IAppState';
import { updateTaskPosition } from './updateTaskPosition';
import { getGroupValue } from '../utils/groupingUtils';

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
    
    const taskWithGroup = findTaskWithGroup(dragData.taskId, volatile);
    if (!taskWithGroup) {
        return { persistent, volatile };
    }
    
    const { task: positionedTask } = taskWithGroup;
    const originalTask = volatile.currentTasks?.find(t => t.id === dragData.taskId);
    const boardGrouping = persistent.boardGrouping;
    const groupBy = boardGrouping?.groupBy || 'status';
    
    if (!originalTask) {
        return { persistent, volatile };
    }
    
    const actualGroupName = getGroupValue(originalTask, groupBy);
    
    const sourcePosition = {
        column: positionedTask.xStart || 1,
        row: positionedTask.y || 0,
        group: actualGroupName
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
    
    const taskWithGroup = findTaskWithGroup(dragData.taskId, volatile);
    if (!taskWithGroup) {
        newVolatile.dragState = { isActive: false };
        return { persistent, volatile: newVolatile };
    }
    
    const { task: positionedTask } = taskWithGroup;
    const originalTask = volatile.currentTasks?.find(t => t.id === dragData.taskId);
    const boardGrouping = persistent.boardGrouping;
    const groupBy = boardGrouping?.groupBy || 'status';
    
    if (!originalTask) {
        newVolatile.dragState = { isActive: false };
        return { persistent, volatile: newVolatile };
    }
    
    const actualSourceGroupName = getGroupValue(originalTask, groupBy);
    
    const sourcePosition = {
        column: positionedTask.xStart || 1,
        row: positionedTask.y || 0,
        group: actualSourceGroupName
    };
    
    const targetGroupName = calculateTargetGroup(dragData.mousePosition.x, dragData.mousePosition.y, volatile);
    
    if (!targetGroupName) {
        newVolatile.dragState = { isActive: false };
        return { persistent, volatile: newVolatile };
    }
    
    const targetPosition = {
        column: sourcePosition.column,
        row: calculateTargetRow(dragData.mousePosition.y, targetGroupName, volatile),
        group: targetGroupName
    };
    
    if (sourcePosition.group !== targetPosition.group) {
        try {
            const fullDragOperation: IDragOperation = {
                taskId: dragData.taskId,
                sourcePosition,
                targetPosition,
                mousePosition: dragData.mousePosition
            };
            
            await updateTaskPosition(app, persistent, volatile, fullDragOperation);
        } catch (error) {
            // Task position update failed, but we still clear drag state
        }
    }
    
    // Clear drag state
    newVolatile.dragState = {
        isActive: false
    };
    
    return { persistent, volatile: newVolatile };
}

function calculateTargetGroup(mouseX: number, mouseY: number, volatile: IVolatileState): string | null {
    const taskGroups = document.querySelectorAll('.board-task-group');
    
    if (taskGroups.length === 0) {
        return null;
    }
    
    const groupNames: string[] = [];
    taskGroups.forEach((groupElement, i) => {
        const header = groupElement.querySelector('.group-header span');
        const groupName = header?.textContent || `Group ${i}`;
        groupNames.push(groupName);
    });
    
    for (let i = 0; i < taskGroups.length; i++) {
        const groupElement = taskGroups[i] as HTMLElement;
        const rect = groupElement.getBoundingClientRect();
        
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
            return groupNames[i];
        }
    }
    
    return null;
}

function calculateTargetRow(mouseY: number, targetGroupName: string, volatile: IVolatileState): number {
    if (!volatile.boardLayout?.taskGrids) {
        return 0;
    }
    
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
    
    const relativeY = Math.max(0, mouseY - groupRect.top - groupHeaderHeight);
    const estimatedRowHeight = 80;
    const targetRow = Math.floor(relativeY / estimatedRowHeight);
    
    return Math.max(0, targetRow);
}