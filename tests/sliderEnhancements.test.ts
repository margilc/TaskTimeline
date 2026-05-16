import { formatDateByTimeUnit, formatWeekWithMonth } from '../src/core/utils/dateUtils';
import { TimeUnit } from '../src/enums/TimeUnit';

describe('Slider Enhancements', () => {
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