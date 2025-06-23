import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';
import { TimeUnit } from "../../enums/TimeUnit";
import { NavMinimap } from "./NavMinimap";
import { NavTimeSlider } from "./NavTimeSlider";
import { calculateDefaultViewport } from '../../core/utils/timelineUtils';

export class NavTimelineSelection {
    private container: HTMLElement;
    private appStateManager: AppStateManager;
    private navMinimap: NavMinimap | null = null;
    private navTimeSlider: NavTimeSlider | null = null;

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.container.className = "nav-timeline-selection";
        
        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateTasksDone, this.handleTasksUpdated.bind(this));
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimeUnitDone, this.handleTimeUnitUpdated.bind(this));
        this.appStateManager.getEvents().on(PluginEvent.UpdateCurrentDateDone, this.render.bind(this));
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimelineViewportDone, this.render.bind(this));
        this.appStateManager.getEvents().on(PluginEvent.UpdateMinimapDataDone, this.render.bind(this));
    }

    private async handleTasksUpdated(): Promise<void> {
        // Regenerate minimap data when tasks change
        this.appStateManager.getEvents().trigger(PluginEvent.UpdateMinimapDataPending);
    }

    private async handleTimeUnitUpdated(): Promise<void> {
        // Recalculate viewport and regenerate minimap when time unit changes
        const currentDate = this.appStateManager.getCurrentDate();
        const timeUnit = this.appStateManager.getCurrentTimeUnit();
        const numberOfColumns = this.appStateManager.getState().persistent.settings?.numberOfColumns || 7;
        const newViewport = calculateDefaultViewport(currentDate, timeUnit, numberOfColumns);
        
        this.appStateManager.getEvents().trigger(PluginEvent.UpdateTimelineViewportPending, newViewport);
        this.appStateManager.getEvents().trigger(PluginEvent.UpdateMinimapDataPending);
    }

    private render(): void {
        this.container.empty();

        const state = this.appStateManager.getState();
        const settings = state.persistent.settings;
        
        // Validate timeline data
        if (!settings?.globalMinDate || !settings?.globalMaxDate) {
            this.container.textContent = "Timeline data unavailable.";
            return;
        }

        const globalMinDate = new Date(settings.globalMinDate);
        const globalMaxDate = new Date(settings.globalMaxDate);
        
        if (globalMinDate >= globalMaxDate) {
            this.container.textContent = "Invalid timeline date range.";
            return;
        }

        // Initialize viewport if not set
        if (!state.volatile.timelineViewport) {
            const currentDate = this.appStateManager.getCurrentDate();
            const timeUnit = this.appStateManager.getCurrentTimeUnit();
            const numberOfColumns = state.persistent.settings?.numberOfColumns || 7;
            const defaultViewport = calculateDefaultViewport(currentDate, timeUnit, numberOfColumns);
            this.appStateManager.getEvents().trigger(PluginEvent.UpdateTimelineViewportPending, defaultViewport);
            return; // Will re-render when viewport is set
        }

        // Create title
        const titleElement = document.createElement("h3");
        titleElement.textContent = "Timeline";
        this.container.appendChild(titleElement);

        // Create minimap container
        const minimapContainer = document.createElement("div");
        minimapContainer.className = "nav-minimap-container";
        this.navMinimap = new NavMinimap(minimapContainer, this.appStateManager);
        this.container.appendChild(minimapContainer);

        // Create time slider container
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "nav-timeslider-container";
        this.navTimeSlider = new NavTimeSlider(sliderContainer, this.appStateManager);
        this.container.appendChild(sliderContainer);
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateTasksDone, this.handleTasksUpdated.bind(this));
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimeUnitDone, this.handleTimeUnitUpdated.bind(this));
        this.appStateManager.getEvents().off(PluginEvent.UpdateCurrentDateDone, this.render.bind(this));
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimelineViewportDone, this.render.bind(this));
        this.appStateManager.getEvents().off(PluginEvent.UpdateMinimapDataDone, this.render.bind(this));

        if (this.navMinimap) {
            this.navMinimap.destroy();
        }
        if (this.navTimeSlider) {
            this.navTimeSlider.destroy();
        }
    }
}
