import { TimeUnit } from "../../enums/TimeUnit";

/**
 * Adds a specified amount of a given time unit to a date.
 */
export function addTime(date: Date, amount: number, unit: TimeUnit): Date {
	const result = new Date(date);
	if (unit === TimeUnit.DAY) {
		result.setUTCDate(result.getUTCDate() + amount);
	} else if (unit === TimeUnit.WEEK) {
		result.setUTCDate(result.getUTCDate() + amount * 7);
	} else if (unit === TimeUnit.MONTH) {
		// Use UTC methods for consistent month calculations
		result.setUTCMonth(result.getUTCMonth() + amount);
		// Ensure we're on the 1st of the month for month boundaries
		result.setUTCDate(1);
	}
	return result;
}

export function normalizeDate(d: Date): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(year, month, day));
}

/**
 * ISO-8601 week number and week-based year, computed in UTC (all task and
 * column dates are UTC midnights). The week-based year differs from the
 * calendar year around New Year (e.g. 2025-12-29 is 2026 - W01).
 */
export function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // The Thursday of this ISO week determines the ISO year.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return { week, year };
}

/** The user's local calendar date as YYYY-MM-DD. */
export function localTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Format a Date as its UTC calendar date, YYYY-MM-DD. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add days to a YYYY-MM-DD string in the UTC frame (DST-immune). */
export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

// Display formatting reads dates with UTC accessors: task/column dates are
// UTC midnights, and local accessors would render the previous day/week/month
// for users west of UTC.
export function formatDateByTimeUnit(date: Date, unit: TimeUnit): string {
  if (unit === TimeUnit.DAY) {
    return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) + ", " +
           date.getUTCDate().toString().padStart(2, '0') + "." +
           (date.getUTCMonth() + 1).toString().padStart(2, '0') + "." +
           date.getUTCFullYear().toString().slice(-2);
  } else if (unit === TimeUnit.WEEK) {
    const { week, year } = getISOWeek(date);
    return year + " - W" + (week < 10 ? "0" + week : week);
  } else if (unit === TimeUnit.MONTH) {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return date.toDateString();
}

export function formatWeekWithMonth(date: Date, monthDate?: Date): string {
  const { week, year } = getISOWeek(date);
  const dateToUse = monthDate || date;
  const monthAbbr = dateToUse.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return year + " - W" + (week < 10 ? "0" + week : week) + " - " + monthAbbr;
}



