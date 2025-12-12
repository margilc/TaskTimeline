
import { App } from "obsidian";
import { BoardTaskCard } from "./BoardTaskCard";
import { ITaskTimelineSettings } from "../../interfaces/ITaskTimelineSettings";
import { AppStateManager } from "../../core/AppStateManager";
import { ITask } from "../../interfaces/ITask";
import { TaskCreationHelper } from "../../utils/taskCreationHelper";
import { PluginEvent } from "../../enums/events";

export function BoardTaskGroup(
	groupName: string,
	tasks: ITask[],
	gridConfig: {
		gridWidth: number;
		gridHeight: number;
		columnWidth?: number;
		rowHeight?: number;
	},
	settings: ITaskTimelineSettings,
	appStateManager: AppStateManager,
	app: App,
	isDebugMode = false,
	sharedTooltip: HTMLElement
): HTMLElement {
	const container = document.createElement("div");
	container.className = isDebugMode
		? "debug-board-task-group"
		: "board-task-group";

	const columnWidth = gridConfig.columnWidth || 100;

	let maxOccupiedRow = 0; 
	tasks.forEach((task) => {
		const startY = (task.y ?? 0) + 1;
		maxOccupiedRow = Math.max(maxOccupiedRow, startY);
	});
	const actualGridHeight = Math.max(1, maxOccupiedRow);

	container.style.display = "grid";
	container.style.gridTemplateColumns = `${columnWidth}px repeat(${gridConfig.gridWidth}, ${columnWidth}px)`;

	if (gridConfig.rowHeight) {
		container.style.gridTemplateRows = `repeat(${actualGridHeight}, ${gridConfig.rowHeight}px)`;
	} else {
		container.style.gridTemplateRows = `repeat(${actualGridHeight}, auto)`;
	}

	// Create task creation helper
	const taskCreationHelper = new TaskCreationHelper(app, appStateManager);
	
	// Get current board grouping to determine group type
	const boardGrouping = appStateManager.getPersistentState().boardGrouping;
	const groupType = boardGrouping?.groupBy || 'status';

	const header = document.createElement("div");
	header.className = "group-header clickable-header";
	header.style.display = 'flex';
	header.style.alignItems = 'flex-end';
	header.style.justifyContent = 'space-between';
	header.style.paddingRight = '5px';
	header.style.paddingBottom = '5px';
	header.style.cursor = 'pointer';
	header.style.position = 'relative';

	const headerText = document.createElement("span");
	headerText.textContent = groupName;
	header.appendChild(headerText);
	
	// Add drag handle using same UI language as task cards
	addGroupDragHandle(header, groupName, appStateManager);

	// Add hover effects to header
	header.addEventListener('mouseenter', () => {
		header.style.backgroundColor = 'var(--interactive-hover)';
		header.setAttribute('title', `Click to create task for ${groupType}: ${groupName}`);
	});
	
	header.addEventListener('mouseleave', () => {
		header.style.backgroundColor = '';
		header.removeAttribute('title');
	});

	// Add click handler for group header
	header.addEventListener('click', (e) => {
		// Only open task modal if not dragging
		if (!header.classList.contains('dragging')) {
			taskCreationHelper.openTaskModalForGroup(groupName, groupType);
		}
	});
	
	// Drag functionality is now handled by addGroupDragHandle

	header.style.gridColumn = "1";
	header.style.gridRow = `1 / span ${actualGridHeight}`;

	if (isDebugMode) {
		header.classList.add("debug-cell");
	}

	container.appendChild(header);

	const occupiedCells = new Set<string>();

	tasks.forEach((task) => {
		const card = BoardTaskCard(task, settings, appStateManager, isDebugMode, sharedTooltip);

		const startX = (task.xStart ?? 1);
		const endX = (task.xEnd ?? startX);
		// Grid column 1 is reserved for group header, so tasks start at column 2
		const cssGridStartX = Math.max(2, startX + 1);
		card.style.gridColumnStart = cssGridStartX.toString();

		const span = Math.max(1, endX - startX + 1);
		card.style.gridColumnEnd = `span ${span}`;

		const startY = (task.y ?? 0) + 1;
		card.style.gridRowStart = startY.toString();

		container.appendChild(card);

		for (let x = cssGridStartX; x < cssGridStartX + span; x++) {
			occupiedCells.add(`${x},${startY}`);
		}
	});

	return container;
}

// Group Header Drag Implementation (same UI language as task cards)
function addGroupDragHandle(header: HTMLElement, groupName: string, appStateManager: AppStateManager): void {
	// Create drag handle element (same as task cards)
	const dragHandle = document.createElement('div');
	dragHandle.className = 'group-drag-handle';
	dragHandle.innerHTML = '⋮⋮';
	dragHandle.style.cssText = `
		position: absolute;
		top: 50%;
		right: 28px;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		display: none;
		align-items: center;
		justify-content: center;
		cursor: grab;
		line-height: 1;
		z-index: 10;
		pointer-events: auto;
	`;
	
	header.appendChild(dragHandle);
	
	// Show/hide handle on hover (same as task cards)
	header.addEventListener('mouseenter', () => {
		dragHandle.style.display = 'flex';
	});
	
	header.addEventListener('mouseleave', () => {
		dragHandle.style.display = 'none';
	});
	
	// Drag functionality
	let isDragging = false;
	
	dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		isDragging = true;
		dragHandle.style.cursor = 'grabbing';
		
		// Create ghost element
		const ghost = createGroupGhost(header, groupName);
		document.body.appendChild(ghost);
		
		// Add dragging class to original header
		header.classList.add('group-dragging');
		
		
		// Add global mouse listeners
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	});
	
	function handleMouseMove(e: MouseEvent): void {
		if (!isDragging) return;
		
		const mouseX = e.clientX;
		const mouseY = e.clientY;
		
		// Visual updates only
		requestAnimationFrame(() => {
			// Update ghost position
			const ghost = document.querySelector('.group-drag-ghost') as HTMLElement;
			if (ghost) {
				ghost.style.left = `${mouseX - 100}px`;
				ghost.style.top = `${mouseY - 20}px`;
			}
			
			// Highlight drop zones between group headers
			highlightGroupDropZones(mouseY);
		});
	}
	
	function handleMouseUp(e: MouseEvent): void {
		if (!isDragging) return;
		
		isDragging = false;
		dragHandle.style.cursor = 'grab';
		
		// Remove visual feedback
		header.classList.remove('group-dragging');
		cleanupGroupDragVisuals();
		
		const targetIndex = calculateGroupDropIndex(e.clientY);
		const sourceIndex = getGroupIndex(header);
		
		if (targetIndex !== -1 && targetIndex !== sourceIndex) {
			appStateManager.emit(PluginEvent.GroupReorderPending, {
				sourceIndex,
				targetIndex,
				groupName
			});
		}
		
		// Cleanup
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}
}

// Helper functions for group dragging
function createGroupGhost(originalHeader: HTMLElement, groupName: string): HTMLElement {
	const ghost = originalHeader.cloneNode(true) as HTMLElement;
	ghost.className = 'group-drag-ghost';
	
	// Remove any event listeners from the clone
	const newGhost = ghost.cloneNode(true) as HTMLElement;
	
	// Position initially off-screen
	newGhost.style.position = 'fixed';
	newGhost.style.left = '-1000px';
	newGhost.style.top = '-1000px';
	newGhost.style.width = `${originalHeader.offsetWidth}px`;
	newGhost.style.height = `${originalHeader.offsetHeight}px`;
	newGhost.style.zIndex = '1001';
	newGhost.style.pointerEvents = 'none';
	
	return newGhost;
}

function getGroupIndex(header: HTMLElement): number {
	const allGroups = document.querySelectorAll('.group-header');
	return Array.from(allGroups).indexOf(header);
}

function calculateGroupDropIndex(mouseY: number): number {
	const allGroups = document.querySelectorAll('.group-header');
	
	for (let i = 0; i < allGroups.length; i++) {
		const group = allGroups[i] as HTMLElement;
		const rect = group.getBoundingClientRect();
		const centerY = rect.top + rect.height / 2;
		
		if (mouseY < centerY) {
			return i;
		}
	}
	
	return allGroups.length; // Drop at end
}

function highlightGroupDropZones(mouseY: number): void {
	// Clear previous highlights
	cleanupGroupHighlights();
	
	const allGroups = document.querySelectorAll('.group-header');
	
	for (let i = 0; i < allGroups.length; i++) {
		const group = allGroups[i] as HTMLElement;
		const rect = group.getBoundingClientRect();
		const centerY = rect.top + rect.height / 2;
		
		if (mouseY < centerY) {
			group.classList.add('group-drop-target-before');
			break;
		} else if (i === allGroups.length - 1) {
			group.classList.add('group-drop-target-after');
		}
	}
}

function cleanupGroupHighlights(): void {
	document.querySelectorAll('.group-drop-target-before, .group-drop-target-after').forEach(el => {
		el.classList.remove('group-drop-target-before', 'group-drop-target-after');
	});
}

function cleanupGroupDragVisuals(): void {
	// Remove ghost element
	const ghost = document.querySelector('.group-drag-ghost');
	if (ghost) {
		ghost.remove();
	}
	
	// Clean up highlights
	cleanupGroupHighlights();
}

