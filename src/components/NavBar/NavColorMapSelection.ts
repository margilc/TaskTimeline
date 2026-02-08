import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';
import { COLOR_VARIABLES, getAvailableColors, DEFAULT_COLOR, HIDE_COLOR, HIDE_VALUE } from '../../core/utils/colorUtils';
import { CustomDropdown } from '../common/CustomDropdown';

export class NavColorMapSelection {
    private container: HTMLElement;
    private appStateManager: AppStateManager;
    private colorPickersContainer: HTMLElement;
    private dropdowns: CustomDropdown[] = [];

    // Bound handlers for proper event listener cleanup
    private readonly boundRender = this.render.bind(this);

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateTasksDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateColorMappingsDone, this.boundRender);
    }

    private render(): void {
        // Destroy existing dropdowns before clearing
        this.destroyDropdowns();
        this.container.empty();
        this.container.addClass('nav-color-map-selection');

        const controlsContainer = this.container.createDiv('nav-color-map-controls');

        this.createVariableDropdown(controlsContainer);
        this.createColorPickersContainer(controlsContainer);
        this.updateColorPickers();
    }

    private createVariableDropdown(parent: HTMLElement): void {
        const dropdownContainer = parent.createDiv('nav-dropdown-container');

        const options = COLOR_VARIABLES.map(variable => ({
            value: variable,
            label: `Color Variable: ${variable}`
        }));

        const currentVariable = this.appStateManager.getState().persistent.colorVariable || 'none';

        const dropdown = new CustomDropdown(dropdownContainer, {
            options,
            value: currentVariable,
            onChange: (value) => {
                this.appStateManager.getEvents().trigger(PluginEvent.UpdateColorMappingsPending, {
                    type: 'variable',
                    variable: value
                });
            }
        });

        this.dropdowns.push(dropdown);
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

        const availableColors = getAvailableColors();
        const currentColor = this.appStateManager.getColorForLevel(projectId, variable, level);

        const options = [
            ...availableColors.map(({ name, value }) => ({
                value,
                label: name,
                swatch: value
            })),
            { value: HIDE_VALUE, label: 'HIDE', swatch: HIDE_COLOR },
            { value: DEFAULT_COLOR, label: 'Default (White)' }
        ];

        const dropdown = new CustomDropdown(dropdownContainer, {
            options,
            value: currentColor,
            onChange: (value) => {
                this.updateColorMapping(projectId, variable, level, value);
                dropdown.setTriggerText(level);
            }
        });

        // Show level name as trigger text instead of color name
        dropdown.setTriggerText(level);

        this.dropdowns.push(dropdown);
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

    private destroyDropdowns(): void {
        for (const dropdown of this.dropdowns) {
            dropdown.destroy();
        }
        this.dropdowns = [];
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateTasksDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateColorMappingsDone, this.boundRender);
        this.destroyDropdowns();
    }
}
