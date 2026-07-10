import { App } from "obsidian";
import { IPersistentState, IVolatileState } from "../../interfaces/IAppState";
import { isValidColor, isValidColorVariable } from "../utils/colorUtils";

function stateResult(
    persistent: IPersistentState,
    volatile: IVolatileState,
    persistentUpdates: Partial<IPersistentState>
): { persistent: IPersistentState, volatile: IVolatileState } {
    return { persistent: { ...persistent, ...persistentUpdates }, volatile };
}

export async function updateColorMappings(
    app: App, 
    currentPersistent: IPersistentState, 
    currentVolatile: IVolatileState,
    projectId: string,
    variable: string, 
    level: string, 
    color: string
): Promise<{persistent: IPersistentState, volatile: IVolatileState}> {
    
    if (!isValidColorVariable(variable)) {
        throw new Error(`Invalid color variable: ${variable}`);
    }
    
    if (!isValidColor(color)) {
        throw new Error(`Invalid color: ${color}`);
    }
    
    const colorMappings = { ...currentPersistent.colorMappings || {} };
    
    if (!colorMappings[projectId]) {
        colorMappings[projectId] = {};
    }
    
    if (!colorMappings[projectId][variable]) {
        colorMappings[projectId][variable] = {};
    }
    
    colorMappings[projectId][variable][level] = color;
    
    return stateResult(currentPersistent, currentVolatile, { colorMappings });
}

export async function updateColorVariable(
    app: App,
    currentPersistent: IPersistentState, 
    currentVolatile: IVolatileState,
    variable: string
): Promise<{persistent: IPersistentState, volatile: IVolatileState}> {
    
    if (!isValidColorVariable(variable)) {
        throw new Error(`Invalid color variable: ${variable}`);
    }
    
    return stateResult(currentPersistent, currentVolatile, { colorVariable: variable });
}