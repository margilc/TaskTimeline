import { positionTooltipAtMouse } from "../../core/utils/tooltipUtils";
import { TFile } from "obsidian";
import { ITask } from "../../interfaces/ITask";
import { ITaskTimelineSettings } from "../../interfaces/ITaskTimelineSettings";
import { AppStateManager } from "../../core/AppStateManager";
import { DEFAULT_COLOR, HIDE_VALUE } from "../../core/utils/colorUtils";
import { BoardArrowOverlay } from "./BoardArrowOverlay";

export function BoardTaskCard(
	task: ITask,
	settings: ITaskTimelineSettings,
	appStateManager: AppStateManager,
	isDebugMode = false,
	sharedTooltip: HTMLElement,
	arrowOverlay?: BoardArrowOverlay
): HTMLElement {
	const card = document.createElement("div");
	card.className = "task-timeline-task";

	if (isDebugMode) {
		card.classList.add("debug-cell");
	}

	// Apply color based on current color variable or user's default card color
	const taskColor = getTaskColor(task, appStateManager);
	if (taskColor) {
		card.style.backgroundColor = taskColor;
		const contrastText = getContrastingTextColor(taskColor);
		if (contrastText) {
			card.style.color = contrastText;
		}
	}

	// Display Task Name
	const taskName = document.createElement("div");
	taskName.className = "task-timeline-card-name";
	taskName.textContent = task.name || "Unnamed Task";
	card.appendChild(taskName);

	// Display progress bar if task has subtasks
	if (task.totalSubtasks > 0) {
		const progressBar = document.createElement("div");
		progressBar.className = "task-timeline-progress-bar";

		const progressFill = document.createElement("div");
		progressFill.className = "task-timeline-progress-fill";
		const pct = Math.round((task.completedSubtasks / task.totalSubtasks) * 100);
		progressFill.style.width = `${pct}%`;

		progressBar.appendChild(progressFill);
		card.appendChild(progressBar);
	}

	card.classList.add("hover-enabled");
	card.setAttribute('data-task-id', task.id || '');

	// Click to open task file
	card.style.cursor = 'pointer';
	card.addEventListener("click", (e) => {
		e.stopPropagation();
		if (task.filePath) {
			openTaskFile(task.filePath, appStateManager);
		}
	});

	// Shared tooltip
	card.addEventListener("mouseenter", (e) => {
		updateSharedTooltipContent(sharedTooltip, task, isDebugMode);
		positionTooltipAtMouse(e, sharedTooltip);
	});

	card.addEventListener("mouseleave", () => {
		sharedTooltip.style.display = "none";
	});

	card.addEventListener("mousemove", (e) => {
		if (sharedTooltip.style.display !== "none") {
			positionTooltipAtMouse(e, sharedTooltip);
		}
	});

	// Arrow overlay: show arrows on hover if task has links
	if (arrowOverlay && task.linkedTaskIds && task.linkedTaskIds.length > 0) {
		card.addEventListener("mouseenter", () => {
			arrowOverlay.showArrows(task.id, task.linkedTaskIds!);
		});
		card.addEventListener("mouseleave", () => {
			arrowOverlay.clearArrows();
		});
	}

	return card;
}

function getContrastingTextColor(color: string): string | null {
	const hex = color.trim();
	const match = hex.match(/^#([0-9a-fA-F]{6})$/);
	if (!match) return null;

	const r = parseInt(match[1].slice(0, 2), 16);
	const g = parseInt(match[1].slice(2, 4), 16);
	const b = parseInt(match[1].slice(4, 6), 16);

	const srgbToLin = (c: number) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	const L = 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);

	return L < 0.45 ? '#ffffff' : '#111111';
}

function updateSharedTooltipContent(tooltip: HTMLElement, task: ITask, isDebugMode: boolean): void {
	tooltip.innerHTML = '';

	const content = document.createElement("div");
	content.className = "tooltip-content";

	const addRow = (label: string, value: string | number | null | undefined) => {
		const row = document.createElement("div");
		const strong = document.createElement("strong");
		strong.textContent = `${label}: `;
		row.appendChild(strong);
		row.appendChild(document.createTextNode(String(value ?? '')));
		content.appendChild(row);
	};

	const formatDate = (dateInput: string | Date | null | undefined): string => {
		if (!dateInput) return '';
		try {
			const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
			if (isNaN(date.getTime())) return '';
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${year}${month}${day}`;
		} catch {
			return '';
		}
	};

	addRow("name", task.name || "Unnamed Task");
	addRow("start", formatDate(task.start));
	addRow("end", formatDate(task.end));

	if (isDebugMode) {
		addRow("x (layout)", `${task.xStart ?? 1}-${task.xEnd ?? task.xStart ?? 1}`);
		addRow("y (layout)", task.y ?? 0);
	}

	addRow("category", task.category);
	addRow("status", task.status);
	addRow("priority", task.priority ?? "N/A");

	if (task.totalSubtasks > 0) {
		addRow("subtasks", `${task.completedSubtasks}/${task.totalSubtasks}`);
	}

	tooltip.appendChild(content);
}

// Track the task file leaf ID to reuse the same split pane
let taskFileLeafId: string | null = null;

function openTaskFile(filePath: string, appStateManager: AppStateManager): void {
	const app = (window as any).app;
	if (!app) return;

	const file = app.vault.getAbstractFileByPath(filePath);
	if (!file) return;

	// Try to reuse existing leaf
	if (taskFileLeafId) {
		const existingLeaf = app.workspace.getLeafById(taskFileLeafId);
		if (existingLeaf) {
			existingLeaf.openFile(file as TFile);
			return;
		}
		taskFileLeafId = null;
	}

	const newLeaf = app.workspace.getLeaf("split", "vertical");
	taskFileLeafId = newLeaf.id;
	newLeaf.openFile(file as TFile);
}

function getTaskColor(task: ITask, appStateManager: AppStateManager): string {
	const state = appStateManager.getState();
	const colorVariable = state.persistent.colorVariable;
	const currentProject = state.persistent.currentProjectName;
	const defaultCardColor = state.persistent.settings?.defaultCardColor || DEFAULT_COLOR;

	if (!colorVariable || colorVariable === 'none' || !currentProject) {
		return defaultCardColor;
	}

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
			return defaultCardColor;
	}

	if (!taskValue) return defaultCardColor;

	const colorMappings = state.persistent.colorMappings;
	if (!colorMappings || !colorMappings[currentProject] || !colorMappings[currentProject][colorVariable]) {
		return defaultCardColor;
	}

	const color = colorMappings[currentProject][colorVariable][taskValue];
	if (!color || color === HIDE_VALUE) return defaultCardColor;

	return color;
}
