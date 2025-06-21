/**
 * Enum defining the available colors for task cards.
 * These colors are used in the settings for color mapping.
 */
export enum TaskCardColor { // Add export keyword
    BrightRed = "#F94144",
    BurntOrange = "#F3722C",
    Orange = "#F8961E",
    Mustard = "#F9C74F",
    OliveGreen = "#90BE6D",
    Teal = "#43AA8B",
    SeaGreen = "#4D908E",
    SlateBlue = "#577590"
  }

/**
 * Returns an array of all TaskCardColor enum values.
 */
export function getTaskCardColors(): TaskCardColor[] {
	return Object.values(TaskCardColor);
}