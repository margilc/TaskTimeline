/**
 * Debug component that listens to all events across the application for debugging purposes.
 * This component is invisible and only logs events to the console.
 */

import { PluginEvent } from '../../enums/events';
import { Events } from 'obsidian';
import { AppStateManager } from '../../core/AppStateManager';

export class DebugEventListener {
    private appStateManager: AppStateManager;
    private eventCount: number = 0;

    constructor(appStateManager: AppStateManager) {
        this.appStateManager = appStateManager;
        this.setupEventListeners();
        console.log('🐛 DebugEventListener initialized - listening to all application events');
    }

    private setupEventListeners(): void {
        // Listen to all events from the PluginEvent enum on AppStateManager
        const events = this.appStateManager.getEvents();
        Object.values(PluginEvent).forEach(eventName => {
            events.on(eventName, (...args: any[]) => {
                this.logEvent(eventName, args);
            });
        });
    }

    private logEvent(eventName: string, args: any[]): void {
        this.eventCount++;
        const timestamp = new Date().toISOString();
        
        console.group(`🐛 Event #${this.eventCount}: ${eventName} @ ${timestamp}`);
        
        if (args && args.length > 0) {
            args.forEach((arg, index) => {
                console.log(`  Arg ${index}:`, arg);
            });
        } else {
            console.log('  No arguments');
        }
        
        console.groupEnd();
    }

    public getEventCount(): number {
        return this.eventCount;
    }

    public destroy(): void {
        // Clean up all event listeners  
        const events = this.appStateManager.getEvents();
        Object.values(PluginEvent).forEach(eventName => {
            events.off(eventName, this.logEvent.bind(this));
        });
        
        console.log(`🐛 DebugEventListener destroyed after listening to ${this.eventCount} events`);
    }
} 