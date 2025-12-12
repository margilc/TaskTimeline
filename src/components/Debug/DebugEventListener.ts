/**
 * Debug component that listens to all events across the application for debugging purposes.
 */

import { PluginEvent } from '../../enums/events';
import { Events } from 'obsidian';
import { AppStateManager } from '../../core/AppStateManager';

export class DebugEventListener {
    private appStateManager: AppStateManager;
    private eventCount: number = 0;
    // Store handler references for proper cleanup
    private eventHandlers: Map<string, (...args: any[]) => void> = new Map();

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen to all events from the PluginEvent enum on AppStateManager
        const events = this.appStateManager.getEvents();
        Object.values(PluginEvent).forEach(eventName => {
            const handler = (...args: any[]) => {
                this.logEvent(eventName, args);
            };
            this.eventHandlers.set(eventName, handler);
            events.on(eventName, handler);
        });
    }

    private logEvent(eventName: string, args: any[]): void {
        this.eventCount++;
        const timestamp = new Date().toISOString();
        
        
        // Log timeline viewport and column headers specifically
        const state = this.appStateManager.getState();
        
        
        // Column headers logged only when specifically needed for debugging
        // Removed automatic logging to reduce console spam
        
    }

    public getEventCount(): number {
        return this.eventCount;
    }

    public destroy(): void {
        // Clean up all event listeners using stored handler references
        const events = this.appStateManager.getEvents();
        this.eventHandlers.forEach((handler, eventName) => {
            events.off(eventName, handler);
        });
        this.eventHandlers.clear();
    }
} 