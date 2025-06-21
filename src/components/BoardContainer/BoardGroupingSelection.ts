import { AppStateManager } from "../../core/AppStateManager";
import { DropdownComponent } from "obsidian";
import { PluginEvent } from "../../enums/events";
import { getGroupingOptions, getGroupingLabel } from "../../core/update/updateBoardGrouping";

export function BoardGroupingSelection(appStateManager: AppStateManager): HTMLElement {
    const container = document.createElement("div");
    container.className = "board-grouping-selection";

    // Use DropdownComponent
    const dropdown = new DropdownComponent(container);

    // Add options using getGroupingOptions helper
    const options = getGroupingOptions();
    options.forEach(option => {
        dropdown.addOption(option, getGroupingLabel(option));
    });

    // Set initial value from AppStateManager
    const state = appStateManager.getState();
    const currentGrouping = state.persistent.boardGrouping?.groupBy || 'none';
    dropdown.setValue(currentGrouping);

    // Add change listener using AppStateManager events
    dropdown.onChange((selectedValue) => {
        appStateManager.getEvents().trigger(PluginEvent.UpdateBoardGroupingPending, { groupBy: selectedValue });
    });

    // Listen for grouping changes to update dropdown
    appStateManager.getEvents().on(PluginEvent.UpdateBoardGroupingDone, () => {
        const newState = appStateManager.getState();
        const newGrouping = newState.persistent.boardGrouping?.groupBy || 'none';
        if (dropdown.getValue() !== newGrouping) {
            dropdown.setValue(newGrouping);
        }
    });

    // Apply styling class
    dropdown.selectEl.addClass("board-grouping-select");

    return container;
} 