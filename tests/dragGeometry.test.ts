import { TimeUnit } from '../src/enums/TimeUnit';
import {
    pointerToColumnIndex,
    snappedDatesForColumnRange,
    readCardLayout,
    clampColumn,
    groupAtPointer,
    ColumnHeader,
} from '../src/components/BoardContainer/interaction/dragGeometry';

function makeDayHeaders(startISO: string, count: number): ColumnHeader[] {
    const headers: ColumnHeader[] = [];
    const start = new Date(startISO);
    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        headers.push({ date: d, index: i + 1 });
    }
    return headers;
}

function makeMockContentEl(
    rect: { left: number; top: number; width: number; height: number },
    scrollLeft = 0,
    scrollTop = 0
): HTMLElement {
    return {
        scrollLeft,
        scrollTop,
        getBoundingClientRect: () => ({
            ...rect,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            x: rect.left,
            y: rect.top,
            toJSON: () => ({}),
        }),
    } as unknown as HTMLElement;
}

describe('pointerToColumnIndex (gap = 0, light mode)', () => {
    const contentEl = makeMockContentEl({ left: 100, top: 0, width: 1000, height: 500 });
    const columnWidth = 50;
    const columnGap = 0;
    const totalColumns = 10;

    it('returns column 1 inside the leading header column', () => {
        expect(pointerToColumnIndex(120, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('first pixel of data col 1', () => {
        expect(pointerToColumnIndex(150, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('mid-column maps to that column', () => {
        // clientX = 200 → contentX = 100 → dataX = 50 (col2 start)
        expect(pointerToColumnIndex(200, contentEl, columnWidth, columnGap, totalColumns)).toBe(2);
    });

    it('clamps past last column', () => {
        expect(pointerToColumnIndex(10_000, contentEl, columnWidth, columnGap, totalColumns)).toBe(10);
    });

    it('accounts for horizontal scroll', () => {
        const scrolled = makeMockContentEl({ left: 100, top: 0, width: 1000, height: 500 }, 200, 0);
        // clientX = 150, scrollLeft = 200 → contentX = 250 → dataX = 200 → col 5
        expect(pointerToColumnIndex(150, scrolled, columnWidth, columnGap, totalColumns)).toBe(5);
    });
});

describe('pointerToColumnIndex (gap = 6, dark mode)', () => {
    const contentEl = makeMockContentEl({ left: 100, top: 0, width: 1000, height: 500 });
    const columnWidth = 50;
    const columnGap = 6;
    const totalColumns = 10;
    // Header occupies x=[0, 50]. Gap x=[50, 56]. Data col 1 at x=[56, 106]. Gap [106, 112].
    // Data col 2 at x=[112, 162]. Data col N starts at x = N * (50+6) = 56*N.

    it('header area → clamp to 1', () => {
        // clientX = 120 → contentX = 20 → dataX = 20 - 50 - 6 = -36 → clamp 1
        expect(pointerToColumnIndex(120, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('first gap (between header and data col 1) → clamp to 1', () => {
        // clientX = 153 → contentX = 53 → dataX = -3 → clamp 1
        expect(pointerToColumnIndex(153, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('exact start of data col 1 → col 1', () => {
        // clientX = 156 → contentX = 56 → dataX = 0 → col 1
        expect(pointerToColumnIndex(156, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('mid-data-col-1 → col 1', () => {
        // clientX = 180 → contentX = 80 → dataX = 24 → floor(24/56) + 1 = 1
        expect(pointerToColumnIndex(180, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('gap after data col 1 (between col 1 and col 2) → col 1 (left wins)', () => {
        // clientX = 209 → contentX = 109 → dataX = 53 → floor(53/56) + 1 = 1
        expect(pointerToColumnIndex(209, contentEl, columnWidth, columnGap, totalColumns)).toBe(1);
    });

    it('start of data col 2 → col 2', () => {
        // clientX = 212 → contentX = 112 → dataX = 56 → floor(56/56) + 1 = 2
        expect(pointerToColumnIndex(212, contentEl, columnWidth, columnGap, totalColumns)).toBe(2);
    });
});

describe('clampColumn', () => {
    it('clamps low/high', () => {
        expect(clampColumn(0, 10)).toBe(1);
        expect(clampColumn(11, 10)).toBe(10);
        expect(clampColumn(5, 10)).toBe(5);
    });

    it('handles totalColumns = 0', () => {
        expect(clampColumn(5, 0)).toBe(1);
    });
});

describe('readCardLayout (inversion of BoardTaskGroup grid-placement)', () => {
    function makeCard(gridColumnStart: string, gridColumnEnd: string, gridRowStart: string): HTMLElement {
        // Minimal HTMLElement-like object with a `style` getter that returns the
        // values we want. The function only reads .style.gridColumnStart etc.
        return {
            style: { gridColumnStart, gridColumnEnd, gridRowStart },
        } as unknown as HTMLElement;
    }

    it('parses a single-column task at the first data column', () => {
        // BoardTaskGroup sets gridColumnStart = max(2, startX + 1), so startX=1 → "2"
        const card = makeCard('2', 'span 1', '1');
        expect(readCardLayout(card)).toEqual({ xStart: 1, xEnd: 1, y: 0, span: 1 });
    });

    it('parses a multi-day task across columns 5..7', () => {
        // startX=5 → gridColumnStart="6"; span=3
        const card = makeCard('6', 'span 3', '1');
        expect(readCardLayout(card)).toEqual({ xStart: 5, xEnd: 7, y: 0, span: 3 });
    });

    it('recovers y from gridRowStart for cards in multi-row groups', () => {
        // y=2 → gridRowStart="3"
        const card = makeCard('8', 'span 2', '3');
        expect(readCardLayout(card)).toEqual({ xStart: 7, xEnd: 8, y: 2, span: 2 });
    });

    it('handles whitespace variations in span notation', () => {
        const card = makeCard('4', 'span    5', '2');
        expect(readCardLayout(card)).toEqual({ xStart: 3, xEnd: 7, y: 1, span: 5 });
    });

    it('falls back to safe defaults for malformed style strings', () => {
        const card = makeCard('', '', '');
        // Defaults: gridColumnStart→"2" (xStart=1), gridColumnEnd→"span 1", gridRowStart→"1" (y=0)
        expect(readCardLayout(card)).toEqual({ xStart: 1, xEnd: 1, y: 0, span: 1 });
    });
});

describe('snappedDatesForColumnRange', () => {
    describe('day zoom', () => {
        const headers = makeDayHeaders('2026-01-01T00:00:00Z', 10);

        it('single column', () => {
            const { start, end } = snappedDatesForColumnRange(1, 1, headers, TimeUnit.DAY);
            expect(start).toBe('2026-01-01');
            expect(end).toBe('2026-01-01');
        });

        it('multi-column range', () => {
            const { start, end } = snappedDatesForColumnRange(2, 5, headers, TimeUnit.DAY);
            expect(start).toBe('2026-01-02');
            expect(end).toBe('2026-01-05');
        });
    });

    describe('week zoom', () => {
        const headers: ColumnHeader[] = [
            { date: new Date('2026-01-01T00:00:00Z'), index: 1 },
            { date: new Date('2026-01-08T00:00:00Z'), index: 2 },
            { date: new Date('2026-01-15T00:00:00Z'), index: 3 },
        ];

        it('start snaps to Monday, end to Sunday', () => {
            const { start, end } = snappedDatesForColumnRange(1, 1, headers, TimeUnit.WEEK);
            expect(start).toBe('2025-12-29');
            expect(end).toBe('2026-01-04');
        });

        it('spans full weeks', () => {
            const { start, end } = snappedDatesForColumnRange(1, 3, headers, TimeUnit.WEEK);
            expect(start).toBe('2025-12-29');
            expect(end).toBe('2026-01-18');
        });
    });

    describe('month zoom', () => {
        const headers: ColumnHeader[] = [
            { date: new Date('2026-02-15T00:00:00Z'), index: 1 },
            { date: new Date('2026-03-15T00:00:00Z'), index: 2 },
            { date: new Date('2026-04-15T00:00:00Z'), index: 3 },
        ];

        it('snaps start to 1st, end to last day of end month', () => {
            const { start, end } = snappedDatesForColumnRange(1, 1, headers, TimeUnit.MONTH);
            expect(start).toBe('2026-02-01');
            expect(end).toBe('2026-02-28');
        });

        it('handles 31-day month', () => {
            const { start, end } = snappedDatesForColumnRange(2, 2, headers, TimeUnit.MONTH);
            expect(start).toBe('2026-03-01');
            expect(end).toBe('2026-03-31');
        });

        it('spans multiple months', () => {
            const { start, end } = snappedDatesForColumnRange(1, 3, headers, TimeUnit.MONTH);
            expect(start).toBe('2026-02-01');
            expect(end).toBe('2026-04-30');
        });
    });

    it('clamps invalid column indices', () => {
        const headers = makeDayHeaders('2026-01-01T00:00:00Z', 5);
        const { start, end } = snappedDatesForColumnRange(-3, 999, headers, TimeUnit.DAY);
        expect(start).toBe('2026-01-01');
        expect(end).toBe('2026-01-05');
    });

    it('swaps end<start by clamping end to start', () => {
        const headers = makeDayHeaders('2026-01-01T00:00:00Z', 10);
        const { start, end } = snappedDatesForColumnRange(5, 2, headers, TimeUnit.DAY);
        expect(start).toBe('2026-01-05');
        expect(end).toBe('2026-01-05');
    });
});

describe('groupAtPointer (nearest-by-distance)', () => {
    const makeRect = (top: number, bottom: number): DOMRect => ({
        top, bottom, left: 0, right: 100,
        x: 0, y: top, width: 100, height: bottom - top,
        toJSON: () => ({}),
    });
    const fakeEl = (name: string) => ({ dataset: { groupName: name } } as unknown as HTMLElement);

    // Three groups with 6px gaps between them, like the real layout in dark mode:
    //   A: [0, 100]
    //   gap: (100, 106)
    //   B: [106, 200]
    //   gap: (200, 206)
    //   C: [206, 300]
    const groupRects = [
        { groupName: 'A', rect: makeRect(0, 100), element: fakeEl('A') },
        { groupName: 'B', rect: makeRect(106, 200), element: fakeEl('B') },
        { groupName: 'C', rect: makeRect(206, 300), element: fakeEl('C') },
    ];

    it('returns the group containing the pointer', () => {
        expect(groupAtPointer(50, groupRects)?.groupName).toBe('A');
        expect(groupAtPointer(150, groupRects)?.groupName).toBe('B');
        expect(groupAtPointer(250, groupRects)?.groupName).toBe('C');
    });

    it('clamps above the first group', () => {
        expect(groupAtPointer(-50, groupRects)?.groupName).toBe('A');
    });

    it('clamps below the last group', () => {
        expect(groupAtPointer(5000, groupRects)?.groupName).toBe('C');
    });

    it('returns the nearer group when the pointer is in an inter-group gap (closer to A)', () => {
        // y=102 is 2px below A (gap 100..106), 4px above B. Distance to A = 2, to B = 4 → A wins.
        expect(groupAtPointer(102, groupRects)?.groupName).toBe('A');
    });

    it('returns the nearer group when the pointer is in an inter-group gap (closer to B)', () => {
        // y=104 is 4px below A, 2px above B → B wins.
        expect(groupAtPointer(104, groupRects)?.groupName).toBe('B');
    });

    it('returns the nearer group when the pointer is in the second gap', () => {
        // y=203 is 3px below B, 3px above C → first-encountered (B) wins on tie.
        // y=204 → distance to B = 4, distance to C = 2 → C wins.
        expect(groupAtPointer(204, groupRects)?.groupName).toBe('C');
    });

    it('returns null when there are no groups', () => {
        expect(groupAtPointer(50, [])).toBeNull();
    });
});
