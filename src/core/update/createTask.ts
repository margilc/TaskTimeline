import { App, TFolder } from "obsidian";
import { IAppState } from "../../interfaces/IAppState";
import { NewTaskFormData } from "../../components/NewTaskModal";

export async function createTask(app: App, state: IAppState, taskData: NewTaskFormData): Promise<IAppState> {
	const settings = state.persistent.settings;
	const baseTaskDirectory = settings?.taskDirectory || "Taskdown";
	const currentProject = state.persistent.currentProjectName;
	
	// Check if a project is selected
	if (!currentProject || currentProject === "All Projects") {
		throw new Error("Please select a specific project before creating tasks. You cannot create tasks when 'All Projects' is selected.");
	}
	
	// Determine the target directory
	const targetDirectory = `${baseTaskDirectory}/${currentProject}`;
	
	// Ensure project directory exists
	const projectFolder = app.vault.getAbstractFileByPath(targetDirectory);
	if (!projectFolder) {
		throw new Error(`Project directory '${currentProject}' not found. Please ensure the project folder exists in ${baseTaskDirectory}.`);
	}
	
	// Generate unique filename using start date and task name
	const startDate = new Date(taskData.start);
	const datePrefix = startDate.toISOString().split('T')[0].replace(/-/g, '');
	const safeName = taskData.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
	const identifier = safeName.slice(0, 20);
	
	let filename = `${datePrefix}_${identifier}.md`;
	let counter = 1;
	
	// Ensure filename is unique
	while (app.vault.getAbstractFileByPath(`${targetDirectory}/${filename}`)) {
		filename = `${datePrefix}_${identifier}_${counter}.md`;
		counter++;
	}
	
	// Create YAML frontmatter
	const frontmatter = {
		name: taskData.name,
		start: taskData.start,
		...(taskData.end && { end: taskData.end }),
		...(taskData.category && { category: taskData.category }),
		...(taskData.status && { status: taskData.status }),
		priority: taskData.priority || "5"  // Always include priority, default to 5
	};
	
	// Create markdown content
	const yamlContent = Object.entries(frontmatter)
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	
	const content = `---
${yamlContent}
---

# ${taskData.name}

Task description and notes go here.

## Subtasks
- [ ] Add your subtasks here
`;
	
	// Create the file
	const filePath = `${targetDirectory}/${filename}`;
	try {
		await app.vault.create(filePath, content);
	} catch (error) {
		if (error.message?.includes('already exists')) {
			throw new Error(`A file named ${filename} already exists.`);
		} else if (error.message?.includes('permission')) {
			throw new Error(`Permission denied. Check write access to ${targetDirectory}.`);
		} else {
			throw new Error(`Failed to create task file: ${error.message || 'Unknown error'}`);
		}
	}
	
	// Return unchanged state (task will be picked up by vault events)
	return state;
}