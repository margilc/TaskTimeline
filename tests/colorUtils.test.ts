import {
    PREDEFINED_COLORS,
    GREY_BACKGROUNDS,
    DEFAULT_COLOR,
    HIDE_COLOR,
    HIDE_VALUE,
    getAvailableColors,
    getAvailableBackgrounds,
    isValidColor,
    isValidColorVariable
} from '../src/core/utils/colorUtils';

describe('colorUtils', () => {
    describe('getAvailableColors', () => {
        test('returns array of color objects', () => {
            const colors = getAvailableColors();
            expect(Array.isArray(colors)).toBe(true);
            expect(colors).toHaveLength(5);
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
            expect(isValidColor("#9E8A5A")).toBe(true);  // Amber
            expect(isValidColor("#4E6E8E")).toBe(true);  // Blue
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