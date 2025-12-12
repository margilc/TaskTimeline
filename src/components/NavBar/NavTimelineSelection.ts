import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';
import { TimeUnit } from "../../enums/TimeUnit";
import { NavMinimap } from "./NavMinimap";
import { NavTimeSlider } from "./NavTimeSlider";
import { calculateDefaultViewport, generateTimeMarkersWithMetadata } from '../../core/utils/timelineUtils';

export class NavTimelineSelection {
    private container: HTMLElement;
    private appStateManager: AppStateManager;
    private navMinimap: NavMinimap | null = null;
    private navTimeSlider: NavTimeSlider | null = null;

    // Bound handlers for proper event listener cleanup
    private readonly boundHandleTasksUpdated = this.handleTasksUpdated.bind(this);
    private readonly boundHandleTimeUnitUpdated = this.handleTimeUnitUpdated.bind(this);
    private readonly boundRender = this.render.bind(this);

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.container.className = "nav-timeline-selection";

        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateTasksDone, this.boundHandleTasksUpdated);
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimeUnitDone, this.boundHandleTimeUnitUpdated);
        this.appStateManager.getEvents().on(PluginEvent.UpdateCurrentDateDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimelineViewportDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateMinimapDataDone, this.boundRender);
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

        // 1. Title
        const titleElement = document.createElement("h3");
        titleElement.textContent = "Timeline";
        this.container.appendChild(titleElement);

        // 2. Track container (minimap as base, slider overlayed on top)
        const trackContainer = document.createElement("div");
        trackContainer.className = "nav-timeline-track-container";

        // 3. Minimap FIRST (base layer)
        const minimapContainer = document.createElement("div");
        minimapContainer.className = "nav-minimap-container";
        this.navMinimap = new NavMinimap(minimapContainer, this.appStateManager);
        trackContainer.appendChild(minimapContainer);

        // 4. Slider SECOND (overlayed on top of minimap)
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "nav-timeslider-container";
        this.navTimeSlider = new NavTimeSlider(sliderContainer, this.appStateManager);
        trackContainer.appendChild(sliderContainer);

        this.container.appendChild(trackContainer);

        // 5. Axis (tick marks + labels) LAST
        const axisContainer = document.createElement("div");
        axisContainer.className = "nav-timeline-axis";
        this.createAxis(axisContainer);
        this.container.appendChild(axisContainer);
    }

    private createAxis(container: HTMLElement): void {
        const state = this.appStateManager.getState();

        if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) {
            return;
        }

        const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
        const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
        const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();

        if (globalDurationMs <= 0) return;

        // --- Tick marks ---
        const tickContainer = document.createElement("div");
        tickContainer.className = "axis-tick-marks-container";

        const timeUnit = this.appStateManager.getCurrentTimeUnit();
        const markers = generateTimeMarkersWithMetadata(
            globalMinDate.toISOString(),
            globalMaxDate.toISOString(),
            timeUnit
        );

        markers.forEach(marker => {
            const date = new Date(marker.date);
            const positionPercent = ((date.getTime() - globalMinDate.getTime()) / globalDurationMs) * 100;

            if (positionPercent >= 0 && positionPercent <= 100) {
                const tick = document.createElement("div");
                tick.className = marker.type === 'emphasized'
                    ? "axis-tick-mark emphasized"
                    : "axis-tick-mark";
                tick.style.left = `${positionPercent}%`;
                tickContainer.appendChild(tick);
            }
        });

        container.appendChild(tickContainer);

        // --- Labels at fixed percentages ---
        const labelsContainer = document.createElement("div");
        labelsContainer.className = "axis-labels-container";

        const labelConfigs = [
            { percent: 0, align: 'left' },
            { percent: 25, align: 'center' },
            { percent: 50, align: 'center' },
            { percent: 75, align: 'center' },
            { percent: 100, align: 'right' }
        ];

        labelConfigs.forEach(({ percent, align }) => {
            const dateMs = globalMinDate.getTime() + (percent / 100) * globalDurationMs;
            const date = new Date(dateMs);

            const label = document.createElement("div");
            label.className = `axis-label axis-label-${align}`;
            label.textContent = this.formatDateLabel(date);

            if (align === 'left') {
                label.style.left = '0';
            } else if (align === 'right') {
                label.style.right = '0';
            } else {
                label.style.left = `${percent}%`;
            }

            labelsContainer.appendChild(label);
        });

        container.appendChild(labelsContainer);
    }

    private formatDateLabel(date: Date): string {
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateTasksDone, this.boundHandleTasksUpdated);
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimeUnitDone, this.boundHandleTimeUnitUpdated);
        this.appStateManager.getEvents().off(PluginEvent.UpdateCurrentDateDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimelineViewportDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateMinimapDataDone, this.boundRender);

        if (this.navMinimap) {
            this.navMinimap.destroy();
        }
        if (this.navTimeSlider) {
            this.navTimeSlider.destroy();
        }
    }
}
