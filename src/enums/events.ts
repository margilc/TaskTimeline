export enum PluginEvent {
    AppStateUpdated = 'appStateUpdated',
    ProjectSelected = 'projectSelected',

    // Convention-based update events
    UpdateProjectsDone = 'update_projects_done',
    UpdateTasksPending = 'update_tasks_pending',
    UpdateTasksDone = 'update_tasks_done',
    UpdateColorMappingsPending = 'update_colormappings_pending',
    UpdateColorMappingsDone = 'update_colormappings_done',
    UpdateLayoutPending = 'update_layout_pending',
    UpdateLayoutDone = 'update_layout_done',
    UpdateBoardGroupingPending = 'update_boardgrouping_pending',
    UpdateBoardGroupingDone = 'update_boardgrouping_done',
    UpdateGroupOrderPending = 'update_grouporder_pending',
    UpdateGroupOrderDone = 'update_grouporder_done',
    UpdateGroupFoldPending = 'update_groupfold_pending',
    UpdateGroupFoldDone = 'update_groupfold_done',
    UpdateSettingsPending = 'update_settings_pending',
    UpdateSettingsDone = 'update_settings_done',
    CreateTaskPending = 'create_task_pending',
    CreateTaskDone = 'create_task_done',

    // Zoom events
    UpdateZoomPending = 'update_zoom_pending',
    UpdateZoomDone = 'update_zoom_done',

    // Drag/resize lifecycle
    TaskDragStarted = 'task_drag_started',
    TaskDragEnded = 'task_drag_ended',
}
