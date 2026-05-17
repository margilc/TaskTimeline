/**
 * Sanitize a task name into a filename identifier.
 * Strips non-alphanumeric characters, replaces spaces with underscores, truncates to 20 chars.
 */
export function nameToIdentifier(name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    return safeName.slice(0, 20);
}

/**
 * Convert a filename identifier back to a human-readable name.
 * Replaces underscores with spaces.
 */
export function identifierToName(identifier: string): string {
    return identifier.replace(/_/g, ' ');
}

/**
 * Parse a task filename into its date and identifier components.
 * Returns null if the filename doesn't match the expected format.
 */
export function parseTaskFilename(filename: string): { dateStr: string; identifier: string } | null {
    const match = filename.match(/^(\d{8})_(.+)\.md$/);
    if (!match) return null;
    return { dateStr: match[1], identifier: match[2] };
}

export function formatDateForFilename(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}