import { App, Modal, Setting, Notice } from "obsidian";
import { AppStateManager } from "../core/AppStateManager";

export interface NewTaskFormData {
	name: string;
	category?: string;
	status?: string;
	priority?: string;
	start: string;
	end?: string;
}

export class NewTaskModal extends Modal {
	private appStateManager: AppStateManager;
	private formData: NewTaskFormData;
	private onSubmit: (data: NewTaskFormData) => void;

	constructor(app: App, appStateManager: AppStateManager, onSubmit: (data: NewTaskFormData) => void, prePopulated?: Partial<NewTaskFormData>) {
		super(app);
		this.appStateManager = appStateManager;
		this.onSubmit = onSubmit;
		
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
						// Auto-update end date to one week later
						if (value && this.isValidDate(value)) {
							const startDate = new Date(value);
							const endDate = new Date(startDate);
							endDate.setDate(startDate.getDate() + 7);
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