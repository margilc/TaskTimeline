export interface ITaskTimelineSettings {
	taskDirectory: string;
	/**
	 * Path patterns (one per entry) excluded from task discovery. Matched
	 * against vault-relative paths with simple glob semantics (* and **).
	 * See {@link isPathIgnored} in core/utils/ignoreUtils.
	 */
	ignorePatterns: string[];
	openByDefault: boolean;
	openInNewPane: boolean;
	rowHeight: number;
	defaultCardColor: string;
	minColWidth: number;
	maxColWidth: number;
	zoomStep: number;
	minFontSize: number;
	maxFontSize: number;
}
