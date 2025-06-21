import { DropdownComponent } from 'obsidian';
import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';
import { COLOR_VARIABLES, getAvailableColors, DEFAULT_COLOR, HIDE_COLOR, HIDE_VALUE } from '../../core/utils/colorUtils';

export class NavColorMapSelection {
    private container: HTMLElement;
    private appStateManager: AppStateManager;
    private variableDropdown: DropdownComponent;
    private colorPickersContainer: HTMLElement;

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateTasksDone, this.render.bind(this));
        this.appStateManager.getEvents().on(PluginEvent.UpdateColorMappingsDone, this.render.bind(this));
    }

    private render(): void {
        this.container.empty();
        this.container.addClass('nav-color-map-selection');

        const controlsContainer = this.container.createDiv('nav-color-map-controls');
        
        this.createVariableDropdown(controlsContainer);
        this.createColorPickersContainer(controlsContainer);
        this.updateColorPickers();
    }

    private createVariableDropdown(parent: HTMLElement): void {
        const dropdownContainer = parent.createDiv('nav-dropdown-container');
        
        this.variableDropdown = new DropdownComponent(dropdownContainer);
        
        COLOR_VARIABLES.forEach(variable => {
            this.variableDropdown.addOption(variable, `Color Variable: ${variable}`);
        });
        
        const currentVariable = this.appStateManager.getState().persistent.colorVariable || 'none';
        this.variableDropdown.setValue(currentVariable);
        
        this.variableDropdown.selectEl.style.minWidth = "180px";
        
        this.variableDropdown.onChange((value) => {
            this.appStateManager.getEvents().trigger(PluginEvent.UpdateColorMappingsPending, {
                type: 'variable',
                variable: value
            });
        });
    }

    private createColorPickersContainer(parent: HTMLElement): void {
        this.colorPickersContainer = parent.createDiv('nav-value-color-pickers');
    }

    private updateColorPickers(): void {
        this.colorPickersContainer.empty();
        
        const state = this.appStateManager.getState();
        const currentVariable = state.persistent.colorVariable || 'none';
        
        if (currentVariable === 'none') {
            return;
        }
        
        const levels = this.appStateManager.getAvailableLevels(currentVariable);
        const currentProject = state.persistent.currentProjectName || 'All Projects';
        
        levels.forEach(level => {
            this.createColorPickerDropdown(level, currentProject, currentVariable);
        });
    }

    private createColorPickerDropdown(level: string, projectId: string, variable: string): void {
        const dropdownContainer = this.colorPickersContainer.createDiv('nav-dropdown-container');
        
        // Create a wrapper that will contain both the swatch and the dropdown
        const dropdownWrapper = dropdownContainer.createDiv('nav-color-dropdown-wrapper');
        
        // Create the color swatch
        const colorSwatch = dropdownWrapper.createDiv('nav-color-swatch-indicator');
        
        // Create the dropdown in the wrapper
        const dropdown = new DropdownComponent(dropdownWrapper);
        
        const availableColors = getAvailableColors();
        const currentColor = this.appStateManager.getColorForLevel(projectId, variable, level);
        
        // Add all color options
        availableColors.forEach(({ name, value }) => {
            dropdown.addOption(value, name);
        });
        
        // Add special options
        dropdown.addOption(HIDE_VALUE, 'HIDE');
        dropdown.addOption(DEFAULT_COLOR, 'Default (White)');
        
        // Set current value
        dropdown.setValue(currentColor);
        
        // Add level label as prefix to dropdown text
        const selectElement = dropdown.selectEl;
        selectElement.addClass('nav-color-value-select');
        selectElement.setAttribute('data-level', level);
        
        // Update the display to show level name and color swatch
        this.updateDropdownDisplay(dropdown, level, currentColor, colorSwatch);
        
        dropdown.onChange((value) => {
            this.updateColorMapping(projectId, variable, level, value);
            this.updateDropdownDisplay(dropdown, level, value, colorSwatch);
        });
    }

    private updateDropdownDisplay(dropdown: DropdownComponent, level: string, currentColor: string, colorSwatch: HTMLElement): void {
        const selectElement = dropdown.selectEl;
        
        // Update the selected option to show just the level name
        const options = Array.from(selectElement.options);
        options.forEach(option => {
            if (option.value === currentColor) {
                option.text = level;
                option.selected = true;
            } else {
                // Reset other options to their color names for the dropdown menu
                const availableColors = getAvailableColors();
                const colorInfo = availableColors.find(c => c.value === option.value);
                if (colorInfo) {
                    option.text = colorInfo.name;
                } else if (option.value === HIDE_VALUE) {
                    option.text = 'HIDE';
                } else if (option.value === DEFAULT_COLOR) {
                    option.text = 'Default (White)';
                }
            }
        });
        
        // Update the color swatch
        this.updateColorSwatch(colorSwatch, currentColor);
    }

    private updateColorSwatch(colorSwatch: HTMLElement, currentColor: string): void {
        if (currentColor === HIDE_VALUE) {
            colorSwatch.style.backgroundColor = HIDE_COLOR;
            colorSwatch.addClass('hidden-swatch');
        } else {
            colorSwatch.style.backgroundColor = currentColor;
            colorSwatch.removeClass('hidden-swatch');
        }
    }


    private updateColorMapping(projectId: string, variable: string, level: string, color: string): void {
        this.appStateManager.getEvents().trigger(PluginEvent.UpdateColorMappingsPending, {
            type: 'mapping',
            projectId,
            variable,
            level,
            color
        });
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateTasksDone, this.render.bind(this));
        this.appStateManager.getEvents().off(PluginEvent.UpdateColorMappingsDone, this.render.bind(this));
    }
}