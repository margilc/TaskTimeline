import { 
    PREDEFINED_COLORS, 
    DEFAULT_COLOR, 
    HIDE_COLOR, 
    HIDE_VALUE,
    COLOR_VARIABLES,
    getAvailableColors,
    isValidColor,
    isValidColorVariable 
} from '../src/core/utils/colorUtils';

describe('colorUtils', () => {
    describe('constants', () => {
        test('PREDEFINED_COLORS contains expected colors', () => {
            expect(PREDEFINED_COLORS.BrightRed).toBe("#F94144");
            expect(PREDEFINED_COLORS.OliveGreen).toBe("#90BE6D");
            expect(Object.keys(PREDEFINED_COLORS)).toHaveLength(8);
        });

        test('DEFAULT_COLOR is white', () => {
            expect(DEFAULT_COLOR).toBe("#FFFFFF");
        });

        test('HIDE_VALUE is correct', () => {
            expect(HIDE_VALUE).toBe("hide");
        });

        test('COLOR_VARIABLES contains expected variables', () => {
            expect(COLOR_VARIABLES).toContain("none");
            expect(COLOR_VARIABLES).toContain("category");
            expect(COLOR_VARIABLES).toContain("status");
            expect(COLOR_VARIABLES).toContain("priority");
        });
    });

    describe('getAvailableColors', () => {
        test('returns array of color objects', () => {
            const colors = getAvailableColors();
            expect(Array.isArray(colors)).toBe(true);
            expect(colors).toHaveLength(8);
            expect(colors[0]).toHaveProperty('name');
            expect(colors[0]).toHaveProperty('value');
        });
    });

    describe('isValidColor', () => {
        test('validates predefined colors', () => {
            expect(isValidColor("#F94144")).toBe(true);
            expect(isValidColor("#90BE6D")).toBe(true);
        });

        test('validates special colors', () => {
            expect(isValidColor(DEFAULT_COLOR)).toBe(true);
            expect(isValidColor(HIDE_VALUE)).toBe(true);
        });

        test('rejects invalid colors', () => {
            expect(isValidColor("#invalid")).toBe(false);
            expect(isValidColor("random")).toBe(false);
        });
    });

    describe('isValidColorVariable', () => {
        test('validates valid variables', () => {
            expect(isValidColorVariable("none")).toBe(true);
            expect(isValidColorVariable("category")).toBe(true);
            expect(isValidColorVariable("status")).toBe(true);
            expect(isValidColorVariable("priority")).toBe(true);
        });

        test('rejects invalid variables', () => {
            expect(isValidColorVariable("invalid")).toBe(false);
            expect(isValidColorVariable("")).toBe(false);
        });
    });
});