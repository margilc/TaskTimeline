import { AppStateManager } from '../../core/AppStateManager';
import { PluginEvent } from '../../enums/events';
import { TimeUnit } from '../../enums/TimeUnit';

const VIEW_TO_TIME_UNIT = {
    "DayView": TimeUnit.DAY,
    "WeekView": TimeUnit.WEEK,
    "MonthView": TimeUnit.MONTH
} as const;

const TIME_UNIT_TO_VIEW = {
    [TimeUnit.DAY]: "DayView",
    [TimeUnit.WEEK]: "WeekView", 
    [TimeUnit.MONTH]: "MonthView"
} as const;

export class NavViewsSelection {
    private container: HTMLElement;
    private appStateManager: AppStateManager;
    private viewOptions: { value: string; label: string }[];
    private currentView: string;
    private buttons: Map<string, HTMLButtonElement>;

    // Bound handlers for proper event listener cleanup
    private readonly boundRender = this.render.bind(this);

    constructor(container: HTMLElement, appStateManager: AppStateManager) {
        this.container = container;
        this.appStateManager = appStateManager;
        this.container.className = "nav-views nav-view-buttons";

        this.viewOptions = [
            { value: "DayView", label: "Day" },
            { value: "WeekView", label: "Week" },
            { value: "MonthView", label: "Month" },
        ];
        this.buttons = new Map();

        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.appStateManager.getEvents().on(PluginEvent.UpdateTimeUnitDone, this.boundRender);
    }

    private render(): void {
        this.container.empty();
        this.buttons.clear();

        // Get current time unit from state and convert to view
        const currentTimeUnit = this.appStateManager.getCurrentTimeUnit();
        this.currentView = TIME_UNIT_TO_VIEW[currentTimeUnit as TimeUnit] || "DayView";

        this.viewOptions.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "nav-view-button";
            button.textContent = option.label;
            button.dataset.view = option.value;

            if (option.value === this.currentView) {
                button.addClass("is-active");
            }

            button.addEventListener("click", () => {
                this.handleButtonClick(option.value);
            });

            this.buttons.set(option.value, button);
            this.container.appendChild(button);
        });
    }

    private handleButtonClick(viewValue: string): void {
        if (viewValue === this.currentView) {
            return;
        }
        
        const timeUnit = VIEW_TO_TIME_UNIT[viewValue as keyof typeof VIEW_TO_TIME_UNIT];
        if (timeUnit) {
            this.appStateManager.getEvents().trigger(PluginEvent.UpdateTimeUnitPending, timeUnit);
        }
    }

    public destroy(): void {
        this.appStateManager.getEvents().off(PluginEvent.UpdateTimeUnitDone, this.boundRender);
    }
}
