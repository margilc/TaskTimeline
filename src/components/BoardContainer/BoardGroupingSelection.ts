import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";
import { getGroupingOptions, getGroupingLabel } from "../../core/update/updateBoardGrouping";
import { CustomDropdown } from "../common/CustomDropdown";

export function BoardGroupingSelection(appStateManager: AppStateManager): HTMLElement {
    const container = document.createElement("div");
    container.className = "board-grouping-selection";

    const options = getGroupingOptions().map(option => ({
        value: option,
        label: getGroupingLabel(option)
    }));

    const state = appStateManager.getState();
    const currentGrouping = state.persistent.boardGrouping?.groupBy || 'none';

    const dropdown = new CustomDropdown(container, {
        options,
        value: currentGrouping,
        onChange: (selectedValue) => {
            appStateManager.getEvents().trigger(PluginEvent.UpdateBoardGroupingPending, { groupBy: selectedValue });
        }
    });

    // Listen for grouping changes to update dropdown
    appStateManager.getEvents().on(PluginEvent.UpdateBoardGroupingDone, () => {
        const newState = appStateManager.getState();
        const newGrouping = newState.persistent.boardGrouping?.groupBy || 'none';
        if (dropdown.getValue() !== newGrouping) {
            dropdown.setValue(newGrouping);
        }
    });

    return container;
}
