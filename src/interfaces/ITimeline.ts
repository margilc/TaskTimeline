/**
 * Timeline-related interfaces for managing date ranges, time units, and minimap functionality
 */
import { TimeUnit } from "../enums/TimeUnit";

/**
 * Represents a single entry in the minimap, with a date and task count
 */
export interface IMinimapEntry {
  date: Date;
  count: number;
}

/**
 * Represents the entire minimap with entries and methods
 */
export interface IMinimap {
  entries: IMinimapEntry[];
  getEntries(): IMinimapEntry[];
  updateCounts(tasks: any[]): void;
}

/**
 * Represents timeline management with date ranges and time unit
 */
export interface ITimeline {
  // Timeline date properties
  currentDate: Date;
  globalMinDate: Date;
  globalMaxDate: Date;
  localMinDate: Date;
  localMaxDate: Date;
  currentTimeUnit: TimeUnit;
  
  // Timeline methods
  updateTimeUnit(timeUnit: TimeUnit, reinitializeViewport?: boolean): void;
  updateViewport(newMinDate: Date, newMaxDate: Date): void;
  initializeViewport(): void;
  getMinimap(): IMinimapEntry[];
} 