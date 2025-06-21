import { App } from "obsidian";
import { IPersistentState, IVolatileState } from "../../interfaces/IAppState";
import { validateDateRange, createStateResult } from "../utils/updateUtils";

export async function updateTimelineViewport(
    app: App, 
    currentPersistent: IPersistentState, 
    currentVolatile: IVolatileState,
    localMinDate: string,
    localMaxDate: string
): Promise<{persistent: IPersistentState, volatile: IVolatileState}> {
    
    validateDateRange(localMinDate, localMaxDate);
    
    return createStateResult(currentPersistent, currentVolatile, undefined, {
        timelineViewport: { localMinDate, localMaxDate }
    });
}