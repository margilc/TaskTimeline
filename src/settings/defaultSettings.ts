import { DEFAULT_COLOR } from "../core/utils/colorUtils";
import { ITaskTimelineSettings } from "../interfaces/ITaskTimelineSettings";

export const DEFAULT_TASK_TIMELINE_SETTINGS: ITaskTimelineSettings = {
	taskDirectory: "Taskdown",
	openByDefault: true,
	openInNewPane: false,
	rowHeight: 40,
	defaultCardColor: DEFAULT_COLOR,
	minColWidth: 100,
	maxColWidth: 300,
	zoomStep: 25,
	minFontSize: 8,
	maxFontSize: 14,
};
