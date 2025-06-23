import { snapViewportToTimeUnit, generateTimeMarkersWithMetadata } from '../src/core/utils/timelineUtils';
import { formatDateByTimeUnit, formatWeekWithMonth } from '../src/core/utils/dateUtils';
import { TimeUnit } from '../src/enums/TimeUnit';

describe('Slider Enhancements', () => {
    describe('Viewport Snapping', () => {
        test('snaps Month view to first of month', () => {
            const viewport = {
                localMinDate: '2024-01-15T10:30:00.000Z',
                localMaxDate: '2024-02-20T15:45:00.000Z'
            };
            
            const snapped = snapViewportToTimeUnit(viewport, TimeUnit.MONTH, 5);
            
            // Min should snap to 1st of January 2024
            expect(new Date(snapped.localMinDate).getUTCDate()).toBe(1);
            expect(new Date(snapped.localMinDate).getUTCMonth()).toBe(0); // January
            
            // Max should be end of 5th month (May 31st)
            const maxDate = new Date(snapped.localMaxDate);
            expect(maxDate.getUTCMonth()).toBe(4); // May (0-indexed)
            expect(maxDate.getUTCDate()).toBe(31); // Last day of May
        });

        test('snaps Week/Day views to Monday', () => {
            const viewport = {
                localMinDate: '2024-01-17T10:30:00.000Z', // Wednesday
                localMaxDate: '2024-01-19T15:45:00.000Z'  // Friday
            };
            
            const snappedWeek = snapViewportToTimeUnit(viewport, TimeUnit.WEEK, 5);
            const snappedDay = snapViewportToTimeUnit(viewport, TimeUnit.DAY, 5);
            
            // Min should snap to Monday (1 = Monday in getUTCDay())
            expect(new Date(snappedWeek.localMinDate).getUTCDay()).toBe(1);
            expect(new Date(snappedDay.localMinDate).getUTCDay()).toBe(1);
            
            // Week: 5 weeks = Monday to Sunday of 5th week (Sunday = 0)
            expect(new Date(snappedWeek.localMaxDate).getUTCDay()).toBe(0);
            
            // Day: 5 days = Monday to Friday (Friday = 5)
            expect(new Date(snappedDay.localMaxDate).getUTCDay()).toBe(5);
        });
    });

    describe('Enhanced Tick Marks', () => {
        test('Month view emphasizes January', () => {
            const markers = generateTimeMarkersWithMetadata(
                '2023-11-01T00:00:00.000Z',
                '2024-03-01T00:00:00.000Z',
                TimeUnit.MONTH
            );
            
            const januaryMarker = markers.find(m => 
                new Date(m.date).getUTCMonth() === 0 && 
                new Date(m.date).getUTCFullYear() === 2024
            );
            
            expect(januaryMarker?.type).toBe('emphasized');
            
            // Test that only January months are emphasized
            markers.forEach(marker => {
                const date = new Date(marker.date);
                if (date.getUTCMonth() === 0) { // January
                    expect(marker.type).toBe('emphasized');
                } else {
                    expect(marker.type).toBe('normal');
                }
            });
        });

        test('Week/Day views show only Monday ticks', () => {
            const markers = generateTimeMarkersWithMetadata(
                '2024-01-01T00:00:00.000Z',
                '2024-01-31T00:00:00.000Z',
                TimeUnit.WEEK
            );
            
            // All markers should be Mondays
            markers.forEach(marker => {
                expect(new Date(marker.date).getUTCDay()).toBe(1);
            });
        });

        test('Week/Day views emphasize month-start Mondays', () => {
            const markers = generateTimeMarkersWithMetadata(
                '2023-12-25T00:00:00.000Z',
                '2024-01-15T00:00:00.000Z',
                TimeUnit.WEEK
            );
            
            // Find the Monday in the first week of January 2024
            const monthStartMonday = markers.find(m => {
                const date = new Date(m.date);
                return date.getUTCMonth() === 0 && 
                       date.getUTCFullYear() === 2024 && 
                       date.getUTCDate() <= 7;
            });
            
            expect(monthStartMonday?.type).toBe('emphasized');
        });
    });

    describe('Enhanced Week Labels', () => {
        test('Week view basic format', () => {
            const date = new Date('2024-01-15T00:00:00.000Z'); // January 15, 2024
            const label = formatDateByTimeUnit(date, TimeUnit.WEEK);
            
            expect(label).toMatch(/2024 - W\d{2}$/);
        });

        test('Week view with month abbreviation for special headers', () => {
            const julyDate = new Date('2024-07-15T00:00:00.000Z');
            const decemberDate = new Date('2024-12-15T00:00:00.000Z');
            
            const julyLabel = formatWeekWithMonth(julyDate);
            const decemberLabel = formatWeekWithMonth(decemberDate);
            
            expect(julyLabel).toContain('Jul');
            expect(decemberLabel).toContain('Dec');
        });
    });
});