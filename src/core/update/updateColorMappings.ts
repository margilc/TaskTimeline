import { App } from "obsidian";
import { IPersistentState, IVolatileState } from "../../interfaces/IAppState";
import { isValidColor, isValidColorVariable } from "../utils/colorUtils";
import { createStateResult } from "../utils/updateUtils";

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
    
    return createStateResult(currentPersistent, currentVolatile, { colorMappings });
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
    
    return createStateResult(currentPersistent, currentVolatile, { colorVariable: variable });
}