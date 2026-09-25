import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import TaskTimelinePlugin from "../main";
import { AppStateManager } from "../core/AppStateManager";
import { PluginEvent } from "../enums/events";
import { ITaskTimelineSettings } from "../interfaces/ITaskTimelineSettings";
import { getAvailableBackgrounds } from "../core/utils/colorUtils";
import { DEFAULT_TASK_TIMELINE_SETTINGS } from "./defaultSettings";
import { DEFAULT_TEMPLATE_FILE_NAMES, resetDefaultTemplates } from "../core/utils/templateUtils";

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

		// Both settings below rebuild the task index when changed, so they
		// commit on blur/Enter — not per keystroke, where every intermediate
		// prefix would trigger a rebuild and reset the selected project.
		new Setting(containerEl)
			.setName("Task Directory")
			.setDesc("Directory containing task markdown files")
			.addText(text => {
				text.setPlaceholder("Taskdown").setValue(settings.taskDirectory);
				const commit = async () => {
					const normalized = text.getValue().trim().replace(/^\/+|\/+$/g, "");
					text.setValue(normalized);
					if (normalized && normalized !== this.getSettings().taskDirectory) {
						await this.updateSetting("taskDirectory", normalized);
					}
				};
				text.inputEl.addEventListener("blur", commit);
				text.inputEl.addEventListener("keydown", (e) => {
					if (e.key === "Enter") text.inputEl.blur();
				});
			});

		new Setting(containerEl)
			.setName("Ignore list")
			.setDesc("Paths excluded from the timeline. One pattern per line, matched against whole path segments at any depth. Use * to match within a folder and ** to match across folders (e.g. templates/, .claude/, archive/**).")
			.addTextArea(text => {
				text.inputEl.rows = 4;
				text.inputEl.style.width = "100%";
				text.setPlaceholder("templates/\n.claude/");
				text.setValue((settings.ignorePatterns ?? []).join("\n"));
				text.inputEl.addEventListener("blur", async () => {
					const patterns = text.getValue().split("\n").map(s => s.trim()).filter(Boolean);
					if (patterns.join("\n") !== (this.getSettings().ignorePatterns ?? []).join("\n")) {
						await this.updateSetting("ignorePatterns", patterns);
					}
				});
			});

		new Setting(containerEl)
			.setName("Open by default")
			.setDesc("Automatically open Task Timeline when Obsidian starts")
			.addToggle(toggle => toggle
				.setValue(settings.openByDefault)
				.onChange(async (value) => {
					await this.updateSetting("openByDefault", value);
				}));

		new Setting(containerEl)
			.setName("Open in new pane")
			.setDesc("Open Task Timeline in a new pane instead of current tab")
			.addToggle(toggle => toggle
				.setValue(settings.openInNewPane)
				.onChange(async (value) => {
					await this.updateSetting("openInNewPane", value);
				}));

		this.addIntSetting(containerEl, settings, "rowHeight", "Row height (px)",
			"Height of task cards in pixels", DEFAULT_TASK_TIMELINE_SETTINGS.rowHeight);

		// --- Zoom Settings ---
		containerEl.createEl('h3', { text: 'Zoom' });

		this.addIntSetting(containerEl, settings, "minColWidth", "Min column width (px)",
			"Narrowest column width before switching to coarser time unit", DEFAULT_TASK_TIMELINE_SETTINGS.minColWidth);

		this.addIntSetting(containerEl, settings, "maxColWidth", "Max column width (px)",
			"Widest column width before switching to finer time unit", DEFAULT_TASK_TIMELINE_SETTINGS.maxColWidth);

		this.addIntSetting(containerEl, settings, "zoomStep", "Zoom step (px)",
			"Pixels added/removed per scroll tick", DEFAULT_TASK_TIMELINE_SETTINGS.zoomStep);

		this.addIntSetting(containerEl, settings, "minFontSize", "Min font size (px)",
			"Smallest card font at narrowest column width", DEFAULT_TASK_TIMELINE_SETTINGS.minFontSize);

		this.addIntSetting(containerEl, settings, "maxFontSize", "Max font size (px)",
			"Largest card font at widest column width", DEFAULT_TASK_TIMELINE_SETTINGS.maxFontSize);

		// Default Card Color Setting with color preview
		const backgroundColors = getAvailableBackgrounds();
		const colorSetting = new Setting(containerEl)
			.setName("Default card color")
			.setDesc("Background color for cards and buttons");

		const colorPreview = document.createElement("div");
		colorPreview.style.cssText = `
			width: 24px;
			height: 24px;
			border-radius: 4px;
			border: 1px solid var(--background-modifier-border);
			margin-right: 8px;
			flex-shrink: 0;
		`;
		colorPreview.style.backgroundColor = settings.defaultCardColor || DEFAULT_TASK_TIMELINE_SETTINGS.defaultCardColor;

		colorSetting.addDropdown(dropdown => {
			backgroundColors.forEach(({ name, value }) => {
				dropdown.addOption(value, name);
			});
			dropdown.setValue(settings.defaultCardColor || DEFAULT_TASK_TIMELINE_SETTINGS.defaultCardColor);
			dropdown.onChange(async (value) => {
				colorPreview.style.backgroundColor = value;
				await this.updateSetting("defaultCardColor", value);
			});

			const dropdownEl = dropdown.selectEl;
			dropdownEl.parentElement?.insertBefore(colorPreview, dropdownEl);
		});

		this.addResetTemplatesSetting(containerEl, settings.taskDirectory);

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

	/**
	 * Rewrites the built-in templates in {taskDirectory}/templates/. It
	 * discards edits to those files, so the button asks for a second click.
	 */
	private addResetTemplatesSetting(containerEl: HTMLElement, taskDirectory: string): void {
		const fileList = DEFAULT_TEMPLATE_FILE_NAMES.join(", ");
		new Setting(containerEl)
			.setName("Reset templates")
			.setDesc(`Rewrite ${fileList} in ${taskDirectory}/templates/ with the built-in versions. Your own template_*.md files are not touched.`)
			.addButton(button => {
				const idleText = "Reset templates";
				let confirmTimer: number | null = null;
				const disarm = () => {
					if (confirmTimer !== null) window.clearTimeout(confirmTimer);
					confirmTimer = null;
					button.setButtonText(idleText);
					button.buttonEl.removeClass("mod-warning");
				};

				button.setButtonText(idleText).onClick(async () => {
					if (confirmTimer === null) {
						button.setButtonText("Click again to overwrite").setWarning();
						confirmTimer = window.setTimeout(disarm, 4000);
						return;
					}
					disarm();
					try {
						await resetDefaultTemplates(this.app, this.getSettings().taskDirectory);
						new Notice("Templates reset to defaults");
					} catch (error) {
						console.error("TaskTimeline: Failed to reset templates", error);
						new Notice("Failed to reset templates — see console for details.");
					}
				});
			});
	}

	private getSettings(): ITaskTimelineSettings {
		const persistentState = this.appStateManager.getPersistentState();
		return persistentState.settings || this.getDefaultSettings();
	}

	private getDefaultSettings(): ITaskTimelineSettings {
		return { ...DEFAULT_TASK_TIMELINE_SETTINGS };
	}

	private addIntSetting(
		containerEl: HTMLElement,
		settings: ITaskTimelineSettings,
		key: keyof ITaskTimelineSettings,
		name: string,
		desc: string,
		fallback: number
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText(text => {
				text.inputEl.type = "number";
				text.inputEl.style.width = "60px";
				text.setValue(String(settings[key] ?? fallback));
				text.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed)) {
						await this.updateSetting(key, parsed);
					}
				});
			});
	}

	private async updateSetting(key: keyof ITaskTimelineSettings, value: any): Promise<void> {
		const currentSettings = this.getSettings();
		const newSettings = { ...currentSettings, [key]: value };
		this.appStateManager.emit(PluginEvent.UpdateSettingsPending, newSettings);
	}

	private async resetToDefaults(): Promise<void> {
		const defaultSettings = this.getDefaultSettings();
		this.appStateManager.emit(PluginEvent.UpdateSettingsPending, defaultSettings);
	}
}
