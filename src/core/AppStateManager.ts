import { IAppState, IPersistentState, IVolatileState, IZoomState } from '../interfaces/IAppState';
import { PluginEvent } from '../enums/events';
import { Plugin, App, TAbstractFile, TFile, TFolder, Component, Events, Notice } from 'obsidian';
import { updateProjects } from './update/updateProjects';
import { updateTasks, updateTasksFromIndex } from './update/updateTasks';
import { updateColorMappings, updateColorVariable } from './update/updateColorMappings';
import { updateCurrentDate } from './update/updateCurrentDate';
import { updateLayout, clearLayoutCache } from './update/updateLayout';
import { updateBoardGrouping } from './update/updateBoardGrouping';
import { updateSettings } from './update/updateSettings';
import { createTask } from './update/createTask';
import { renameTaskFileForNewStartDate } from './utils/fileRenameUtils';
import { updateDateBounds } from './update/updateDateBounds';
import { DEFAULT_COLOR } from './utils/colorUtils';
import { TaskIndex } from './TaskIndex';
import { TimeUnit } from '../enums/TimeUnit';

// Ordered from finest to coarsest: index 0=day, 1=week, 2=month
const ZOOM_TIME_UNITS = [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH];

export { ZOOM_TIME_UNITS };

function timeUnitFromModeIndex(modeIndex: number): string {
    return ZOOM_TIME_UNITS[modeIndex];
}

export class AppStateManager extends Component {
    private state: IAppState;
    private plugin: Plugin;
    private app: App;
    private events: Events;
    private taskIndex: TaskIndex | null = null;

    // Event coalescing state
    private pendingLayoutUpdate = false;
    private rafId: number | null = null;

    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.app = plugin.app;
        this.events = new Events();
        this.state = this.getDefaultState();
        this.setupConventionBasedEventListeners();
    }

    private scheduleCoalescedUpdates(): void {
        if (this.rafId !== null) return;

        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            if (this.pendingLayoutUpdate) {
                this.pendingLayoutUpdate = false;
                this.handleUpdateLayoutPending();
            }
        });
    }

    private triggerLayoutUpdate(): void {
        this.pendingLayoutUpdate = true;
        this.scheduleCoalescedUpdates();
    }

    private setupConventionBasedEventListeners(): void {
        this.registerEvent(this.app.vault.on('create', this.handleFileCreate.bind(this)));
        this.registerEvent(this.app.vault.on('delete', this.handleFileDelete.bind(this)));
        this.registerEvent(this.app.vault.on('rename', this.handleFileRename.bind(this)));
        this.registerEvent(this.app.vault.on('modify', this.handleFileModify.bind(this)));

        this.events.on(PluginEvent.UpdateTasksPending, this.handleUpdateTasksPending.bind(this));
        this.events.on(PluginEvent.UpdateColorMappingsPending, this.handleUpdateColorMappingsPending.bind(this));
        this.events.on(PluginEvent.UpdateCurrentDatePending, this.handleUpdateCurrentDatePending.bind(this));
        this.events.on(PluginEvent.UpdateLayoutPending, this.handleUpdateLayoutPending.bind(this));
        this.events.on(PluginEvent.UpdateBoardGroupingPending, this.handleUpdateBoardGroupingPending.bind(this));
        this.events.on(PluginEvent.UpdateSettingsPending, this.handleUpdateSettingsPending.bind(this));
        this.events.on(PluginEvent.CreateTaskPending, this.handleCreateTaskPending.bind(this));
        this.events.on(PluginEvent.UpdateZoomPending, this.handleUpdateZoomPending.bind(this));
        this.events.on(PluginEvent.UpdateGroupOrderPending, this.handleUpdateGroupOrderPending.bind(this));
    }

    private async handleFileCreate(file: TAbstractFile): Promise<void> {
        if (this.isRelevantFile(file)) {
            if (file instanceof TFolder) {
                this.handleUpdateProjectsPending();
            } else if (file instanceof TFile && file.extension === 'md') {
                if (this.taskIndex) {
                    await this.taskIndex.handleFileCreate(file);
                }
                this.events.trigger(PluginEvent.UpdateTasksPending);
            }
        }
    }

    private handleFileDelete(file: TAbstractFile): void {
        if (this.isRelevantFile(file)) {
            if (file instanceof TFolder) {
                this.handleUpdateProjectsPending();
            } else if (file instanceof TFile && file.extension === 'md') {
                if (this.taskIndex) {
                    this.taskIndex.handleFileDelete(file);
                }
                this.events.trigger(PluginEvent.UpdateTasksPending);
            }
        }
    }

    private async handleFileRename(file: TAbstractFile, oldPath: string): Promise<void> {
        if (this.isRelevantPath(oldPath) || this.isRelevantFile(file)) {
            if (file instanceof TFolder) {
                this.handleUpdateProjectsPending();
            } else if (file instanceof TFile && file.extension === 'md') {
                if (this.taskIndex) {
                    await this.taskIndex.handleFileRename(file, oldPath);
                }
                this.events.trigger(PluginEvent.UpdateTasksPending);
            }
        }
    }

    private async handleFileModify(file: TAbstractFile): Promise<void> {
        if (this.isRelevantFile(file) && file instanceof TFile && file.extension === 'md') {
            if (this.taskIndex) {
                await this.taskIndex.handleFileModify(file);
            }
            this.handleFileModifyWithRenaming(file);
        }
    }

    private async handleFileModifyWithRenaming(file: TFile): Promise<void> {
        try {
            const currentTasks = this.state.volatile.currentTasks || [];
            const taskBeforeUpdate = currentTasks.find(task => task.filePath === file.path);

            const content = await this.app.vault.read(file);
            const { parseTaskFromContent } = await import('./utils/taskUtils');
            const parsedTask = parseTaskFromContent(content, file.path);

            if (parsedTask && taskBeforeUpdate && parsedTask.start !== taskBeforeUpdate.start) {
                await renameTaskFileForNewStartDate(this.app, taskBeforeUpdate, parsedTask.start);
            }

            this.events.trigger(PluginEvent.UpdateTasksPending);
        } catch (error) {
            console.error('Error handling file modification with renaming:', error);
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
            clearLayoutCache();

            this.events.trigger(PluginEvent.UpdateProjectsDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);
        } catch (error) {
        }
    }

    private async handleUpdateTasksPending(): Promise<void> {
        try {
            let result;
            if (this.taskIndex && this.taskIndex.isInitialized()) {
                result = updateTasksFromIndex(this.taskIndex, this.state.volatile, this.state.persistent);
            } else {
                result = await updateTasks(this.app, this.state.volatile, this.state.persistent);
            }

            this.state.volatile = result.volatile;
            this.state.persistent = result.persistent;

            await this.saveData(this.state.persistent);
            clearLayoutCache();

            // Update date bounds from tasks
            const bounds = updateDateBounds(this.state.volatile.currentTasks || []);
            this.state.volatile.dateBounds = bounds ?? undefined;

            this.events.trigger(PluginEvent.UpdateTasksDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);

            this.triggerLayoutUpdate();
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
            clearLayoutCache();

            this.events.trigger(PluginEvent.UpdateBoardGroupingDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);

            this.triggerLayoutUpdate();
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

            if (oldTaskDirectory !== newSettings.taskDirectory) {
                if (this.taskIndex) {
                    await this.taskIndex.setTaskDirectory(newSettings.taskDirectory);
                }
                this.handleUpdateProjectsPending();
            }

            this.triggerLayoutUpdate();

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
        } catch (error) {
            new Notice(error.message || "Failed to create task. Please try again.");
        }
    }

    private async handleUpdateZoomPending(data: { modeIndex: number; columnWidth: number }): Promise<void> {
        try {
            const zoomState: IZoomState = { modeIndex: data.modeIndex, columnWidth: data.columnWidth };
            this.state.volatile.zoomState = zoomState;
            this.state.persistent.zoomLevel = { modeIndex: data.modeIndex, columnWidth: data.columnWidth };
            this.state.persistent.currentTimeUnit = timeUnitFromModeIndex(data.modeIndex);

            await this.saveData(this.state.persistent);
            clearLayoutCache();

            this.events.trigger(PluginEvent.UpdateZoomDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);

            this.triggerLayoutUpdate();
        } catch (error) {
        }
    }

    private async handleUpdateGroupOrderPending(data: { groupName: string; direction: 'up' | 'down' }): Promise<void> {
        try {
            const persistent = this.state.persistent;
            const projectId = persistent.currentProjectName || 'All Projects';
            const groupBy = persistent.boardGrouping?.groupBy || 'none';
            const availableGroups = persistent.boardGrouping?.availableGroups || [];

            const currentIndex = availableGroups.indexOf(data.groupName);
            if (currentIndex === -1) return;

            const targetIndex = data.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= availableGroups.length) return;

            const newOrder = [...availableGroups];
            [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];

            const groupingOrderings = { ...(persistent.groupingOrderings || {}) };
            groupingOrderings[projectId] = {
                ...(groupingOrderings[projectId] || {}),
                [groupBy]: newOrder
            };

            this.state.persistent = {
                ...persistent,
                boardGrouping: {
                    ...persistent.boardGrouping!,
                    availableGroups: newOrder
                },
                groupingOrderings
            };

            await this.saveData(this.state.persistent);
            clearLayoutCache();

            this.events.trigger(PluginEvent.UpdateGroupOrderDone);
            this.events.trigger(PluginEvent.AppStateUpdated, this.state);

            this.triggerLayoutUpdate();
        } catch (error) {
        }
    }

    private getDefaultState(): IAppState {
        const defaultZoom: IZoomState = { modeIndex: 0, columnWidth: 90 };

        const defaultPersistent: IPersistentState = {
            currentProjectName: "All Projects",
            settings: {
                taskDirectory: "Taskdown",
                openByDefault: true,
                openInNewPane: false,
                rowHeight: 80,
                defaultCardColor: "#002b36",
                minColWidth: 30,
                maxColWidth: 150,
                zoomStep: 10,
                minFontSize: 8,
                maxFontSize: 14,
            },
            lastOpenedDate: new Date().toISOString(),
            colorVariable: "none",
            colorMappings: {},
            currentTimeUnit: "day",
            currentDate: new Date().toISOString(),
            zoomLevel: { modeIndex: 0, columnWidth: 90 },
            scrollPosition: { left: 0, top: 0 }
        };

        const defaultVolatile: IVolatileState = {
            availableProjects: ["All Projects"],
            currentTasks: [],
            boardLayout: undefined,
            activeFilters: {},
            zoomState: defaultZoom,
            dateBounds: undefined,
        };

        return { persistent: defaultPersistent, volatile: defaultVolatile };
    }

    async initialize(): Promise<void> {
        try {
            const persistentData = await this.loadData();
            this.state.persistent = this.mergeDeep(this.state.persistent, persistentData);

            // Restore zoom state from persisted level (with migration from old stepIndex format)
            const savedZoom = this.state.persistent.zoomLevel as any;
            if (savedZoom) {
                if ('stepIndex' in savedZoom && !('columnWidth' in savedZoom)) {
                    // Migration: old format had stepIndex, convert to columnWidth
                    const oldSteps = [40, 70, 100, 140, 200];
                    const migratedWidth = oldSteps[savedZoom.stepIndex] ?? 90;
                    const settings = this.state.persistent.settings;
                    const minW = settings?.minColWidth ?? 30;
                    const maxW = settings?.maxColWidth ?? 150;
                    const clampedWidth = Math.max(minW, Math.min(maxW, migratedWidth));
                    this.state.volatile.zoomState = { modeIndex: savedZoom.modeIndex, columnWidth: clampedWidth };
                    this.state.persistent.zoomLevel = { modeIndex: savedZoom.modeIndex, columnWidth: clampedWidth };
                } else {
                    this.state.volatile.zoomState = { modeIndex: savedZoom.modeIndex, columnWidth: savedZoom.columnWidth };
                }
                this.state.persistent.currentTimeUnit = timeUnitFromModeIndex(savedZoom.modeIndex);
            }

            const projectResult = await updateProjects(this.app, this.state.volatile, this.state.persistent);
            this.state.volatile = projectResult.volatile;
            this.state.persistent = projectResult.persistent;

            const taskDirectory = this.state.persistent.settings?.taskDirectory || 'Taskdown';
            this.taskIndex = new TaskIndex(this.app, taskDirectory);
            await this.taskIndex.initialize();

            const taskResult = updateTasksFromIndex(this.taskIndex, this.state.volatile, this.state.persistent);
            this.state.volatile = taskResult.volatile;
            this.state.persistent = taskResult.persistent;

            // Compute date bounds from tasks
            const bounds = updateDateBounds(this.state.volatile.currentTasks || []);
            this.state.volatile.dateBounds = bounds ?? undefined;

            this.triggerLayoutUpdate();

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
        if (variable === 'none') return [];

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
        return new Date().toISOString();
    }

    public async saveScrollPosition(left: number, top: number): Promise<void> {
        this.state.persistent.scrollPosition = { left, top };
        await this.saveData(this.state.persistent);
    }

    public emit(event: string, data?: any): void {
        this.events.trigger(event, data);
    }

    public destroy(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.pendingLayoutUpdate = false;

        if (this.taskIndex) {
            this.taskIndex.clear();
            this.taskIndex = null;
        }

        this.unload();
    }
}
