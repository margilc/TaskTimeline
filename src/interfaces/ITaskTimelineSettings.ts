export interface ITaskTimelineSettings {
	taskDirectory: string;
	openByDefault: boolean;
	openInNewPane: boolean;
	numberOfColumns: number;
	columnWidth: number;
	numberOfRows: number;
	rowHeight: number;
	globalMinDate: string; // ISO string format
	globalMaxDate: string; // ISO string format
}