import { App, Notice } from "obsidian";
import { AppStateManager } from "../core/AppStateManager";
import { NewTaskModal, NewTaskFormData } from "../components/NewTaskModal";
import { PluginEvent } from "../enums/events";
import { loadTemplates } from "../core/utils/templateUtils";

export class TaskCreationHelper {
	constructor(private app: App, private appStateManager: AppStateManager) {}

	openTaskModalForGroup(groupName: string, groupType: string): void {
		const prePopulated: Partial<NewTaskFormData> = {};
		
		// Pre-populate based on group type
		switch (groupType) {
			case 'category':
				prePopulated.category = groupName;
				break;
			case 'status':
				prePopulated.status = groupName;
				break;
			case 'priority':
				prePopulated.priority = groupName;
				break;
		}
		
		this.openTaskModal(prePopulated);
	}

	openTaskModalForDate(date: Date): void {
		const prePopulated: Partial<NewTaskFormData> = {
			start: date.toISOString().split('T')[0]
		};
		
		this.openTaskModal(prePopulated);
	}

	private async openTaskModal(prePopulated: Partial<NewTaskFormData> = {}): Promise<void> {
		// Check if a valid project is selected
		const currentProject = this.appStateManager.getPersistentState().currentProjectName;

		if (!currentProject || currentProject === "All Projects") {
			new Notice("Please select a specific project before creating tasks. You cannot create tasks when 'All Projects' is selected.");
			return;
		}

		const taskDirectory = this.appStateManager.getPersistentState().settings?.taskDirectory || 'Taskdown';
		const templates = await loadTemplates(this.app, taskDirectory);

		const modal = new NewTaskModal(
			this.app,
			this.appStateManager,
			(taskData: NewTaskFormData) => {
				this.appStateManager.emit(PluginEvent.CreateTaskPending, taskData);
			},
			prePopulated,
			templates
		);

		modal.open();
	}
}