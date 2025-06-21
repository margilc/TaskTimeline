export const PREDEFINED_COLORS = {
    BrightRed: "#F94144",
    BurntOrange: "#F3722C", 
    Orange: "#F8961E",
    Mustard: "#F9C74F",
    OliveGreen: "#90BE6D",
    Teal: "#43AA8B",
    SeaGreen: "#4D908E",
    SlateBlue: "#577590"
} as const;

export const DEFAULT_COLOR = "#FFFFFF";
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

export function getAvailableColors(): Array<{name: string, value: string}> {
    return Object.entries(PREDEFINED_COLORS).map(([name, value]) => ({
        name,
        value
    }));
}

export function isValidColor(color: string): boolean {
    return color === HIDE_VALUE || 
           color === DEFAULT_COLOR ||
           Object.values(PREDEFINED_COLORS).includes(color as PredefinedColor);
}

export function isValidColorVariable(variable: string): variable is ColorVariable {
    return COLOR_VARIABLES.includes(variable as ColorVariable);
}