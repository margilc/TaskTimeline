import { IPersistentState, IVolatileState } from '../../interfaces/IAppState';

export function createStateResult(
    persistent: IPersistentState, 
    volatile: IVolatileState, 
    persistentUpdates?: Partial<IPersistentState>, 
    volatileUpdates?: Partial<IVolatileState>
): {persistent: IPersistentState, volatile: IVolatileState} {
    return {
        persistent: persistentUpdates ? { ...persistent, ...persistentUpdates } : persistent,
        volatile: volatileUpdates ? { ...volatile, ...volatileUpdates } : volatile
    };
}