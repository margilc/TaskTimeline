// Muted accent colors for color variable picker (dark-mode friendly)
export const PREDEFINED_COLORS = {
    Blue:   "#4E6E8E",  // muted steel blue
    Green:  "#5A8A6A",  // muted sage
    Amber:  "#9E8A5A",  // warm muted gold
    Rose:   "#9E6A72",  // dusty rose
    Violet: "#7E6E9E",  // soft lavender
} as const;

// Grey shades for default card/button color setting
export const GREY_BACKGROUNDS = {
    "Grey 900": "#1a1a1a",  // darkest
    "Grey 800": "#2d2d2d",
    "Grey 700": "#404040",
    "Grey 600": "#525252",
    "Grey 500": "#6b6b6b",
    "Grey 400": "#858585"   // lightest
} as const;

export const DEFAULT_COLOR = "#2d2d2d";  // Grey 800
export const HIDE_COLOR = "#D1D5DB";
export const HIDE_VALUE = "hide";

export const COLOR_VARIABLES = [
    "none",
    "category", 
    "status",
    "priority"
] as const;

export type ColorVariable = typeof COLOR_VARIABLES[number];
export type PredefinedColor = typeof PREDEFINED_COLORS[keyof typeof PREDEFINED_COLORS];
export type GreyBackground = typeof GREY_BACKGROUNDS[keyof typeof GREY_BACKGROUNDS];

export function getAvailableColors(): Array<{name: string, value: string}> {
    return Object.entries(PREDEFINED_COLORS).map(([name, value]) => ({
        name,
        value
    }));
}

export function getAvailableBackgrounds(): Array<{name: string, value: string}> {
    return Object.entries(GREY_BACKGROUNDS).map(([name, value]) => ({
        name,
        value
    }));
}

export function isValidColor(color: string): boolean {
    return color === HIDE_VALUE ||
           color === DEFAULT_COLOR ||
           Object.values(PREDEFINED_COLORS).includes(color as PredefinedColor) ||
           Object.values(GREY_BACKGROUNDS).includes(color as GreyBackground);
}

export function isValidColorVariable(variable: string): variable is ColorVariable {
    return COLOR_VARIABLES.includes(variable as ColorVariable);
}

export function isTaskHidden(
    task: { category?: string; status?: string; priority?: number | string },
    colorVariable: string | undefined,
    currentProject: string | undefined,
    colorMappings: Record<string, Record<string, Record<string, string>>> | undefined
): boolean {
    if (!colorVariable || colorVariable === 'none' || !currentProject) return false;

    let taskValue: string | undefined;
    switch (colorVariable) {
        case 'category': taskValue = task.category; break;
        case 'status': taskValue = task.status; break;
        case 'priority': taskValue = task.priority?.toString(); break;
        default: return false;
    }

    if (!taskValue) return false;

    return colorMappings?.[currentProject]?.[colorVariable]?.[taskValue] === HIDE_VALUE;
}