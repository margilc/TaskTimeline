
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
	sharedTooltip: HTMLElement,
	groupIndex: number,
	totalGroups: number
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
	header.style.cursor = 'pointer';

	const headerText = document.createElement("span");
	headerText.textContent = groupName;
	header.appendChild(headerText);

	// Arrow buttons + plus indicator container (visible on hover via CSS)
	const arrowContainer = document.createElement("div");
	arrowContainer.className = "group-header-arrows";

	if (groupIndex > 0) {
		const upBtn = document.createElement("span");
		upBtn.className = "group-header-action";
		upBtn.textContent = "\u25B2";
		upBtn.title = "Move group up";
		upBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			appStateManager.getEvents().trigger(PluginEvent.UpdateGroupOrderPending, {
				groupName,
				direction: 'up'
			});
		});
		arrowContainer.appendChild(upBtn);
	}

	if (groupIndex < totalGroups - 1) {
		const downBtn = document.createElement("span");
		downBtn.className = "group-header-action";
		downBtn.textContent = "\u25BC";
		downBtn.title = "Move group down";
		downBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			appStateManager.getEvents().trigger(PluginEvent.UpdateGroupOrderPending, {
				groupName,
				direction: 'down'
			});
		});
		arrowContainer.appendChild(downBtn);
	}

	const plusIndicator = document.createElement("span");
	plusIndicator.className = "group-header-action";
	plusIndicator.textContent = "+";
	arrowContainer.appendChild(plusIndicator);

	header.appendChild(arrowContainer);

	// Hover effects
	header.addEventListener('mouseenter', () => {
		header.style.backgroundColor = 'var(--interactive-hover)';
		header.setAttribute('title', `Click to create task for ${groupType}: ${groupName}`);
	});

	header.addEventListener('mouseleave', () => {
		header.style.backgroundColor = '';
		header.removeAttribute('title');
	});

	// Click to create task for this group
	header.addEventListener('click', () => {
		taskCreationHelper.openTaskModalForGroup(groupName, groupType);
	});

	header.style.gridColumn = "1";
	header.style.gridRow = `1 / span ${actualGridHeight}`;

	if (isDebugMode) {
		header.classList.add("debug-cell");
	}

	container.appendChild(header);

	tasks.forEach((task) => {
		const card = BoardTaskCard(task, settings, appStateManager, isDebugMode, sharedTooltip);

		const startX = (task.xStart ?? 1);
		const endX = (task.xEnd ?? startX);
		const cssGridStartX = Math.max(2, startX + 1);
		card.style.gridColumnStart = cssGridStartX.toString();

		const span = Math.max(1, endX - startX + 1);
		card.style.gridColumnEnd = `span ${span}`;

		const startY = (task.y ?? 0) + 1;
		card.style.gridRowStart = startY.toString();

		container.appendChild(card);
	});

	return container;
}
