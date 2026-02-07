export enum PluginEvent {
    AppStateUpdated = 'appStateUpdated',
    ProjectSelected = 'projectSelected',
    ProjectListUpdated = 'projectListUpdated',
    ProjectCreated = 'projectCreated',
    SettingsChanged = 'settingsChanged',

    // Convention-based update events
    UpdateProjectsPending = 'update_projects_pending',
    UpdateProjectsDone = 'update_projects_done',
    UpdateTasksPending = 'update_tasks_pending',
    UpdateTasksDone = 'update_tasks_done',
    UpdateColorMappingsPending = 'update_colormappings_pending',
    UpdateColorMappingsDone = 'update_colormappings_done',
    UpdateCurrentDatePending = 'update_currentdate_pending',
    UpdateCurrentDateDone = 'update_currentdate_done',
    UpdateLayoutPending = 'update_layout_pending',
    UpdateLayoutDone = 'update_layout_done',
    UpdateBoardGroupingPending = 'update_boardgrouping_pending',
    UpdateBoardGroupingDone = 'update_boardgrouping_done',
    UpdateGroupOrderPending = 'update_grouporder_pending',
    UpdateGroupOrderDone = 'update_grouporder_done',
    UpdateSettingsPending = 'update_settings_pending',
    UpdateSettingsDone = 'update_settings_done',
    CreateTaskPending = 'create_task_pending',
    CreateTaskDone = 'create_task_done',

    // Zoom events
    UpdateZoomPending = 'update_zoom_pending',
    UpdateZoomDone = 'update_zoom_done',
}
