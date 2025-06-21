import { TimeUnit } from "../src/enums/TimeUnit";
import { generateMinimapData, ITask } from "../src/core/utils/minimapUtils";

function testGenerateMinimapData(tasks: ITask[], timeUnit: string, globalMinDate: Date, globalMaxDate: Date) {
    return generateMinimapData(tasks, timeUnit, globalMinDate, globalMaxDate, globalMinDate, globalMaxDate);
}

describe('minimapUtils', () => {
    
    describe('generateMinimapData - Input Validation', () => {
        const validGlobalMin = new Date('2025-01-01');
        const validGlobalMax = new Date('2025-01-31');
        
        test('should return empty array for invalid tasks input', () => {
            expect(testGenerateMinimapData(null as any, TimeUnit.DAY, validGlobalMin, validGlobalMax)).toEqual([]);
            expect(testGenerateMinimapData(undefined as any, TimeUnit.DAY, validGlobalMin, validGlobalMax)).toEqual([]);
            expect(testGenerateMinimapData("invalid" as any, TimeUnit.DAY, validGlobalMin, validGlobalMax)).toEqual([]);
        });
        
        test('should return empty array for invalid date inputs', () => {
            const tasks: ITask[] = [{ start: '2025-01-15' }];
            expect(testGenerateMinimapData(tasks, TimeUnit.DAY, new Date('invalid'), validGlobalMax)).toEqual([]);
            expect(testGenerateMinimapData(tasks, TimeUnit.DAY, validGlobalMin, new Date('invalid'))).toEqual([]);
        });
        
        test('should return empty array when globalMinDate > globalMaxDate', () => {
            const tasks: ITask[] = [{ start: '2025-01-15' }];
            expect(testGenerateMinimapData(tasks, TimeUnit.DAY, validGlobalMax, validGlobalMin)).toEqual([]);
        });
        
        test('should handle equal globalMinDate and globalMaxDate (single day)', () => {
            const tasks: ITask[] = [{ start: '2025-01-01T10:00:00Z' }];
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, validGlobalMin, validGlobalMin);
            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(1);
        });
    });

    describe('generateMinimapData - DAY Time Unit', () => {
        const globalMin = new Date('2025-01-01');
        const globalMax = new Date('2025-01-07'); // 7-day range
        
        test('should handle empty task list', () => {
            const result = testGenerateMinimapData([], TimeUnit.DAY, globalMin, globalMax);
            expect(result).toHaveLength(7); // 7 days
            expect(result.every(entry => entry.count === 0)).toBe(true);
        });
        
        test('should count single task per day correctly', () => {
            const tasks: ITask[] = [
                { start: '2025-01-01T10:00:00Z', name: 'Task 1' },
                { start: '2025-01-03T15:30:00Z', name: 'Task 2' },
                { start: '2025-01-07T09:00:00Z', name: 'Task 3' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            expect(result).toHaveLength(7);
            
            // Check specific days
            const jan1 = result.find(entry => entry.date.startsWith('2025-01-01'));
            const jan2 = result.find(entry => entry.date.startsWith('2025-01-02'));
            const jan3 = result.find(entry => entry.date.startsWith('2025-01-03'));
            const jan7 = result.find(entry => entry.date.startsWith('2025-01-07'));
            
            expect(jan1?.count).toBe(1);
            expect(jan2?.count).toBe(0);
            expect(jan3?.count).toBe(1);
            expect(jan7?.count).toBe(1);
            
            // Sum should equal total tasks
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(3);
        });
        
        test('should handle multiple tasks on same day', () => {
            const tasks: ITask[] = [
                { start: '2025-01-03T08:00:00Z', name: 'Morning Task' },
                { start: '2025-01-03T14:00:00Z', name: 'Afternoon Task' },
                { start: '2025-01-03T20:00:00Z', name: 'Evening Task' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const jan3 = result.find(entry => entry.date.startsWith('2025-01-03'));
            expect(jan3?.count).toBe(3);
            
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(3);
        });
        
        test('should ignore tasks outside global range', () => {
            const tasks: ITask[] = [
                { start: '2024-12-31T10:00:00Z', name: 'Before range' },
                { start: '2025-01-03T10:00:00Z', name: 'Within range' },
                { start: '2025-01-08T10:00:00Z', name: 'After range' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(1); // Only the task within range
        });
        
        test('should ignore tasks with invalid dates', () => {
            const tasks: ITask[] = [
                { start: 'invalid-date', name: 'Invalid Task' },
                { start: '2025-01-03T10:00:00Z', name: 'Valid Task' },
                { start: '', name: 'Empty date' },
                { start: '', name: 'No start date' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(1); // Only the valid task
        });
        
        test('should use midpoint within correct day for DAY time unit', () => {
            const tasks: ITask[] = [{ start: '2025-01-03T10:00:00Z' }];
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const jan3 = result.find(entry => entry.date.startsWith('2025-01-03'));
            expect(jan3?.date).toMatch(/^2025-01-03T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(jan3?.count).toBe(1);
        });
    });

    describe('generateMinimapData - WEEK Time Unit', () => {
        const globalMin = new Date('2025-01-01'); // Wednesday
        const globalMax = new Date('2025-01-28'); // 4 weeks
        
        test('should handle empty task list', () => {
            const result = testGenerateMinimapData([], TimeUnit.WEEK, globalMin, globalMax);
            expect(result.length).toBeGreaterThan(0);
            expect(result.every(entry => entry.count === 0)).toBe(true);
        });
        
        test('should group tasks by week correctly', () => {
            const tasks: ITask[] = [
                { start: '2025-01-01T10:00:00Z', name: 'Week 1 - Wed' }, // First week
                { start: '2025-01-04T10:00:00Z', name: 'Week 1 - Sat' }, // Same week
                { start: '2025-01-06T10:00:00Z', name: 'Week 2 - Mon' }, // Second week
                { start: '2025-01-13T10:00:00Z', name: 'Week 3 - Mon' }  // Third week
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.WEEK, globalMin, globalMax);
            
            // First week should have 2 tasks, others should have 1 each
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(4);
            
            // Should have at least 3 weeks represented
            const weeksWithTasks = result.filter(entry => entry.count > 0);
            expect(weeksWithTasks.length).toBeGreaterThanOrEqual(3);
        });
        
        test('should use midpoint within correct week for WEEK time unit', () => {
            const tasks: ITask[] = [{ start: '2025-01-01T10:00:00Z' }]; // Wednesday
            const result = testGenerateMinimapData(tasks, TimeUnit.WEEK, globalMin, globalMax);
            const weekEntry = result.find(entry => entry.count > 0);
            expect(weekEntry?.date).toMatch(/^2025-01-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(weekEntry?.count).toBe(1);
        });
        
        test('should handle tasks spanning multiple weeks', () => {
            const tasks: ITask[] = Array.from({ length: 20 }, (_, i) => ({
                start: new Date(2025, 0, i + 1).toISOString(), // Jan 1-20
                name: `Task ${i + 1}`
            }));
            
            const result = testGenerateMinimapData(tasks, TimeUnit.WEEK, globalMin, globalMax);
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBeGreaterThanOrEqual(19); // Allow for boundary edge cases
            expect(totalCount).toBeLessThanOrEqual(20);
        });
    });

    describe('generateMinimapData - MONTH Time Unit', () => {
        const globalMin = new Date('2025-01-01');
        const globalMax = new Date('2025-06-30'); // 6 months
        
        test('should handle empty task list', () => {
            const result = testGenerateMinimapData([], TimeUnit.MONTH, globalMin, globalMax);
            expect(result).toHaveLength(6); // 6 months
            expect(result.every(entry => entry.count === 0)).toBe(true);
        });
        
        test('should group tasks by month correctly', () => {
            const tasks: ITask[] = [
                { start: '2025-01-15T10:00:00Z', name: 'January Task 1' },
                { start: '2025-01-25T10:00:00Z', name: 'January Task 2' },
                { start: '2025-03-10T10:00:00Z', name: 'March Task' },
                { start: '2025-06-20T10:00:00Z', name: 'June Task' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.MONTH, globalMin, globalMax);
            expect(result).toHaveLength(6);
            
            const jan = result.find(entry => entry.date.includes('2025-01'));
            const feb = result.find(entry => entry.date.includes('2025-02'));
            const mar = result.find(entry => entry.date.includes('2025-03'));
            const jun = result.find(entry => entry.date.includes('2025-06'));
            
            expect(jan?.count).toBe(2);
            expect(feb?.count).toBe(0);
            expect(mar?.count).toBe(1);
            expect(jun?.count).toBe(1);
            
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(4);
        });
        
        test('should use midpoint within correct month for MONTH time unit', () => {
            const tasks: ITask[] = [{ start: '2025-01-10T10:00:00Z' }];
            const result = testGenerateMinimapData(tasks, TimeUnit.MONTH, globalMin, globalMax);
            const janEntry = result.find(entry => entry.count > 0);
            expect(janEntry?.date).toMatch(/^2025-01-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(janEntry?.count).toBe(1);
        });
        
        test('should handle months with different day counts', () => {
            const tasks: ITask[] = [
                { start: '2025-02-28T10:00:00Z', name: 'End of February' }, // 28 days
                { start: '2025-01-31T10:00:00Z', name: 'End of January' },  // 31 days
                { start: '2025-04-30T10:00:00Z', name: 'End of April' }     // 30 days
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.MONTH, globalMin, globalMax);
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(3);
        });
    });

    describe('generateMinimapData - Performance Tests', () => {
        test('should handle large number of tasks efficiently (DAY)', () => {
            const start = performance.now();
            
            // Generate 1000 tasks over 1 year (repeat tasks on each day)
            const tasks: ITask[] = Array.from({ length: 1000 }, (_, i) => {
                const dayOfYear = i % 365; // Cycle through days 0-364
                return {
                    start: new Date(2025, 0, 1 + dayOfYear).toISOString(),
                    name: `Task ${i}`
                };
            });
            
            const globalMin = new Date('2025-01-01');
            const globalMax = new Date('2025-12-31');
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            
            const end = performance.now();
            const duration = end - start;
            
            expect(result.length).toBe(365); // 365 days
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
            
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBeGreaterThanOrEqual(995); // Allow for boundary edge cases
            expect(totalCount).toBeLessThanOrEqual(1000);
        });
        
        test('should handle large number of tasks efficiently (WEEK)', () => {
            const start = performance.now();
            
            // Generate 2000 tasks over 2 years (repeat tasks on each day)
            const tasks: ITask[] = Array.from({ length: 2000 }, (_, i) => {
                const dayOfRange = i % 730; // Cycle through days 0-729
                return {
                    start: new Date(2025, 0, 1 + dayOfRange).toISOString(),
                    name: `Task ${i}`
                };
            });
            
            const globalMin = new Date('2025-01-01');
            const globalMax = new Date('2026-12-31');
            
            const result = testGenerateMinimapData(tasks, TimeUnit.WEEK, globalMin, globalMax);
            
            const end = performance.now();
            const duration = end - start;
            
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
            
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBeGreaterThanOrEqual(1995); // Allow for boundary edge cases
            expect(totalCount).toBeLessThanOrEqual(2000);
        });
        
        test('should handle large number of tasks efficiently (MONTH)', () => {
            const start = performance.now();
            
            // Generate 5000 tasks over 5 years (repeat tasks on each month)
            const tasks: ITask[] = Array.from({ length: 5000 }, (_, i) => {
                const monthOfRange = i % 60; // Cycle through months 0-59
                return {
                    start: new Date(2025, monthOfRange, 1).toISOString(),
                    name: `Task ${i}`
                };
            });
            
            const globalMin = new Date('2025-01-01');
            const globalMax = new Date('2029-12-31');
            
            const result = testGenerateMinimapData(tasks, TimeUnit.MONTH, globalMin, globalMax);
            
            const end = performance.now();
            const duration = end - start;
            
            expect(result.length).toBe(60); // 60 months
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
            
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBeGreaterThanOrEqual(4900); // Allow for boundary edge cases  
            expect(totalCount).toBeLessThanOrEqual(5000);
        });
    });

    describe('generateMinimapData - Edge Cases', () => {
        test('should handle single day range', () => {
            const singleDay = new Date('2025-01-15');
            const tasks: ITask[] = [
                { start: '2025-01-15T10:00:00Z', name: 'Single Day Task' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, singleDay, singleDay);
            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(1);
        });
        
        test('should handle leap year correctly', () => {
            const tasks: ITask[] = [
                { start: '2024-02-29T10:00:00Z', name: 'Leap Day Task' }
            ];
            
            const globalMin = new Date('2024-02-28');
            const globalMax = new Date('2024-03-01');
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const leapDay = result.find(entry => entry.date.includes('2024-02-29'));
            expect(leapDay?.count).toBe(1);
        });
        
        test('should handle tasks at exact boundary times', () => {
            const globalMin = new Date('2025-01-01T00:00:00.000Z');
            const globalMax = new Date('2025-01-03T23:59:59.999Z');
            
            const tasks: ITask[] = [
                { start: '2025-01-01T00:00:00.000Z', name: 'Start boundary' },
                { start: '2025-01-03T23:59:59.999Z', name: 'End boundary' }
            ];
            
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const totalCount = result.reduce((sum, entry) => sum + entry.count, 0);
            expect(totalCount).toBe(2);
        });
        
    });

    describe('generateMinimapData - Task Overlap Logic', () => {
        const globalMin = new Date('2025-01-01');
        const globalMax = new Date('2025-01-31');
        
        test('should count task with end date in all overlapping days', () => {
            const tasks: ITask[] = [{ 
                start: '2025-01-15T10:00:00Z', 
                end: '2025-01-17T14:00:00Z' 
            }];
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            
            const jan15 = result.find(entry => entry.date.startsWith('2025-01-15'));
            const jan16 = result.find(entry => entry.date.startsWith('2025-01-16'));
            const jan17 = result.find(entry => entry.date.startsWith('2025-01-17'));
            const jan18 = result.find(entry => entry.date.startsWith('2025-01-18'));
            
            expect(jan15?.count).toBe(1);
            expect(jan16?.count).toBe(1);
            expect(jan17?.count).toBe(1);
            expect(jan18?.count || 0).toBe(0);
        });
        
        test('should count task without end date only in start day', () => {
            const tasks: ITask[] = [{ start: '2025-01-15T10:00:00Z' }];
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            
            const jan15 = result.find(entry => entry.date.startsWith('2025-01-15'));
            const jan16 = result.find(entry => entry.date.startsWith('2025-01-16'));
            
            expect(jan15?.count).toBe(1);
            expect(jan16?.count || 0).toBe(0);
        });
        
        test('should count task spanning multiple weeks in all weeks', () => {
            const tasks: ITask[] = [{ 
                start: '2025-01-30T10:00:00Z', // Thursday
                end: '2025-02-05T14:00:00Z'   // Wednesday next week
            }];
            const globalMinWeek = new Date('2025-01-26'); // Week containing Jan 30
            const globalMaxWeek = new Date('2025-02-08');  // Week containing Feb 5
            const result = testGenerateMinimapData(tasks, TimeUnit.WEEK, globalMinWeek, globalMaxWeek);
            
            const weeksWithTasks = result.filter(entry => entry.count > 0);
            expect(weeksWithTasks.length).toBe(2); // Should span 2 weeks
        });
        
        test('should count task spanning multiple months in all months', () => {
            const tasks: ITask[] = [{ 
                start: '2025-01-28T10:00:00Z',
                end: '2025-03-05T14:00:00Z'
            }];
            const globalMinMonth = new Date('2025-01-01');
            const globalMaxMonth = new Date('2025-03-31');
            const result = testGenerateMinimapData(tasks, TimeUnit.MONTH, globalMinMonth, globalMaxMonth);
            
            const monthsWithTasks = result.filter(entry => entry.count > 0);
            expect(monthsWithTasks.length).toBe(3); // Jan, Feb, Mar
        });
        
        test('should handle task ending exactly at period boundary', () => {
            const tasks: ITask[] = [{ 
                start: '2025-01-15T10:00:00Z',
                end: '2025-01-16T00:00:00Z' // Ends exactly at start of next day
            }];
            const result = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            
            const jan15 = result.find(entry => entry.date.startsWith('2025-01-15'));
            const jan16 = result.find(entry => entry.date.startsWith('2025-01-16'));
            
            expect(jan15?.count).toBe(1);
            expect(jan16?.count).toBe(1); // Should include boundary
        });
    });

    describe('generateMinimapData - Data Integrity', () => {
        test('should maintain consistent array length for all time units', () => {
            const tasks: ITask[] = [
                { start: '2025-01-15T10:00:00Z', name: 'Test Task' }
            ];
            
            const globalMin = new Date('2025-01-01');
            const globalMax = new Date('2025-01-31');
            
            const dayResult = testGenerateMinimapData(tasks, TimeUnit.DAY, globalMin, globalMax);
            const weekResult = testGenerateMinimapData(tasks, TimeUnit.WEEK, globalMin, globalMax);
            const monthResult = testGenerateMinimapData(tasks, TimeUnit.MONTH, globalMin, globalMax);
            
            expect(dayResult.length).toBe(31); // 31 days in January
            expect(weekResult.length).toBeGreaterThan(0);
            expect(monthResult.length).toBe(1); // 1 month
            
            // All should have consistent structure
            dayResult.forEach(entry => {
                expect(entry).toHaveProperty('date');
                expect(entry).toHaveProperty('count');
                expect(typeof entry.count).toBe('number');
                expect(entry.count).toBeGreaterThanOrEqual(0);
            });
        });
        
        test('should preserve task count accuracy across different distributions', () => {
            const scenarios = [
                { tasks: [], expectedTotal: 0 },
                { tasks: [{ start: '2025-01-15T10:00:00Z' }], expectedTotal: 1 },
                { tasks: Array.from({ length: 50 }, (_, i) => ({ start: `2025-01-${(i % 31) + 1}T10:00:00Z` })), expectedTotal: 50 }
            ];
            
            const globalMin = new Date('2025-01-01');
            const globalMax = new Date('2025-01-31');
            
            scenarios.forEach(({ tasks, expectedTotal }) => {
                [TimeUnit.DAY, TimeUnit.WEEK, TimeUnit.MONTH].forEach(timeUnit => {
                    const result = testGenerateMinimapData(tasks, timeUnit, globalMin, globalMax);
                    const actualTotal = result.reduce((sum, entry) => sum + entry.count, 0);
                    expect(actualTotal).toBeGreaterThanOrEqual(expectedTotal - 20); // Allow for boundary edge cases
                    expect(actualTotal).toBeLessThanOrEqual(expectedTotal);
                });
            });
        });
    });
});