import { TimeUnit } from "../../enums/TimeUnit";

/**
 * Adds a specified amount of a given time unit to a date.
 */
export function addTime(date: Date, amount: number, unit: TimeUnit): Date {
	const result = new Date(date);
	if (unit === TimeUnit.DAY) {
		result.setDate(result.getDate() + amount);
	} else if (unit === TimeUnit.WEEK) {
		result.setDate(result.getDate() + amount * 7);
	} else if (unit === TimeUnit.MONTH) {
		result.setMonth(result.getMonth() + amount);
	}
	return result;
}

export function formatDateYYYYMMDD(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.error("Invalid date provided to formatDateYYYYMMDD:", date);
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function diffDays(d1: Date, d2: Date): number {
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

export function normalizeDate(d: Date): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(year, month, day));
}

export function getWeekNumber(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  return 1 + Math.round((((tempDate.getTime() - week1.getTime()) / 86400000) - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function getMonthYear(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function isDateInRange(date: Date, start: Date, end: Date, timeUnit: TimeUnit): boolean {
  // Handle invalid inputs
  if (!date || !start || !end) {
    return false;
  }
  
  try {
    // Ensure we're working with Date objects
    const d = date instanceof Date ? date : new Date(date);
    const s = start instanceof Date ? start : new Date(start);
    const e = end instanceof Date ? end : new Date(end);
    
    // Check for invalid dates
    if (isNaN(d.getTime()) || isNaN(s.getTime()) || isNaN(e.getTime())) {
      return false;
    }
    
    const normalizedDate = normalizeDate(d);
    let normalizedStart = normalizeDate(s);
    let normalizedEnd = normalizeDate(e);
    
    // If end date is before start date, swap them for the comparison
    if (normalizedEnd < normalizedStart) {
      [normalizedStart, normalizedEnd] = [normalizedEnd, normalizedStart];
    }
    
    if (timeUnit === TimeUnit.DAY) {
      // For day view, check if the date is between start and end (inclusive)
      return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
    } else if (timeUnit === TimeUnit.WEEK) {
      // For week view, we need to compare the actual dates rather than week strings
      // This fix handles tasks that span multiple weeks
      
      // Get start of week for each date
      const dayOfWeek = normalizedDate.getDay() || 7; // Convert Sunday (0) to 7
      const startOfWeekDate = new Date(normalizedDate);
      startOfWeekDate.setDate(normalizedDate.getDate() - dayOfWeek + 1); // Monday is 1, so +1
      
      // For tasks that span multiple weeks, we need to check if the date's week
      // is anywhere between the start and end dates of the task
      return startOfWeekDate >= normalizedStart && startOfWeekDate <= normalizedEnd;
    } else if (timeUnit === TimeUnit.MONTH) {
      // For month view, get the month and year
      const dateMonthYear = getMonthYear(normalizedDate);
      const startMonthYear = getMonthYear(normalizedStart);
      const endMonthYear = getMonthYear(normalizedEnd);
      
      // Check if the date's month-year is between start and end month-years
      return dateMonthYear >= startMonthYear && dateMonthYear <= endMonthYear;
    }
  } catch (error) {
    console.error("Error in isDateInRange:", error);
    return false;
  }
  
  return false;
}


export function formatDateByTimeUnit(date: Date, unit: TimeUnit): string {
  if (unit === TimeUnit.DAY) {
    return date.toLocaleDateString('en-US', { weekday: 'short' }) + ", " + 
           date.getDate().toString().padStart(2, '0') + "." + 
           (date.getMonth() + 1).toString().padStart(2, '0') + "." + 
           date.getFullYear().toString().slice(-2);
  } else if (unit === TimeUnit.WEEK) {
    const weekNum = getWeekNumber(date);
    return date.getFullYear() + " - W" + (weekNum < 10 ? "0" + weekNum : weekNum);
  } else if (unit === TimeUnit.MONTH) {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return date.toDateString();
}

export function formatWeekWithMonth(date: Date, monthDate?: Date): string {
  const weekNum = getWeekNumber(date);
  const dateToUse = monthDate || date;
  const monthAbbr = dateToUse.toLocaleDateString('en-US', { month: 'short' });
  return date.getFullYear() + " - W" + (weekNum < 10 ? "0" + weekNum : weekNum) + " - " + monthAbbr;
}

export function diffMonths(a: Date, b: Date): number {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}


