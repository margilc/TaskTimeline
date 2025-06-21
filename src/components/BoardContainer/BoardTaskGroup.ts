
import { App } from "obsidian";
import { BoardTaskCard } from "./BoardTaskCard";
import { ITaskTimelineSettings } from "../../interfaces/ITaskTimelineSettings";
import { AppStateManager } from "../../core/AppStateManager";
import { ITask } from "../../interfaces/ITask";
import { TaskCreationHelper } from "../../utils/taskCreationHelper";

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
	isDebugMode = false
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
	header.addEventListener('click', () => {
		taskCreationHelper.openTaskModalForGroup(groupName, groupType);
	});

	header.style.gridColumn = "1";
	header.style.gridRow = `1 / span ${actualGridHeight}`;

	if (isDebugMode) {
		header.classList.add("debug-cell");
	}

	container.appendChild(header);

	const occupiedCells = new Set<string>();

	tasks.forEach((task) => {
		const card = BoardTaskCard(task, settings, appStateManager, isDebugMode);

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


