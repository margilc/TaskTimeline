import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import TaskTimelinePlugin from "../main";
import { AppStateManager } from "../core/AppStateManager";
import { ITaskTimelineSettings } from "../interfaces/ITaskTimelineSettings";
import { getAvailableBackgrounds, DEFAULT_COLOR } from "../core/utils/colorUtils";

export class TaskTimelineSettingTab extends PluginSettingTab {
	plugin: TaskTimelinePlugin;
	appStateManager: AppStateManager;

	constructor(app: App, plugin: TaskTimelinePlugin, appStateManager: AppStateManager) {
		super(app, plugin);
		this.plugin = plugin;
		this.appStateManager = appStateManager;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const settings = this.getSettings();

		// Task Directory Setting
		new Setting(containerEl)
			.setName("Task Directory")
			.setDesc("Directory containing task markdown files")
			.addText(text => text
				.setPlaceholder("Taskdown")
				.setValue(settings.taskDirectory)
				.onChange(async (value) => {
					await this.updateSetting("taskDirectory", value);
				}));

		// Open By Default Setting
		new Setting(containerEl)
			.setName("Open by default")
			.setDesc("Automatically open Task Timeline when Obsidian starts")
			.addToggle(toggle => toggle
				.setValue(settings.openByDefault)
				.onChange(async (value) => {
					await this.updateSetting("openByDefault", value);
				}));

		// Open In New Pane Setting
		new Setting(containerEl)
			.setName("Open in new pane")
			.setDesc("Open Task Timeline in a new pane instead of current tab")
			.addToggle(toggle => toggle
				.setValue(settings.openInNewPane)
				.onChange(async (value) => {
					await this.updateSetting("openInNewPane", value);
				}));

		// Number of Columns Setting
		new Setting(containerEl)
			.setName("Number of columns")
			.setDesc("Number of columns to display in board view (3-10)")
			.addSlider(slider => slider
				.setLimits(3, 10, 1)
				.setValue(settings.numberOfColumns)
				.setDynamicTooltip()
				.onChange(async (value) => {
					await this.updateSetting("numberOfColumns", value);
				}));

		// Column Width Setting
		new Setting(containerEl)
			.setName("Column width")
			.setDesc("Width of each column in pixels (150-400)")
			.addSlider(slider => slider
				.setLimits(150, 400, 10)
				.setValue(settings.columnWidth)
				.setDynamicTooltip()
				.onChange(async (value) => {
					await this.updateSetting("columnWidth", value);
				}));

		// Row Height Setting
		new Setting(containerEl)
			.setName("Row height")
			.setDesc("Height of task cards in pixels (60-120)")
			.addSlider(slider => slider
				.setLimits(60, 120, 5)
				.setValue(settings.rowHeight)
				.setDynamicTooltip()
				.onChange(async (value) => {
					await this.updateSetting("rowHeight", value);
				}));

		// Global Min Date Setting
		new Setting(containerEl)
			.setName("Timeline start date")
			.setDesc("Earliest date to show in timeline")
			.addText(text => {
				text.inputEl.type = "date";
				text.setValue(settings.globalMinDate)
					.onChange(async (value) => {
						const normalizedDate = this.normalizeDateInput(value);
						if (normalizedDate && this.isValidDate(normalizedDate)) {
							await this.updateSetting("globalMinDate", normalizedDate);
						}
					});
			});

		// Global Max Date Setting
		new Setting(containerEl)
			.setName("Timeline end date")
			.setDesc("Latest date to show in timeline")
			.addText(text => {
				text.inputEl.type = "date";
				text.setValue(settings.globalMaxDate)
					.onChange(async (value) => {
						const normalizedDate = this.normalizeDateInput(value);
						if (normalizedDate && this.isValidDate(normalizedDate)) {
							await this.updateSetting("globalMaxDate", normalizedDate);
						}
					});
			});

		// Default Card Color Setting with color preview
		const backgroundColors = getAvailableBackgrounds();
		const colorSetting = new Setting(containerEl)
			.setName("Default card color")
			.setDesc("Background color for cards and buttons");

		// Add color preview swatch
		const colorPreview = document.createElement("div");
		colorPreview.style.cssText = `
			width: 24px;
			height: 24px;
			border-radius: 4px;
			border: 1px solid var(--background-modifier-border);
			margin-right: 8px;
			flex-shrink: 0;
		`;
		colorPreview.style.backgroundColor = settings.defaultCardColor || DEFAULT_COLOR;

		colorSetting.addDropdown(dropdown => {
			backgroundColors.forEach(({ name, value }) => {
				dropdown.addOption(value, name);
			});
			dropdown.setValue(settings.defaultCardColor || DEFAULT_COLOR);
			dropdown.onChange(async (value) => {
				colorPreview.style.backgroundColor = value;
				await this.updateSetting("defaultCardColor", value);
			});

			// Insert color preview before the dropdown
			const dropdownEl = dropdown.selectEl;
			dropdownEl.parentElement?.insertBefore(colorPreview, dropdownEl);
		});

		// Reset to Defaults Button
		new Setting(containerEl)
			.setName("Reset to defaults")
			.setDesc("Reset all settings to their default values")
			.addButton(button => button
				.setButtonText("Reset")
				.setCta()
				.onClick(async () => {
					await this.resetToDefaults();
					this.display();
					new Notice("Settings reset to defaults");
				}));
	}

	private getSettings(): ITaskTimelineSettings {
		const persistentState = this.appStateManager.getPersistentState();
		return persistentState.settings || this.getDefaultSettings();
	}

	private getDefaultSettings(): ITaskTimelineSettings {
		const currentYear = new Date().getFullYear();
		return {
			taskDirectory: "Taskdown",
			openByDefault: true,
			openInNewPane: false,
			numberOfColumns: 5,
			columnWidth: 200,
			numberOfRows: 3,
			rowHeight: 80,
			globalMinDate: `${currentYear}-01-01`,
			globalMaxDate: `${currentYear}-12-31`,
			defaultCardColor: DEFAULT_COLOR
		};
	}

	private async updateSetting(key: keyof ITaskTimelineSettings, value: any): Promise<void> {
		const currentSettings = this.getSettings();
		const newSettings = { ...currentSettings, [key]: value };
		
		if (this.validateSettings(newSettings)) {
			this.appStateManager.emit("update_settings_pending", newSettings);
		}
	}

	private async resetToDefaults(): Promise<void> {
		const defaultSettings = this.getDefaultSettings();
		this.appStateManager.emit("update_settings_pending", defaultSettings);
	}

	private validateSettings(settings: ITaskTimelineSettings): boolean {
		// Normalize the dates in the settings object before validation
		const normalizedMinDate = this.normalizeDateInput(settings.globalMinDate);
		const normalizedMaxDate = this.normalizeDateInput(settings.globalMaxDate);
		
		if (!normalizedMinDate || !this.isValidDate(normalizedMinDate) || 
		    !normalizedMaxDate || !this.isValidDate(normalizedMaxDate)) {
			new Notice("Invalid date format. Please use YYYY-MM-DD format.");
			return false;
		}
		
		if (new Date(normalizedMinDate) >= new Date(normalizedMaxDate)) {
			new Notice("Start date must be before end date.");
			return false;
		}
		
		return true;
	}

	private normalizeDateInput(dateInput: string): string | null {
		if (!dateInput) return null;
		
		// If already in YYYY-MM-DD format, return as-is
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
			return dateInput;
		}
		
		// If it's an ISO string, extract the date part
		if (dateInput.includes('T') || dateInput.includes('Z')) {
			const date = new Date(dateInput);
			if (!isNaN(date.getTime())) {
				return date.toISOString().split('T')[0];
			}
		}
		
		// If in DD/MM/YYYY format, convert to YYYY-MM-DD
		const ddmmyyyyMatch = dateInput.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
		if (ddmmyyyyMatch) {
			const [, day, month, year] = ddmmyyyyMatch;
			return `${year}-${month}-${day}`;
		}
		
		// Try to parse the date and format it properly
		const date = new Date(dateInput);
		if (!isNaN(date.getTime())) {
			return date.toISOString().split('T')[0];
		}
		
		return null;
	}

	private isValidDate(dateString: string): boolean {
		const regex = /^\d{4}-\d{2}-\d{2}$/;
		if (!regex.test(dateString)) return false;
		
		const date = new Date(dateString);
		return date instanceof Date && !isNaN(date.getTime());
	}
}