import {
    PREDEFINED_COLORS,
    GREY_BACKGROUNDS,
    DEFAULT_COLOR,
    HIDE_COLOR,
    HIDE_VALUE,
    COLOR_VARIABLES,
    getAvailableColors,
    getAvailableBackgrounds,
    isValidColor,
    isValidColorVariable
} from '../src/core/utils/colorUtils';

describe('colorUtils', () => {
    describe('constants', () => {
        test('PREDEFINED_COLORS contains Solarized accent colors', () => {
            expect(PREDEFINED_COLORS.Yellow).toBe("#b58900");
            expect(PREDEFINED_COLORS.Blue).toBe("#268bd2");
            expect(Object.keys(PREDEFINED_COLORS)).toHaveLength(8);
        });

        test('GREY_BACKGROUNDS contains expected colors', () => {
            expect(GREY_BACKGROUNDS["Grey 900"]).toBe("#1a1a1a");
            expect(GREY_BACKGROUNDS["Grey 800"]).toBe("#2d2d2d");
            expect(Object.keys(GREY_BACKGROUNDS)).toHaveLength(6);
        });

        test('DEFAULT_COLOR is Grey 800', () => {
            expect(DEFAULT_COLOR).toBe("#2d2d2d");
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

    describe('getAvailableBackgrounds', () => {
        test('returns array of background color objects', () => {
            const backgrounds = getAvailableBackgrounds();
            expect(Array.isArray(backgrounds)).toBe(true);
            expect(backgrounds).toHaveLength(6);
            expect(backgrounds[0]).toHaveProperty('name');
            expect(backgrounds[0]).toHaveProperty('value');
        });
    });

    describe('isValidColor', () => {
        test('validates predefined accent colors', () => {
            expect(isValidColor("#b58900")).toBe(true);  // Yellow
            expect(isValidColor("#268bd2")).toBe(true);  // Blue
        });

        test('validates grey background colors', () => {
            expect(isValidColor("#1a1a1a")).toBe(true);  // Grey 900
            expect(isValidColor("#2d2d2d")).toBe(true);  // Grey 800
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