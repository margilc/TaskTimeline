import { IAppState, IPersistentState, IVolatileState } from '../interfaces/IAppState';
import { PluginEvent } from '../enums/events';
import { Plugin, App, TAbstractFile, TFile, TFolder, Component, Events, Notice } from 'obsidian';
import { updateProjects } from './update/updateProjects';
import { updateTasks } from './update/updateTasks';
import { updateColorMappings, updateColorVariable } from './update/updateColorMappings';
import { updateTimeUnit } from './update/updateTimeUnit';
import { updateCurrentDate } from './update/updateCurrentDate';
import { updateTimelineViewport } from './update/updateTimelineViewport';
import { updateMinimapData } from './update/updateMinimapData';
import { updateSnappedDateBoundaries } from './update/updateSnappedDateBoundaries';
import { updateLayout, clearLayoutCache } from './update/updateLayout';
import { updateBoardGrouping } from './update/updateBoardGrouping';
import { updateSettings } from './update/updateSettings';
import { createTask } from './update/createTask';
import { updateDragStart, updateDragMove, updateDragEnd } from './update/updateDragState';
import { updateResizeStart, updateResizeMove, updateResizeEnd } from './update/updateResizeState';
import { DEFAULT_COLOR, ColorVariable } from './utils/colorUtils';
import { calculateDefaultViewport } from './utils/timelineUtils';

export class AppStateManager extends Component {
    private state: IAppState;
    private plugin: Plugin;
    private app: App;
    private events: Events;

    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.app = plugin.app;
        this.events = new Events();
        this.state = this.getDefaultState();
        this.setupConventionBasedEventListeners();
    }

    private setupConventionBasedEventListeners(): void {
        this.registerEvent(this.app.vault.on('create', this.handleFileCreate.bind(this)));
        this.registerEvent(this.app.vault.on('delete', this.handleFileDelete.bind(this)));
        this.registerEvent(this.app.vault.on('rename', this.handleFileRename.bind(this)));
        this.registerEvent(this.app.vault.on('modify', this.handleFileModify.bind(this)));
        
        this.events.on(PluginEvent.UpdateTasksPending, this.handleUpdateTasksPending.bind(this));
        this.events.on(PluginEvent.UpdateColorMappingsPending, this.handleUpdateColorMappingsPending.bind(this));
        this.events.on(PluginEvent.UpdateTimeUnitPending, this.handleUpdateTimeUnitPending.bind(this));
        this.events.on(PluginEvent.UpdateCurrentDatePending, this.handleUpdateCurrentDatePending.bind(this));
        this.events.on(PluginEvent.UpdateTimelineViewportPending, this.handleUpdateTimelineViewportPending.bind(this));
        this.events.on(PluginEvent.UpdateMinimapDataPending, this.handleUpdateMinimapDataPending.bind(this));
        this.events.on(PluginEvent.UpdateSnappedDateBoundariesPending, this.handleUpdateSnappedDateBoundariesPending.bind(this));
        this.events.on(PluginEvent.UpdateLayoutPending, this.handleUpdateLayoutPending.bind(this));
        this.events.on(PluginEvent.UpdateBoardGroupingPending, this.handleUpdateBoardGroupingPending.bind(this));
        this.events.on(PluginEvent.UpdateSettingsPending, this.handleUpdateSettingsPending.bind(this));
        this.events.on(PluginEvent.CreateTaskPending, this.handleCreateTaskPending.bind(this));
        
        // Drag/Drop event listeners
        this.events.on(PluginEvent.DragStartPending, this.handleDragStartPending.bind(this));
        this.events.on(PluginEvent.DragMovePending, this.handleDragMovePending.bind(this));
        this.events.on(PluginEvent.DragEndPending, this.handleDragEndPending.bind(this));
        
        // Resize event listeners
        this.events.on(PluginEvent.ResizeStartPending, this.handleResizeStartPending.bind(this));
        this.events.on(PluginEvent.ResizeMovePending, this.handleResizeMovePending.bind(this));
        this.events.on(PluginEvent.ResizeEndPending, this.handleResizeEndPending.bind(this));
    }


    private handleFileCreate(file: TAbstractFile): void {
        if (this.isRelevantFile(file)) {
            if (file instanceof TFolder) {
                this.handleUpdateProjectsPending();
            } else if (file instanceof TFile && file.extension === 'md') {
                this.events.trigger(PluginEvent.UpdateTasksPending);
            }
        }
    }

    private handleFileDelete(file: TAbstractFile): void {
        if (this.isRelevantFile(file)) {
            if (file instanceof TFolder) {
                this.handleUpdateProjectsPending();
            } else if (file instanceof TFile && file.extension === 'md') {
                this.events.trigger(PluginEvent.UpdateTasksPending);
            }
        }
    }

    private handleFileRename(file: TAbstractFile, oldPath: string): void {
        if (this.isRelevantPath(oldPath) || this.isRelevantFile(file)) {
            if (file instanceof TFolder) {
                this.handleUpdateProjectsPending();
            } else if (file instanceof TFile && file.extension === 'md') {
                this.events.trigger(PluginEvent.UpdateTasksPending);
            }
        }
    }

    private handleFileModify(file: TAbstractFile): void {
        if (this.isRelevantFile(file) && file instanceof TFile && file.extension === 'md') {
            this.events.trigger(PluginEvent.UpdateTasksPending);
        }
    }

    private isRelevantFile(file: TAbstractFile): boolean {
        return this.isRelevantPath(file.path);
    }

    private isRelevantPath(path: string): boolean {
        const taskDirectory = this.state.persistent.settings?.taskDirectory || 'Taskdown';
        return path.startsWith(taskDirectory + '/');
    }

    private async handleUpdateProjectsPending(): Promise<void> {
        try {
            const result = await updateProjects(this.app, this.state.volatile, this.state.persistent);
            
            this.state.volatile = result.volatile;
            this.state.persistent = result.persistent;
            
            await this.saveData(this.state.persistent);
            
            // Clear layout cache when projects change
            clearLayoutCache();
            
            this.events.trigger(PluginEvent.UpdateProjectsDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateTasksPending(): Promise<void> {
        try {
            const result = await updateTasks(this.app, this.state.volatile, this.state.persistent);
            
            this.state.volatile = result.volatile;
            this.state.persistent = result.persistent;
            
            await this.saveData(this.state.persistent);
            
            // Clear layout cache when tasks change to prevent stale cached layouts
            clearLayoutCache();
            
            this.events.trigger(PluginEvent.UpdateTasksDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Update snapped boundaries when tasks change (like time unit does)
            this.events.trigger(PluginEvent.UpdateSnappedDateBoundariesPending);
            
            // Trigger layout update after tasks change
            this.events.trigger(PluginEvent.UpdateLayoutPending);
        } catch (error) {
        }
    }

    private async handleUpdateColorMappingsPending(data: any): Promise<void> {
        try {
            let result;
            
            if (data.type === 'variable') {
                result = await updateColorVariable(this.app, this.state.persistent, this.state.volatile, data.variable);
            } else if (data.type === 'mapping') {
                result = await updateColorMappings(
                    this.app, 
                    this.state.persistent, 
                    this.state.volatile,
                    data.projectId,
                    data.variable,
                    data.level,
                    data.color
                );
            } else {
                throw new Error('Invalid color mapping update type');
            }
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            await this.saveData(this.state.persistent);
            
            this.events.trigger(PluginEvent.UpdateColorMappingsDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateTimeUnitPending(timeUnit: string): Promise<void> {
        try {
            const result = await updateTimeUnit(this.app, this.state.persistent, this.state.volatile, timeUnit);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            await this.saveData(this.state.persistent);
            
            // Clear layout cache when time unit changes to prevent stale cached layouts
            clearLayoutCache();
            
            // Update snapped boundaries when time unit changes
            this.events.trigger(PluginEvent.UpdateSnappedDateBoundariesPending);
            
            this.events.trigger(PluginEvent.UpdateTimeUnitDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Trigger layout update after time unit changes
            this.events.trigger(PluginEvent.UpdateLayoutPending);
        } catch (error) {
        }
    }

    private async handleUpdateCurrentDatePending(date: string): Promise<void> {
        try {
            const result = await updateCurrentDate(this.app, this.state.persistent, this.state.volatile, date);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            await this.saveData(this.state.persistent);
            
            this.events.trigger(PluginEvent.UpdateCurrentDateDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateTimelineViewportPending(data: { localMinDate: string, localMaxDate: string }): Promise<void> {
        try {
            const result = await updateTimelineViewport(
                this.app, 
                this.state.persistent, 
                this.state.volatile, 
                data.localMinDate, 
                data.localMaxDate
            );
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.UpdateTimelineViewportDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Trigger layout update after viewport changes
            this.events.trigger(PluginEvent.UpdateLayoutPending);
        } catch (error) {
        }
    }

    private async handleUpdateMinimapDataPending(): Promise<void> {
        try {
            const tasks = this.state.volatile.currentTasks || [];
            const result = await updateMinimapData(this.app, this.state.persistent, this.state.volatile, tasks);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.UpdateMinimapDataDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateSnappedDateBoundariesPending(): Promise<void> {
        try {
            const result = updateSnappedDateBoundaries(this.app, this.state);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.UpdateSnappedDateBoundariesDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateLayoutPending(): Promise<void> {
        try {
            const result = updateLayout(this.app, this.state);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.UpdateLayoutDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateBoardGroupingPending(data: { groupBy: string }): Promise<void> {
        try {
            const result = updateBoardGrouping(this.app, this.state, data.groupBy);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            await this.saveData(this.state.persistent);
            
            this.events.trigger(PluginEvent.UpdateBoardGroupingDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Trigger layout update after grouping changes
            this.events.trigger(PluginEvent.UpdateLayoutPending);
        } catch (error) {
        }
    }

    private async handleUpdateSettingsPending(newSettings: any): Promise<void> {
        try {
            const oldTaskDirectory = this.state.persistent.settings?.taskDirectory;
            const result = updateSettings(this.app, this.state, newSettings);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            await this.saveData(this.state.persistent);
            
            // If task directory changed, trigger projects update
            if (oldTaskDirectory !== newSettings.taskDirectory) {
                this.handleUpdateProjectsPending();
            }
            
            // Trigger layout update to apply new column/dimension settings
            this.events.trigger(PluginEvent.UpdateLayoutPending);
            
            this.events.trigger(PluginEvent.UpdateSettingsDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleCreateTaskPending(taskData: any): Promise<void> {
        try {
            const result = await createTask(this.app, this.state, taskData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            new Notice("Task created successfully!");
            
            this.events.trigger(PluginEvent.CreateTaskDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Don't trigger manual update - let vault events handle it to avoid double processing
        } catch (error) {
            new Notice(error.message || "Failed to create task. Please try again.");
        }
    }

    // Drag/Drop event handlers
    private async handleDragStartPending(dragData: any): Promise<void> {
        try {
            const result = updateDragStart(this.app, this.state.persistent, this.state.volatile, dragData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.DragStartDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
            console.error('❌ Drag Start Error:', error);
            console.error('Drag data:', dragData);
        }
    }

    private async handleDragMovePending(dragData: any): Promise<void> {
        try {
            const result = updateDragMove(this.app, this.state.persistent, this.state.volatile, dragData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.DragMoveDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
            console.error('❌ Drag Move Error:', error);
            console.error('Drag data:', dragData);
        }
    }

    private async handleDragEndPending(dragData: any): Promise<void> {
        try {
            const result = await updateDragEnd(this.app, this.state.persistent, this.state.volatile, dragData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.DragEndDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Reload tasks after file modification to reflect changes
            this.events.trigger(PluginEvent.UpdateTasksPending);
        } catch (error) {
            console.error('❌ Drag End Error:', error);
            console.error('Drag data:', dragData);
        }
    }

    // Resize event handlers
    private async handleResizeStartPending(resizeData: any): Promise<void> {
        try {
            const result = updateResizeStart(this.app, this.state.persistent, this.state.volatile, resizeData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.ResizeStartDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleResizeMovePending(resizeData: any): Promise<void> {
        try {
            const result = updateResizeMove(this.app, this.state.persistent, this.state.volatile, resizeData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.ResizeMoveDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleResizeEndPending(resizeData: any): Promise<void> {
        try {
            const result = await updateResizeEnd(this.app, this.state.persistent, this.state.volatile, resizeData);
            
            this.state.persistent = result.persistent;
            this.state.volatile = result.volatile;
            
            this.events.trigger(PluginEvent.ResizeEndDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
            
            // Reload tasks after file modification to reflect changes
            this.events.trigger(PluginEvent.UpdateTasksPending);
        } catch (error) {
        }
    }

    private getDefaultState(): IAppState {
        const defaultPersistent: IPersistentState = {
            currentProjectName: "All Projects",
            settings: {
                taskDirectory: "Taskdown",
                openByDefault: true,
                openInNewPane: false,
                numberOfColumns: 5,
                columnWidth: 200,
                numberOfRows: 8,
                rowHeight: 80,
                globalMinDate: new Date(2025, 0, 1).toISOString(),
                globalMaxDate: new Date(2025, 11, 31).toISOString()
            },
            lastOpenedDate: new Date().toISOString(),
            colorVariable: "none",
            colorMappings: {},
            currentTimeUnit: "day",
            currentDate: new Date().toISOString()
        };

        const defaultVolatile: IVolatileState = {
            availableProjects: ["All Projects"],
            currentTasks: [],
            boardLayout: undefined,
            activeFilters: {},
            timelineViewport: undefined,
            minimapData: []
        };

        return { persistent: defaultPersistent, volatile: defaultVolatile };
    }

    async initialize(): Promise<void> {
        try {
            const persistentData = await this.loadData();
            this.state.persistent = this.mergeDeep(this.state.persistent, persistentData);
            
            const projectResult = await updateProjects(this.app, this.state.volatile, this.state.persistent);
            this.state.volatile = projectResult.volatile;
            this.state.persistent = projectResult.persistent;
            
            const taskResult = await updateTasks(this.app, this.state.volatile, this.state.persistent);
            this.state.volatile = taskResult.volatile;
            this.state.persistent = taskResult.persistent;
            
            // Initialize timeline viewport if not set
            if (!this.state.volatile.timelineViewport) {
                const currentDate = this.getCurrentDate();
                const timeUnit = this.getCurrentTimeUnit();
                const defaultViewport = calculateDefaultViewport(currentDate, timeUnit);
                const viewportResult = await updateTimelineViewport(
                    this.app, 
                    this.state.persistent, 
                    this.state.volatile, 
                    defaultViewport.localMinDate, 
                    defaultViewport.localMaxDate
                );
                this.state.volatile = viewportResult.volatile;
                this.state.persistent = viewportResult.persistent;
            }
            
            // Initialize snapped date boundaries
            const snappedResult = updateSnappedDateBoundaries(this.app, this.state);
            this.state.volatile = snappedResult.volatile;
            this.state.persistent = snappedResult.persistent;
            
            // Initialize minimap data
            if (this.state.volatile.currentTasks && this.state.volatile.currentTasks.length > 0) {
                const minimapResult = await updateMinimapData(this.app, this.state.persistent, this.state.volatile, this.state.volatile.currentTasks);
                this.state.volatile = minimapResult.volatile;
                this.state.persistent = minimapResult.persistent;
            }
            
            // Trigger initial layout update to ensure board renders on startup
            this.events.trigger(PluginEvent.UpdateLayoutPending);
            
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async loadData(): Promise<Record<string, any>> {
        const data = await this.plugin.loadData();
        return data || {};
    }

    private async saveData(record: Record<string, any>): Promise<void> {
        await this.plugin.saveData(record);
    }

    private mergeDeep(target: any, source: any): any {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeDeep(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    public getState(): IAppState { return this.state; }
    public getPersistentState(): IPersistentState { return this.state.persistent; }
    public getVolatileState(): IVolatileState { return this.state.volatile; }
    public getEvents(): Events { return this.events; }

    public async selectProject(projectName: string): Promise<void> {
        this.state.persistent.currentProjectName = projectName;
        await this.saveData(this.state.persistent);
        this.events.trigger(PluginEvent.ProjectSelected, projectName);
        this.events.trigger(PluginEvent.UpdateTasksPending);
        this.events.trigger(PluginEvent.AppStateUpdated, this.state);
    }

    public async updatePersistentState(updates: Partial<IPersistentState>): Promise<void> {
        const oldTaskDirectory = this.state.persistent.settings?.taskDirectory;
        this.state.persistent = { ...this.state.persistent, ...updates };
        
        // Check if taskDirectory changed and trigger projects update if so
        const newTaskDirectory = this.state.persistent.settings?.taskDirectory;
        if (oldTaskDirectory !== newTaskDirectory) {
            this.handleUpdateProjectsPending();
        }
        
        await this.saveData(this.state.persistent);
        this.events.trigger(PluginEvent.AppStateUpdated, this.state);
    }

    public updateVolatileState(updateFn: (currentState: IVolatileState) => IVolatileState): void {
        this.state.volatile = updateFn(this.state.volatile);
        this.events.trigger(PluginEvent.AppStateUpdated, this.state);
    }

    public getAvailableLevels(variable: string): string[] {
        if (variable === 'none') {
            return [];
        }
        
        const tasks = this.state.volatile.currentTasks || [];
        const levels = new Set<string>();
        
        for (const task of tasks) {
            const value = task[variable];
            if (value !== undefined && value !== null && value !== '') {
                levels.add(String(value));
            }
        }
        
        return Array.from(levels).sort();
    }
    
    public getColorForLevel(projectId: string, variable: string, level: string): string {
        const mappings = this.state.persistent.colorMappings;
        if (!mappings || !mappings[projectId] || !mappings[projectId][variable]) {
            return DEFAULT_COLOR;
        }
        
        return mappings[projectId][variable][level] || DEFAULT_COLOR;
    }
    
    public getCurrentTimeUnit(): string {
        return this.state.persistent.currentTimeUnit || "day";
    }
    
    public getCurrentDate(): string {
        return this.state.persistent.currentDate || new Date().toISOString();
    }
    
    public getTimelineViewport(): { localMinDate: string, localMaxDate: string } | null {
        return this.state.volatile.timelineViewport || null;
    }
    
    public getMinimapData(): Array<{ date: string, count: number }> {
        return this.state.volatile.minimapData || [];
    }

    public emit(event: string, data?: any): void {
        this.events.trigger(event, data);
    }

    public destroy(): void {
        this.unload();
    }
}