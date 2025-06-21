import { positionTooltip, positionTooltipAtMouse } from "../../core/utils/tooltipUtils";
import { TFile } from "obsidian";
import { ITask } from "../../interfaces/ITask";
import { ITaskTimelineSettings } from "../../interfaces/ITaskTimelineSettings";
import { AppStateManager } from "../../core/AppStateManager";
import { DEFAULT_COLOR, HIDE_COLOR, HIDE_VALUE } from "../../core/utils/colorUtils";

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
				console.error("Error parsing date string:", dateInput, e);
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

	card.addEventListener("click", async (e) => {
		e.stopPropagation();

		if (task.filePath) {
			openTaskFile(task.filePath);
		} else {
			console.warn("Task object missing filePath:", task);
		}
	});

	return card;
}

function openTaskFile(filePath: string): void {
	const app = (window as any).app;
	if (!app) return;

	const file = app.vault.getAbstractFileByPath(filePath);
	if (!file) {
		console.error(`File not found at path: ${filePath}`);
		return;
	}

	app.workspace.getLeaf("split", "vertical").openFile(file as TFile);
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