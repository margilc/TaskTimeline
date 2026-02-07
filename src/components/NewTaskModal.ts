import { App, Modal, Setting, Notice } from "obsidian";
import { AppStateManager } from "../core/AppStateManager";
import { ITemplate } from "../interfaces/ITemplate";

export interface NewTaskFormData {
	name: string;
	category?: string;
	status?: string;
	priority?: string;
	start: string;
	end?: string;
	templateContent?: string;
}

export class NewTaskModal extends Modal {
	private appStateManager: AppStateManager;
	private formData: NewTaskFormData;
	private onSubmit: (data: NewTaskFormData) => void;
	private templates: ITemplate[];
	private selectedTemplate: ITemplate | null = null;
	private defaultLengthDays: number = 7;

	constructor(
		app: App,
		appStateManager: AppStateManager,
		onSubmit: (data: NewTaskFormData) => void,
		prePopulated?: Partial<NewTaskFormData>,
		templates?: ITemplate[]
	) {
		super(app);
		this.appStateManager = appStateManager;
		this.onSubmit = onSubmit;
		this.templates = templates || [];

		const startDate = new Date();
		const endDate = new Date(startDate);
		endDate.setDate(startDate.getDate() + 7);

		this.formData = {
			name: "",
			category: "default",
			status: "default",
			priority: "5",
			start: startDate.toISOString().split('T')[0],
			end: endDate.toISOString().split('T')[0],
			...prePopulated
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Create New Task" });

		// Template picker (only if templates exist)
		if (this.templates.length > 0) {
			new Setting(contentEl)
				.setName("Template")
				.setDesc("Select a template to pre-fill fields")
				.addDropdown(dropdown => {
					dropdown.addOption("none", "None");
					for (const t of this.templates) {
						dropdown.addOption(t.name, t.name);
					}
					dropdown.onChange(value => {
						this.applyTemplate(value);
						// Re-render the form to reflect updated values
						this.onOpen();
					});
				});
		}

		// Task Name (required)
		new Setting(contentEl)
			.setName("Task name")
			.setDesc("Required. The title of the task")
			.addText(text => text
				.setPlaceholder("Enter task name...")
				.setValue(this.formData.name)
				.onChange(value => {
					this.formData.name = value;
					this.updateSubmitButton();
				}));

		// Start Date (required)
		let endDateInput: HTMLInputElement;
		new Setting(contentEl)
			.setName("Start date")
			.setDesc("Required. Task start date")
			.addText(text => {
				text.inputEl.type = "date";
				text.setValue(this.formData.start)
					.onChange(value => {
						this.formData.start = value;
						if (value && this.isValidDate(value)) {
							const startDate = new Date(value);
							const endDate = new Date(startDate);
							endDate.setDate(startDate.getDate() + this.defaultLengthDays);
							this.formData.end = endDate.toISOString().split('T')[0];
							if (endDateInput) {
								endDateInput.value = this.formData.end;
							}
						}
						this.updateSubmitButton();
					});
			});

		// End Date (optional)
		new Setting(contentEl)
			.setName("End date")
			.setDesc("Optional. Task end date")
			.addText(text => {
				text.inputEl.type = "date";
				endDateInput = text.inputEl;
				text.setValue(this.formData.end || "")
					.onChange(value => {
						this.formData.end = value || undefined;
					});
			});

		// Category (optional)
		new Setting(contentEl)
			.setName("Category")
			.setDesc("Optional. Task category")
			.addText(text => text
				.setPlaceholder("Enter category...")
				.setValue(this.formData.category || "")
				.onChange(value => {
					this.formData.category = value || undefined;
				}));

		// Status (optional)
		new Setting(contentEl)
			.setName("Status")
			.setDesc("Optional. Task status")
			.addText(text => text
				.setPlaceholder("Enter status...")
				.setValue(this.formData.status || "")
				.onChange(value => {
					this.formData.status = value || undefined;
				}));

		// Priority (optional)
		new Setting(contentEl)
			.setName("Priority")
			.setDesc("Optional. Task priority (1-5, where 5 is highest)")
			.addText(text => text
				.setPlaceholder("Enter priority (1-5)...")
				.setValue(this.formData.priority || "")
				.onChange(value => {
					this.formData.priority = value || undefined;
					this.updateSubmitButton();
				}));

		// Submit and Cancel buttons
		const buttonContainer = contentEl.createDiv("modal-button-container");

		const submitButton = buttonContainer.createEl("button", {
			text: "Create Task",
			cls: "mod-cta"
		});
		submitButton.addEventListener("click", this.handleSubmit.bind(this));

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel"
		});
		cancelButton.addEventListener("click", () => this.close());

		this.updateSubmitButton();
	}

	private applyTemplate(templateName: string): void {
		if (templateName === "none") {
			this.selectedTemplate = null;
			this.defaultLengthDays = 7;
			this.formData.category = "default";
			this.formData.status = "default";
			this.formData.priority = "5";
			this.formData.templateContent = undefined;
		} else {
			const template = this.templates.find(t => t.name === templateName);
			if (!template) return;
			this.selectedTemplate = template;
			this.defaultLengthDays = template.defaultLengthDays || 7;
			if (template.defaultCategory) this.formData.category = template.defaultCategory;
			if (template.defaultStatus) this.formData.status = template.defaultStatus;
			if (template.defaultPriority) this.formData.priority = String(template.defaultPriority);
			if (template.bodyContent) this.formData.templateContent = template.bodyContent;
		}

		// Recompute end date from current start + new length
		if (this.formData.start && this.isValidDate(this.formData.start)) {
			const startDate = new Date(this.formData.start);
			const endDate = new Date(startDate);
			endDate.setDate(startDate.getDate() + this.defaultLengthDays);
			this.formData.end = endDate.toISOString().split('T')[0];
		}
	}

	private updateSubmitButton(): void {
		const submitButton = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
		if (submitButton) {
			const isValid = this.validateForm();
			submitButton.disabled = !isValid;
			submitButton.style.opacity = isValid ? "1" : "0.5";
		}
	}

	private validateForm(): boolean {
		if (!this.formData.name.trim()) return false;
		if (!this.formData.start.trim()) return false;
		if (!this.isValidDate(this.formData.start)) return false;
		if (this.formData.end && !this.isValidDate(this.formData.end)) return false;
		if (this.formData.end && new Date(this.formData.start) >= new Date(this.formData.end)) return false;

		// Validate priority if provided
		if (this.formData.priority) {
			const priority = parseInt(this.formData.priority, 10);
			if (isNaN(priority) || priority < 1 || priority > 5) return false;
		}

		return true;
	}

	private isValidDate(dateString: string): boolean {
		const regex = /^\d{4}-\d{2}-\d{2}$/;
		if (!regex.test(dateString)) return false;

		const date = new Date(dateString);
		return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
	}

	private handleSubmit(): void {
		if (!this.validateForm()) {
			new Notice("Please fill in all required fields with valid data");
			return;
		}

		this.onSubmit(this.formData);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
