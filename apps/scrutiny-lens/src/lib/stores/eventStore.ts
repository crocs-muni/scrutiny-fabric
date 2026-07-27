/**
 * Event store — reactive map of loaded SCRUTINY events.
 *
 * Serves as the in-memory event index for the current session.
 */

import { writable, derived } from 'svelte/store';
import type { NostrEvent, ScrutinyType } from '@scrutiny-fabric/scrutiny-fabric';
import { extractScrutinyType } from '@scrutiny-fabric/scrutiny-fabric';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Map of event ID → NostrEvent for all loaded events. */
export const events = writable<Map<string, NostrEvent>>(new Map());

/** Loading state indicator. */
export const eventsLoading = writable<boolean>(false);

/** Count of loaded events for display. */
export const eventCount = derived(events, ($events) => $events.size);

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

/** All loaded events as an array. */
export const eventList = derived(events, ($events) => [...$events.values()]);

/** Events grouped by SCRUTINY type. */
export const eventsByType = derived(events, ($events) => {
    const grouped: Record<ScrutinyType, NostrEvent[]> = {
        product: [],
        metadata: [],
        binding: [],
        update: [],
        retract: []
    };
    for (const event of $events.values()) {
        const type = extractScrutinyType(event);
        if (type) {
            grouped[type].push(event);
        }
    }
    return grouped;
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add events to the store (merge into existing map).
 */
export function addEvents(newEvents: NostrEvent[]): void {
    if (newEvents.length === 0) return;
    console.log('[SCRUTINY:events] addEvents:', newEvents.length, 'new events');
    events.update((map) => {
        const next = new Map(map);
        for (const event of newEvents) {
            next.set(event.id as string, event);
        }
        console.log('[SCRUTINY:events] Store now has', next.size, 'total events');
        return next;
    });
}

/**
 * Clear all loaded events.
 */
export function clearEvents(): void {
    console.log('[SCRUTINY:events] Clearing all events');
    events.set(new Map());
}

/**
 * Get a single event by ID from the store.
 */
export function getEvent(id: string): NostrEvent | undefined {
    let result: NostrEvent | undefined;
    events.subscribe((map) => {
        result = map.get(id);
    })();
    return result;
}
