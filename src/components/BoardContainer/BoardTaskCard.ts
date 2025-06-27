import { positionTooltip, positionTooltipAtMouse } from "../../core/utils/tooltipUtils";
import { TFile } from "obsidian";
import { ITask } from "../../interfaces/ITask";
import { ITaskTimelineSettings } from "../../interfaces/ITaskTimelineSettings";
import { AppStateManager } from "../../core/AppStateManager";
import { DEFAULT_COLOR, HIDE_COLOR, HIDE_VALUE } from "../../core/utils/colorUtils";
import { PluginEvent } from "../../enums/events";
import { IDragOperation, IResizeOperation } from "../../interfaces/IAppState";
import { getGroupValue } from "../../core/utils/groupingUtils";

export function BoardTaskCard(
	task: ITask,
	settings: ITaskTimelineSettings,
	appStateManager: AppStateManager,
	isDebugMode = false
): HTMLElement {
	const card = document.createElement("div");
	card.className = "task-timeline-task";

	if (isDebugMode) {
		card.classList.add("debug-cell");
	}

	// Apply color based on current color variable
	const taskColor = getTaskColor(task, appStateManager);
	if (taskColor && taskColor !== DEFAULT_COLOR) {
		if (taskColor === HIDE_COLOR) {
			card.style.display = "none";
		} else {
			card.style.backgroundColor = taskColor;
			card.style.borderLeft = `4px solid var(--color-white)`;
			card.style.padding = "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-md)";
		}
	}

	// Display Task Name
	const taskName = document.createElement("div");
	taskName.className = "task-timeline-card-name";
	taskName.textContent = task.name || "Unnamed Task";
	card.appendChild(taskName);

	// Display Subtask Progress if applicable
	if (task.totalSubtasks > 0) {
		const subtaskContainer = document.createElement("div");
		subtaskContainer.className = "task-timeline-subtask-container";

		for (let i = 0; i < task.totalSubtasks; i++) {
			const subtaskBox = document.createElement("span");
			subtaskBox.className = "task-timeline-subtask-box";
			if (i < task.completedSubtasks) {
				subtaskBox.classList.add("completed");
			}
			subtaskContainer.appendChild(subtaskBox);
		}
		card.appendChild(subtaskContainer);
	}

	card.classList.add("hover-enabled");
	
	// Add data attributes for drag/drop identification
	card.setAttribute('data-task-id', task.id || '');
	
	// Get current grouping to calculate correct group value for drag operations
	const boardGrouping = appStateManager.getPersistentState().boardGrouping;
	const groupBy = boardGrouping?.groupBy || 'status';
	const taskGroupValue = getGroupValue(task, groupBy);
	card.setAttribute('data-task-group', taskGroupValue);
	
	// Add drag handle and resize handlers with shared state
	addInteractionHandlers(card, task, appStateManager);

	const tooltip = document.createElement("div");
	tooltip.className = "task-timeline-tooltip";

	const formatDateToYYYYMMDD = (date: Date | null): string => {
		if (!date || !(date instanceof Date) || isNaN(date.getTime()))
			return "";
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}${month}${day}`;
	};

	const safeCreateDate = (dateInput: string | Date): Date | null => {
		if (!dateInput) return null;
		if (dateInput instanceof Date) {
			return isNaN(dateInput.getTime()) ? null : dateInput;
		}
		if (typeof dateInput === "string") {
			try {
				const date = new Date(dateInput);
				return isNaN(date.getTime()) ? null : date;
			} catch (e) {
				return null;
			}
		}
		return null;
	};

	const tooltipContent = document.createElement("div");
	tooltipContent.className = "tooltip-content";

	const xStartLayout = task.xStart ?? 1;
	const xEndLayout = task.xEnd ?? xStartLayout;
	const y_layout = task.y ?? 0;

	tooltipContent.innerHTML = `
	   <div><strong>name:</strong> ${task.name || ""}</div>
	   <div><strong>start:</strong> ${formatDateToYYYYMMDD(
			safeCreateDate(task.start)
		)}</div>
	   <div><strong>end:</strong> ${formatDateToYYYYMMDD(
			safeCreateDate(task.end)
		)}</div>
	   <div><strong>x (layout):</strong> ${xStartLayout}-${xEndLayout}</div>
	   <div><strong>y (layout):</strong> ${y_layout}</div>
	   <div><strong>category:</strong> ${task.category || ""}</div>
	   <div><strong>status:</strong> ${task.status || ""}</div>
	   <div><strong>priority:</strong> ${task.priority ?? "N/A"}</div>
	   ${
			task.totalSubtasks > 0
				? `<div><strong>subtasks:</strong> ${task.completedSubtasks}/${task.totalSubtasks}</div>`
				: ""
		}
	 `;

	tooltip.appendChild(tooltipContent);
	
	// Append tooltip to body for proper fixed positioning
	document.body.appendChild(tooltip);

	// Store tooltip reference for cleanup
	(card as any).__tooltip = tooltip;

	card.addEventListener("mouseenter", (e) => {
		// Clean up any existing stuck tooltips first
		cleanupStuckTooltips();
		positionTooltipAtMouse(e, tooltip);
	});

	card.addEventListener("mouseleave", () => {
		tooltip.style.display = "none";
		// Add small delay to ensure tooltip is hidden
		setTimeout(() => {
			tooltip.style.display = "none";
		}, 10);
	});

	card.addEventListener("mousemove", (e) => {
		if (tooltip.style.display !== "none") {
			positionTooltipAtMouse(e, tooltip);
		}
	});


	return card;
}

// Track the task file leaf to reuse the same split pane
let taskFileLeaf: any = null;

function openTaskFile(filePath: string): void {
	const app = (window as any).app;
	if (!app) return;

	const file = app.vault.getAbstractFileByPath(filePath);
	if (!file) {
		return;
	}

	// Check if we have a valid leaf and it still exists in the workspace
	if (taskFileLeaf && app.workspace.getLeafById && app.workspace.getLeafById(taskFileLeaf.id)) {
		// Reuse the existing leaf
		taskFileLeaf.openFile(file as TFile);
	} else {
		// Create a new split and remember it
		taskFileLeaf = app.workspace.getLeaf("split", "vertical");
		taskFileLeaf.openFile(file as TFile);
	}
}

function getTaskColor(task: ITask, appStateManager: AppStateManager): string {
	const state = appStateManager.getState();
	const colorVariable = state.persistent.colorVariable;
	const currentProject = state.persistent.currentProjectName;
	
	// If no color variable selected or no project, return default
	if (!colorVariable || colorVariable === 'none' || !currentProject) {
		return DEFAULT_COLOR;
	}
	
	// Get the value from the task based on the color variable
	let taskValue: string | undefined;
	switch (colorVariable) {
		case 'category':
			taskValue = task.category;
			break;
		case 'status':
			taskValue = task.status;
			break;
		case 'priority':
			taskValue = task.priority?.toString();
			break;
		default:
			return DEFAULT_COLOR;
	}
	
	// If task doesn't have the value, return default
	if (!taskValue) {
		return DEFAULT_COLOR;
	}
	
	// Look up the color mapping
	const colorMappings = state.persistent.colorMappings;
	if (!colorMappings || !colorMappings[currentProject] || !colorMappings[currentProject][colorVariable]) {
		return DEFAULT_COLOR;
	}
	
	const color = colorMappings[currentProject][colorVariable][taskValue];
	if (!color) {
		return DEFAULT_COLOR;
	}
	
	// Handle hide value
	if (color === HIDE_VALUE) {
		return HIDE_COLOR;
	}
	
	return color;
}

function cleanupStuckTooltips(): void {
	// Find all tooltips in the document body
	const allTooltips = document.querySelectorAll('.task-timeline-tooltip');
	allTooltips.forEach(tooltip => {
		if (tooltip instanceof HTMLElement && tooltip.style.display !== "none") {
			// Check if the tooltip's card still exists and is being hovered
			const cards = document.querySelectorAll('.task-timeline-task');
			let tooltipStillNeeded = false;
			
			cards.forEach(card => {
				if ((card as any).__tooltip === tooltip) {
					const rect = card.getBoundingClientRect();
					// Check if mouse is actually over the card
					const centerX = rect.left + rect.width/2;
					const centerY = rect.top + rect.height/2;
					const elementAtCenter = document.elementFromPoint(centerX, centerY);
					if (elementAtCenter && (elementAtCenter === card || card.contains(elementAtCenter))) {
						tooltipStillNeeded = true;
					}
				}
			});
			
			if (!tooltipStillNeeded) {
				tooltip.style.display = "none";
			}
		}
	});
}

// Combined Drag and Resize Implementation
function addInteractionHandlers(card: HTMLElement, task: ITask, appStateManager: AppStateManager): void {
	// Shared state for both drag and resize
	let isDragging = false;
	let isResizing = false;
	let resizeType: 'start' | 'end' | null = null;
	let startX = 0;
	let justFinishedResize = false;
	// Create drag handle element
	const dragHandle = document.createElement('div');
	dragHandle.className = 'task-drag-handle';
	dragHandle.innerHTML = '⋮⋮';
	dragHandle.style.cssText = `
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 24px;
		height: 24px;
		display: none;
		align-items: center;
		justify-content: center;
		cursor: inherit;
		line-height: 1;
		z-index: 10;
		pointer-events: auto;
	`;
	
	card.style.position = 'relative';
	card.appendChild(dragHandle);
	
	// Show/hide handle on hover and manage cursor
	card.addEventListener('mouseenter', () => {
		dragHandle.style.display = 'flex';
	});
	
	card.addEventListener('mouseleave', () => {
		dragHandle.style.display = 'none';
	});
	
	// Click handler to open task file
	card.addEventListener("click", async (e) => {
		e.stopPropagation();

		// Don't open file if we just finished a resize operation
		if (justFinishedResize) {
			justFinishedResize = false;
			return;
		}

		if (task.filePath) {
			openTaskFile(task.filePath);
		}
	});
	
	card.addEventListener('mousemove', (e: MouseEvent) => {
		if (isDragging || isResizing) return;
		
		const rect = card.getBoundingClientRect();
		const isLeftBorder = e.clientX - rect.left <= 8;
		const isRightBorder = rect.right - e.clientX <= 8;
		
		const handleRect = dragHandle.getBoundingClientRect();
		const isOverHandle = dragHandle.style.display === 'flex' && 
			e.clientX >= handleRect.left && e.clientX <= handleRect.right &&
			e.clientY >= handleRect.top && e.clientY <= handleRect.bottom;
		
		if (isLeftBorder || isRightBorder) {
			card.style.cursor = 'col-resize';
		} else if (isOverHandle) {
			card.style.cursor = 'grab';
		} else {
			card.style.cursor = 'pointer';
		}
	});
	
	dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		isDragging = true;
		dragHandle.style.cursor = 'grabbing';
		
		// Create ghost element
		const ghost = createGhostCard(card, task);
		document.body.appendChild(ghost);
		
		// Add dragging class to original card
		card.classList.add('dragging');
		
		// Emit drag start
		appStateManager.emit(PluginEvent.DragStartPending, {
			taskId: task.id,
			initialPosition: { x: e.clientX, y: e.clientY }
		});
		
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
			const ghost = document.querySelector('.task-drag-ghost') as HTMLElement;
			if (ghost) {
				ghost.style.left = `${mouseX - 100}px`;
				ghost.style.top = `${mouseY - 20}px`;
			}
			
			// Only highlight row drop zones (no column highlighting)
			highlightRowDropZones(mouseX, mouseY, appStateManager);
		});
		
		// Emit position
		appStateManager.emit(PluginEvent.DragMovePending, {
			taskId: task.id,
			mousePosition: { x: mouseX, y: mouseY }
		});
	}
	
	function handleMouseUp(e: MouseEvent): void {
		if (!isDragging) return;
		
		isDragging = false;
		dragHandle.style.cursor = 'grab';
		
		// Remove visual feedback
		card.classList.remove('dragging');
		cleanupDragVisuals();
		
		// Emit drag end
		appStateManager.emit(PluginEvent.DragEndPending, {
			taskId: task.id,
			mousePosition: { x: e.clientX, y: e.clientY }
		});
		
		// Cleanup
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}
	
	card.addEventListener('mousedown', (e: MouseEvent) => {
		const rect = card.getBoundingClientRect();
		const isLeftBorder = e.clientX - rect.left <= 8;
		const isRightBorder = rect.right - e.clientX <= 8;
		
		if (!isLeftBorder && !isRightBorder) {
			return;
		}
		
		e.preventDefault();
		e.stopPropagation();
		
		isResizing = true;
		resizeType = isLeftBorder ? 'start' : 'end';
		startX = e.clientX;
		card.style.cursor = 'col-resize';
		
		// Add visual feedback
		card.classList.add('resizing');
		
		// Create resize ghost preview
		createResizeGhost(card, task, resizeType);
		
		// Emit resize start event
		appStateManager.emit(PluginEvent.ResizeStartPending, {
			taskId: task.id,
			resizeType: resizeType,
			initialColumn: resizeType === 'start' ? (task.xStart || 1) : (task.xEnd || task.xStart || 1),
			mousePosition: { x: startX, y: e.clientY }
		});
		
		// Add global mouse listeners
		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeUp);
	});
	
	function handleResizeMove(e: MouseEvent): void {
		if (!isResizing || !resizeType) return;
		
		const targetColumn = calculateColumnFromX(e.clientX);
		
		// Visual feedback: update resize ghost
		updateResizeGhost(targetColumn, resizeType);
		
		// Emit resize move event
		appStateManager.emit(PluginEvent.ResizeMovePending, {
			taskId: task.id,
			resizeType: resizeType,
			targetColumn: targetColumn,
			mousePosition: { x: e.clientX, y: e.clientY }
		});
	}
	
	function handleResizeUp(e: MouseEvent): void {
		if (!isResizing || !resizeType) return;
		
		// Prevent click event from firing after resize
		e.preventDefault();
		e.stopPropagation();
		
		const targetColumn = calculateColumnFromX(e.clientX);
		
		// Emit resize end event
		appStateManager.emit(PluginEvent.ResizeEndPending, {
			taskId: task.id,
			resizeType: resizeType,
			initialColumn: resizeType === 'start' ? (task.xStart || 1) : (task.xEnd || task.xStart || 1),
			targetColumn: targetColumn,
			mousePosition: { x: e.clientX, y: e.clientY }
		});
		
		// Cleanup
		isResizing = false;
		resizeType = null;
		card.style.cursor = 'pointer';
		justFinishedResize = true;
		
		// Remove visual feedback
		card.classList.remove('resizing');
		cleanupResizeGhost();
		
		document.removeEventListener('mousemove', handleResizeMove);
		document.removeEventListener('mouseup', handleResizeUp);
		
		// Reset the flag after a short delay to allow normal clicks again
		setTimeout(() => {
			justFinishedResize = false;
		}, 50);
	}
}


// Row-only visual highlighting using state data
function highlightRowDropZones(mouseX: number, mouseY: number, appStateManager: AppStateManager): void {
	// Clear previous highlights
	cleanupHighlights();
	
	// Get current board layout from state
	const volatile = appStateManager.getVolatileState();
	if (!volatile.boardLayout?.taskGrids) {
		return;
	}
	
	// Find target group using the same logic as drag detection
	const availableGroups = volatile.boardLayout.taskGrids.map(grid => grid.group);
	const taskGroups = document.querySelectorAll('.board-task-group');
	
	for (let i = 0; i < taskGroups.length && i < availableGroups.length; i++) {
		const groupElement = taskGroups[i] as HTMLElement;
		const rect = groupElement.getBoundingClientRect();
		
		if (mouseY >= rect.top && mouseY <= rect.bottom) {
			groupElement.classList.add('drop-zone-active');
			break; // Only highlight one group
		}
	}
	
	// No column highlighting - dragging only changes rows
}

function cleanupHighlights(): void {
	document.querySelectorAll('.drop-zone-active, .drop-target').forEach(el => {
		el.classList.remove('drop-zone-active', 'drop-target');
	});
}

// Resize ghost preview functions
function createResizeGhost(originalCard: HTMLElement, task: ITask, resizeType: 'start' | 'end'): void {
	const ghost = originalCard.cloneNode(true) as HTMLElement;
	ghost.className = 'task-resize-ghost';
	
	// Remove any event listeners from the clone
	const newGhost = ghost.cloneNode(true) as HTMLElement;
	
	// Position at the same location as original card initially
	const rect = originalCard.getBoundingClientRect();
	newGhost.style.position = 'fixed';
	newGhost.style.left = `${rect.left}px`;
	newGhost.style.top = `${rect.top}px`;
	newGhost.style.width = `${rect.width}px`;
	newGhost.style.height = `${rect.height}px`;
	newGhost.style.zIndex = '1002';
	newGhost.style.pointerEvents = 'none';
	
	// Store initial info for updates
	newGhost.setAttribute('data-original-start', (task.xStart || 1).toString());
	newGhost.setAttribute('data-original-end', (task.xEnd || task.xStart || 1).toString());
	newGhost.setAttribute('data-resize-type', resizeType);
	
	document.body.appendChild(newGhost);
}

function updateResizeGhost(targetColumn: number, resizeType: 'start' | 'end'): void {
	const ghost = document.querySelector('.task-resize-ghost') as HTMLElement;
	if (!ghost) return;
	
	const originalStart = parseInt(ghost.getAttribute('data-original-start') || '1');
	const originalEnd = parseInt(ghost.getAttribute('data-original-end') || '1');
	
	// Calculate new span based on resize type
	let newStart: number, newEnd: number;
	if (resizeType === 'start') {
		newStart = targetColumn;
		newEnd = originalEnd;
		// Ensure start is not after end
		if (newStart > newEnd) {
			newEnd = newStart;
		}
	} else {
		newStart = originalStart;
		newEnd = targetColumn;
		// Ensure end is not before start
		if (newEnd < newStart) {
			newStart = newEnd;
		}
	}
	
	// Calculate new position and width based on columns
	const columnHeaders = document.querySelectorAll('.timeline-header-cell');
	if (columnHeaders.length > 0) {
		const firstColumnRect = columnHeaders[0].getBoundingClientRect();
		const columnWidth = firstColumnRect.width;
		
		const newLeft = firstColumnRect.left + (newStart - 1) * columnWidth;
		const newWidth = (newEnd - newStart + 1) * columnWidth;
		
		ghost.style.left = `${newLeft}px`;
		ghost.style.width = `${newWidth}px`;
	}
}

function cleanupResizeGhost(): void {
	const ghost = document.querySelector('.task-resize-ghost');
	if (ghost) {
		ghost.remove();
	}
}

// Visual feedback functions
function createGhostCard(originalCard: HTMLElement, task: ITask): HTMLElement {
	const ghost = originalCard.cloneNode(true) as HTMLElement;
	ghost.className = 'task-drag-ghost';
	
	// Remove any event listeners from the clone
	const newGhost = ghost.cloneNode(true) as HTMLElement;
	
	// Position initially off-screen
	newGhost.style.position = 'fixed';
	newGhost.style.left = '-1000px';
	newGhost.style.top = '-1000px';
	newGhost.style.width = `${originalCard.offsetWidth}px`;
	newGhost.style.height = `${originalCard.offsetHeight}px`;
	newGhost.style.zIndex = '1001';
	newGhost.style.pointerEvents = 'none';
	
	return newGhost;
}


function cleanupDragVisuals(): void {
	// Remove ghost element
	const ghost = document.querySelector('.task-drag-ghost');
	if (ghost) {
		ghost.remove();
	}
	
	// Clean up highlights
	cleanupHighlights();
}

// Column calculation function for resize operations
function calculateColumnFromX(mouseX: number): number {
	const columnHeaders = document.querySelectorAll('.timeline-header-cell');
	let targetColumn = 1;
	
	for (let i = 0; i < columnHeaders.length; i++) {
		const header = columnHeaders[i] as HTMLElement;
		const rect = header.getBoundingClientRect();
		if (mouseX >= rect.left && mouseX <= rect.right) {
			targetColumn = i + 1;
			break;
		}
	}
	
	return targetColumn;
}