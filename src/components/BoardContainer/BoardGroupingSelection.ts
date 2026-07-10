import { AppStateManager } from "../../core/AppStateManager";
import { PluginEvent } from "../../enums/events";
import { getGroupingOptions, getGroupingLabel } from "../../core/update/updateBoardGrouping";
import { CustomDropdown } from "../common/CustomDropdown";

/**
 * Grouping dropdown for the board header's first column. One instance lives
 * for the whole BoardContainer lifetime and is re-attached on each header
 * rebuild — creating it per render leaked its events listener and the
 * dropdown's document-level click handler on every render.
 */
export class BoardGroupingSelection {
    private readonly element: HTMLElement;
    private readonly dropdown: CustomDropdown;
    private readonly appStateManager: AppStateManager;
    private readonly boundSync = this.sync.bind(this);

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;
        this.element = document.createElement("div");
        this.element.className = "board-grouping-selection";

        const options = getGroupingOptions().map(option => ({
            value: option,
            label: getGroupingLabel(option)
        }));

        this.dropdown = new CustomDropdown(this.element, {
            options,
            value: appStateManager.getState().persistent.boardGrouping?.groupBy || 'none',
            onChange: (selectedValue) => {
                appStateManager.getEvents().trigger(PluginEvent.UpdateBoardGroupingPending, { groupBy: selectedValue });
            }
        });

        appStateManager.getEvents().on(PluginEvent.UpdateBoardGroupingDone, this.boundSync);
    }

    private sync(): void {
        const grouping = this.appStateManager.getState().persistent.boardGrouping?.groupBy || 'none';
        if (this.dropdown.getValue() !== grouping) {
            this.dropdown.setValue(grouping);
        }
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateBoardGroupingDone, this.boundSync);
        this.dropdown.destroy();
    }
}
