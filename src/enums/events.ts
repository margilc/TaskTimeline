export enum PluginEvent {
    AppStateUpdated = 'appStateUpdated',
    ProjectSelected = 'projectSelected',
    ProjectListUpdated = 'projectListUpdated',
    ProjectCreated = 'projectCreated',
    SettingsChanged = 'settingsChanged',
    
    // VaultEventEmitter events following convention-based pattern
    UpdateProjectsPending = 'update_projects_pending',
    UpdateProjectsDone = 'update_projects_done',
    UpdateTasksPending = 'update_tasks_pending',
    UpdateTasksDone = 'update_tasks_done',
    UpdateColorMappingsPending = 'update_colormappings_pending',
    UpdateColorMappingsDone = 'update_colormappings_done',
    UpdateTimeUnitPending = 'update_timeunit_pending',
    UpdateTimeUnitDone = 'update_timeunit_done',
    UpdateCurrentDatePending = 'update_currentdate_pending',
    UpdateCurrentDateDone = 'update_currentdate_done',
    UpdateTimelineViewportPending = 'update_timelineviewport_pending',
    UpdateTimelineViewportDone = 'update_timelineviewport_done',
    UpdateMinimapDataPending = 'update_minimapdata_pending',
    UpdateMinimapDataDone = 'update_minimapdata_done',
    UpdateSnappedDateBoundariesPending = 'update_snappeddateboundaries_pending',
    UpdateSnappedDateBoundariesDone = 'update_snappeddateboundaries_done',
    UpdateLayoutPending = 'update_layout_pending',
    UpdateLayoutDone = 'update_layout_done',
    UpdateBoardGroupingPending = 'update_boardgrouping_pending',
    UpdateBoardGroupingDone = 'update_boardgrouping_done',
    UpdateSettingsPending = 'update_settings_pending',
    UpdateSettingsDone = 'update_settings_done',
    CreateTaskPending = 'create_task_pending',
    CreateTaskDone = 'create_task_done',
    
    // Drag/Drop events
    DragStartPending = 'drag_start_pending',
    DragStartDone = 'drag_start_done',
    DragMovePending = 'drag_move_pending',
    DragMoveDone = 'drag_move_done',
    DragEndPending = 'drag_end_pending',
    DragEndDone = 'drag_end_done',
    
    // Resize events
    ResizeStartPending = 'resize_start_pending',
    ResizeStartDone = 'resize_start_done',
    ResizeMovePending = 'resize_move_pending',
    ResizeMoveDone = 'resize_move_done',
    ResizeEndPending = 'resize_end_pending',
    ResizeEndDone = 'resize_end_done',
    
    // Group reorder events
    GroupReorderPending = 'group_reorder_pending',
    GroupReorderDone = 'group_reorder_done',
} 