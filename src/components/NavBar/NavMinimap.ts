import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';

export class NavMinimap {
    private container: HTMLElement;
    private appStateManager: AppStateManager;

    // Bound handlers for proper event listener cleanup
    private readonly boundRender = this.render.bind(this);

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.container.className = "nav-minimap";

        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateMinimapDataDone, this.boundRender);
        this.appStateManager.getEvents().on(PluginEvent.UpdateSnappedDateBoundariesDone, this.boundRender);
    }

    private render(): void {
        this.container.empty();

        const minimapData = this.appStateManager.getMinimapData();
        const state = this.appStateManager.getState();
        const settings = state.persistent.settings;

        // Basic validation
        if (!minimapData || !Array.isArray(minimapData) || !minimapData.length) {
            const emptyState = document.createElement("div");
            emptyState.className = "minimap-empty-state";
            emptyState.textContent = "No timeline data available";
            this.container.appendChild(emptyState);
            return;
        }

        // Validate date ranges
        if (!state.volatile.globalMinDateSnapped || !state.volatile.globalMaxDateSnapped) {
            const emptyState = document.createElement("div");
            emptyState.className = "minimap-empty-state";
            emptyState.textContent = "Invalid date range";
            this.container.appendChild(emptyState);
            return;
        }

        const globalMinDate = new Date(state.volatile.globalMinDateSnapped);
        const globalMaxDate = new Date(state.volatile.globalMaxDateSnapped);

        if (isNaN(globalMinDate.getTime()) || isNaN(globalMaxDate.getTime())) {
            const emptyState = document.createElement("div");
            emptyState.className = "minimap-empty-state";
            emptyState.textContent = "Invalid date range";
            this.container.appendChild(emptyState);
            return;
        }

        // Find max count for normalization (ensure at least 1 to avoid division by zero)
        const maxCount = Math.max(...minimapData.map((entry) => {
            return entry && typeof entry.count === 'number' ? entry.count : 0;
        }), 1);

        // Create the minimap visualization container
        const visualization = document.createElement("div");
        visualization.className = "minimap-visualization";

        // Create squares for the minimap
        minimapData.forEach((entry) => {
            // Skip invalid entries
            if (!entry || !entry.date) {
                return;
            }

            const square = document.createElement("div");
            square.className = "minimap-square";

            // Calculate grayscale color (white for zero, black for max)
            const count = typeof entry.count === 'number' ? entry.count : 0;
            const normalizedCount = Math.max(0, Math.min(1, count / maxCount));
            const colorValue = Math.round(255 - normalizedCount * 255);
            const colorHex = colorValue.toString(16).padStart(2, '0');
            square.style.backgroundColor = `#${colorHex}${colorHex}${colorHex}`;

            // Add tooltip with date and count information
            try {
                const date = new Date(entry.date);
                square.title = `${date.toLocaleDateString()}: ${count} tasks`;
            } catch (e) {
                square.title = `${entry.date}: ${count} tasks`;
            }

            visualization.appendChild(square);
        });

        this.container.appendChild(visualization);
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateMinimapDataDone, this.boundRender);
        this.appStateManager.getEvents().off(PluginEvent.UpdateSnappedDateBoundariesDone, this.boundRender);
    }
} 