import { App } from "obsidian";
import { IPersistentState, IVolatileState } from "../../interfaces/IAppState";
import { validateDateString, createStateResult } from "../utils/updateUtils";

export async function updateCurrentDate(
    app: App, 
    currentPersistent: IPersistentState, 
    currentVolatile: IVolatileState,
    date: string
): Promise<{persistent: IPersistentState, volatile: IVolatileState}> {
    
    validateDateString(date, 'date');
    
    return createStateResult(currentPersistent, currentVolatile, { currentDate: date });
}