import { App } from "obsidian";
import { IPersistentState, IVolatileState } from "../../interfaces/IAppState";
import { TimeUnit } from "../../enums/TimeUnit";

const VALID_TIME_UNITS = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];

export async function updateTimeUnit(
    app: App, 
    currentPersistent: IPersistentState, 
    currentVolatile: IVolatileState,
    timeUnit: string
): Promise<{persistent: IPersistentState, volatile: IVolatileState}> {
    
    if (!VALID_TIME_UNITS.includes(timeUnit as TimeUnit)) {
        throw new Error(`Invalid time unit: ${timeUnit}. Valid values are: ${VALID_TIME_UNITS.join(', ')}`);
    }
    
    const newPersistent = { ...currentPersistent };
    newPersistent.currentTimeUnit = timeUnit;
    
    // Clear the timelineViewport when time unit changes to force recalculation with proper defaults
    const newVolatile = { ...currentVolatile };
    newVolatile.timelineViewport = undefined;
    
    return {
        persistent: newPersistent,
        volatile: newVolatile
    };
}