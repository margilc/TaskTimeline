import { IAppState } from "../../interfaces/IAppState";
import { ITaskTimelineSettings } from "../../interfaces/ITaskTimelineSettings";

export function updateSettings(app: any, state: IAppState, newSettings: ITaskTimelineSettings): IAppState {
	return {
		...state,
		persistent: {
			...state.persistent,
			settings: newSettings
		}
	};
}