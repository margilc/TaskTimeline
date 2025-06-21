import { App } from "obsidian";
import { IPersistentState, IVolatileState } from "../../interfaces/IAppState";
import { TimeUnit } from "../../enums/TimeUnit";
import { generateMinimapData, ITask } from "../utils/minimapUtils";

export async function updateMinimapData(
    app: App, 
    currentPersistent: IPersistentState, 
    currentVolatile: IVolatileState,
    tasks: ITask[]
): Promise<{persistent: IPersistentState, volatile: IVolatileState}> {
    
    const timeUnit = currentPersistent.currentTimeUnit || TimeUnit.DAY;
    const settings = currentPersistent.settings;
    
    if (!settings?.globalMinDate || !settings?.globalMaxDate || 
        !currentVolatile.globalMinDateSnapped || !currentVolatile.globalMaxDateSnapped) {
        const newVolatile = { ...currentVolatile };
        newVolatile.minimapData = [];
        return {
            persistent: currentPersistent,
            volatile: newVolatile
        };
    }
    
    const globalMinDateSnapped = new Date(currentVolatile.globalMinDateSnapped);
    const globalMaxDateSnapped = new Date(currentVolatile.globalMaxDateSnapped);
    const globalMinDate = new Date(settings.globalMinDate);
    const globalMaxDate = new Date(settings.globalMaxDate);
    const minimapData = generateMinimapData(tasks, timeUnit, globalMinDateSnapped, globalMaxDateSnapped, globalMinDate, globalMaxDate);
    
    const newVolatile = { ...currentVolatile };
    newVolatile.minimapData = minimapData;
    
    return {
        persistent: currentPersistent,
        volatile: newVolatile
    };
}