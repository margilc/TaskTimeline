import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';
import { TimeUnit } from "../../enums/TimeUnit";
import { generateTimeMarkersWithMetadata, snapViewportToTimeUnit } from '../../core/utils/timelineUtils';

export class NavTimeSlider {
    private container: HTMLElement;
    private appStateManager: AppStateManager;
    private track: HTMLElement | null = null;
    private selector: HTMLElement | null = null;
    private dragState: { isDragging: boolean; startX: number; startLeftPercent: number; trackWidth: number } | null = null;
    private animationFrameId: number | null = null;

    // Bound handlers for proper event listener cleanup
    private readonly boundRender = this.render.bind(this);

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.container.className = "nav-time-slider";

        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimelineViewportDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateCurrentDateDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimeUnitDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateSnappedDateBoundariesDone, this.boundRender);
    }

    private render(): void {
        this.container.empty();

        const state = this.appStateManager.getState();
        const settings = state.persistent.settings;
        const viewport = state.volatile.timelineViewport;

        if (!settings?.globalMinDate || !settings?.globalMaxDate || !viewport ||
            !state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) {
            const errorElement = document.createElement("div");
            errorElement.className = "slider-error";
            errorElement.textContent = "Timeline data unavailable";
            this.container.appendChild(errorElement);
            return;
        }

        const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
        const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
        const viewportMinDate = new Date(viewport.localMinDate);
        const viewportMaxDate = new Date(viewport.localMaxDate);
        const currentDate = new Date(this.appStateManager.getCurrentDate());

        if (globalMinDate >= globalMaxDate) {
            const errorElement = document.createElement("div");
            errorElement.className = "slider-error";
            errorElement.textContent = "Invalid date range";
            this.container.appendChild(errorElement);
            return;
        }

        const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();

        this.track = document.createElement("div");
        this.track.className = "slider-track";

        this.createTickMarks(globalMinDate, globalMaxDate, globalDurationMs);
        this.createCurrentDateIndicator(currentDate, globalMinDate, globalDurationMs);
        this.createViewportSelector(viewportMinDate, viewportMaxDate, globalMinDate, globalDurationMs);

        this.container.appendChild(this.track);
    }

    private createTickMarks(globalMinDate: Date, globalMaxDate: Date, globalDurationMs: number): void {
        if (!this.track) return;

        const timeUnit = this.appStateManager.getCurrentTimeUnit();
        const markers = generateTimeMarkersWithMetadata(globalMinDate.toISOString(), globalMaxDate.toISOString(), timeUnit);

        const tickContainer = document.createElement("div");
        tickContainer.className = "slider-tick-marks-container";

        markers.forEach(marker => {
            const date = new Date(marker.date);
            const timeSinceStartMs = date.getTime() - globalMinDate.getTime();
            const positionPercent = (timeSinceStartMs / globalDurationMs) * 100;

            if (positionPercent >= 0 && positionPercent <= 100) {
                const tick = document.createElement("div");
                tick.className = marker.type === 'emphasized' ? "slider-tick-mark emphasized" : "slider-tick-mark";
                tick.style.left = `${positionPercent}%`;
                tickContainer.appendChild(tick);
            }
        });

        this.track.appendChild(tickContainer);
    }

    private createCurrentDateIndicator(currentDate: Date, globalMinDate: Date, globalDurationMs: number): void {
        if (!this.track) return;

        const indicator = document.createElement("div");
        indicator.className = "current-date-indicator";

        const currentMs = currentDate.getTime() - globalMinDate.getTime();
        const positionPercent = Math.max(0, Math.min(100, (currentMs / globalDurationMs) * 100));

        indicator.style.left = `${positionPercent}%`;
        indicator.title = `Current: ${currentDate.toLocaleDateString()}`;

        this.track.appendChild(indicator);
    }

    private createViewportSelector(viewportMinDate: Date, viewportMaxDate: Date, globalMinDate: Date, globalDurationMs: number): void {
        if (!this.track) return;

        const container = document.createElement("div");
        container.className = "viewport-selector-container";

        this.selector = document.createElement("div");
        this.selector.className = "viewport-selector";

        const startMs = viewportMinDate.getTime() - globalMinDate.getTime();
        const endMs = viewportMaxDate.getTime() - globalMinDate.getTime();
        const startPercent = Math.max(0, (startMs / globalDurationMs) * 100);
        const endPercent = Math.min(100, (endMs / globalDurationMs) * 100);
        const widthPercent = Math.max(0.5, endPercent - startPercent);

        this.selector.style.left = `${startPercent}%`;
        this.selector.style.width = `${widthPercent}%`;
        this.selector.title = `${viewportMinDate.toLocaleDateString()} - ${viewportMaxDate.toLocaleDateString()}`;

        this.setupDragHandlers();

        container.appendChild(this.selector);
        this.track.appendChild(container);
        
        this.setupTrackHover();
    }

    private setupDragHandlers(): void {
        if (!this.selector) return;

        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            
            const currentLeftStyle = this.selector!.style.left;
            const startLeftPercent = currentLeftStyle.endsWith('%') 
                ? parseFloat(currentLeftStyle.slice(0, -1)) 
                : 0;
            
            const trackRect = this.track!.getBoundingClientRect();
            const trackWidth = trackRect.width;

            this.dragState = {
                isDragging: true,
                startX: e.clientX,
                startLeftPercent: startLeftPercent,
                trackWidth: trackWidth
            };

            this.selector!.classList.add('dragging');
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        };

        this.selector.addEventListener('mousedown', handleMouseDown);
    }

    private setupTrackHover(): void {
        if (!this.track) return;

        let trackWidth = 0;

        const updateTooltip = (event: MouseEvent) => {
            const state = this.appStateManager.getState();
            
            if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) return;

            if (trackWidth <= 0) {
                const rect = this.track!.getBoundingClientRect();
                trackWidth = rect.width;
                if (trackWidth <= 0) return;
            }

            const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
            const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
            const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();

            const offsetX = event.offsetX;
            const percentX = Math.max(0, Math.min(100, (offsetX / trackWidth) * 100));
            const hoverDateMs = globalMinDate.getTime() + (percentX / 100) * globalDurationMs;
            const hoverDate = new Date(hoverDateMs);

            this.track!.title = `X: ${offsetX}px (${percentX.toFixed(1)}%) | Date: ${hoverDate.toLocaleDateString()}`;
        };

        const clearTooltip = () => {
            this.track!.title = "";
            trackWidth = 0;
        };

        this.track.addEventListener("mousemove", updateTooltip);
        this.track.addEventListener("mouseleave", clearTooltip);
    }

    private handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        
        if (!this.dragState || !this.dragState.isDragging || !this.selector || !this.track) return;

        const currentX = e.clientX;

        // Throttle drag updates with requestAnimationFrame for smooth performance
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(() => {
                if (this.dragState && this.selector) {
                    this.updateSelectorPosition(currentX);
                }
                this.animationFrameId = null;
            });
        }
    };

    private handleMouseUp = () => {
        if (!this.dragState || !this.selector) return;

        this.dragState.isDragging = false;
        this.dragState = null;
        this.selector.classList.remove('dragging');

        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    };

    private updateSelectorPosition(currentX: number): void {
        if (!this.dragState || !this.selector || !this.track) return;

        const { startX, startLeftPercent, trackWidth } = this.dragState;

        if (trackWidth <= 0) return;

        const deltaX = currentX - startX;
        const deltaPercent = (deltaX / trackWidth) * 100;

        let newLeftPercent = startLeftPercent + deltaPercent;

        const widthStyle = this.selector.style.width;
        let widthPercent = 5;
        if (widthStyle.endsWith('%')) {
            const parsedWidth = parseFloat(widthStyle.slice(0, -1));
            if (!isNaN(parsedWidth) && parsedWidth > 0) {
                widthPercent = parsedWidth;
            }
        }

        newLeftPercent = Math.max(0, Math.min(100 - widthPercent, newLeftPercent));

        // Calculate and apply snapped viewport immediately during drag
        const snappedViewport = this.calculateSnappedViewportFromPosition(newLeftPercent, widthPercent);
        
        if (snappedViewport) {
            // Apply the snapped viewport immediately
            this.updateViewportFromSnappedPosition(snappedViewport);
        }
    }

    private updateSelectorTooltip(leftPercent: number, widthPercent: number): void {
        if (!this.selector) return;

        const state = this.appStateManager.getState();
        
        if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) return;

        const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
        const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
        const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();

        const newMinMs = globalMinDate.getTime() + (leftPercent / 100) * globalDurationMs;
        const newMaxMs = globalMinDate.getTime() + ((leftPercent + widthPercent) / 100) * globalDurationMs;
        
        const newMinDate = new Date(newMinMs);
        const newMaxDate = new Date(newMaxMs);

        if (!isNaN(newMinDate.getTime()) && !isNaN(newMaxDate.getTime())) {
            this.selector.title = `${newMinDate.toLocaleDateString()} - ${newMaxDate.toLocaleDateString()}`;
        }
    }

    private calculateSnappedViewportFromPosition(leftPercent: number, widthPercent: number): {localMinDate: string, localMaxDate: string} | null {
        const state = this.appStateManager.getState();
        
        if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) return null;

        const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
        const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
        
        if (isNaN(globalMinDate.getTime()) || isNaN(globalMaxDate.getTime())) return null;
        
        const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();
        
        if (globalDurationMs <= 0) return null;
        
        if (isNaN(leftPercent) || isNaN(widthPercent) || leftPercent < 0 || widthPercent <= 0) return null;

        const newMinMs = globalMinDate.getTime() + (leftPercent / 100) * globalDurationMs;
        const newMaxMs = globalMinDate.getTime() + ((leftPercent + widthPercent) / 100) * globalDurationMs;
        
        if (isNaN(newMinMs) || isNaN(newMaxMs) || newMinMs >= newMaxMs) return null;
        
        const newMinDate = new Date(newMinMs);
        const newMaxDate = new Date(newMaxMs);
        
        if (isNaN(newMinDate.getTime()) || isNaN(newMaxDate.getTime())) return null;

        const viewport = {
            localMinDate: newMinDate.toISOString(),
            localMaxDate: newMaxDate.toISOString()
        };

        // Apply snapping based on current time unit
        const timeUnit = this.appStateManager.getCurrentTimeUnit();
        const numberOfColumns = this.appStateManager.getState().persistent.settings?.numberOfColumns || 7;
        return snapViewportToTimeUnit(viewport, timeUnit, numberOfColumns);
    }

    private updateViewportFromSnappedPosition(snappedViewport: {localMinDate: string, localMaxDate: string}): void {
        this.appStateManager.getEvents().trigger(PluginEvent.UpdateTimelineViewportPending, snappedViewport);
    }

    private updateViewportFromPosition(leftPercent: number, widthPercent: number): void {
        const state = this.appStateManager.getState();
        
        if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) return;

        const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
        const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);
        
        if (isNaN(globalMinDate.getTime()) || isNaN(globalMaxDate.getTime())) return;
        
        const globalDurationMs = globalMaxDate.getTime() - globalMinDate.getTime();
        
        if (globalDurationMs <= 0) return;
        
        if (isNaN(leftPercent) || isNaN(widthPercent) || leftPercent < 0 || widthPercent <= 0) return;

        const newMinMs = globalMinDate.getTime() + (leftPercent / 100) * globalDurationMs;
        const newMaxMs = globalMinDate.getTime() + ((leftPercent + widthPercent) / 100) * globalDurationMs;
        
        if (isNaN(newMinMs) || isNaN(newMaxMs) || newMinMs >= newMaxMs) return;
        
        const newMinDate = new Date(newMinMs);
        const newMaxDate = new Date(newMaxMs);
        
        if (isNaN(newMinDate.getTime()) || isNaN(newMaxDate.getTime())) return;

        const newViewport = {
            localMinDate: newMinDate.toISOString(),
            localMaxDate: newMaxDate.toISOString()
        };

        this.appStateManager.getEvents().trigger(PluginEvent.UpdateTimelineViewportPending, newViewport);
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimelineViewportDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateCurrentDateDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimeUnitDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateSnappedDateBoundariesDone, this.boundRender);

        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}