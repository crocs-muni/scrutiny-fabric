/**
 * Typed subscription helpers using scrutiny-fabric query builders.
 *
 * Bridges the scrutiny-fabric RelayFilter type to NDK and provides
 * high-level query functions. NDK + ndk-cache-dexie handle caching
 * automatically — no manual cache calls needed here.
 */

import { NDKSubscriptionCacheUsage, type NDKEvent, type NDKFilter, type NDKSubscription } from '@nostr-dev-kit/ndk';
import type { NostrEvent, RelayFilter } from '@scrutiny-fabric/scrutiny-fabric';
import {
    buildProductBindingsFilter,
    buildMetadataBindingsFilter,
    buildEventsByIdsFilter,
    buildEventsTargetingFilter,
    buildScrutinyTypesFilter,
    type ScrutinyType
} from '@scrutiny-fabric/scrutiny-fabric';
import { getNdk } from './pool.js';

export interface FetchScrutinyEventsOptions {
    timeoutMs?: number;
    onEvent?: (event: NostrEvent) => void;
}

// ---------------------------------------------------------------------------
// Type bridges
// ---------------------------------------------------------------------------

/**
 * Convert a scrutiny-fabric RelayFilter to an NDKFilter.
 * Both follow NIP-01 — the shapes are structurally identical.
 */
function toNdkFilter(sf: RelayFilter): NDKFilter {
    const f: Record<string, unknown> = {};
    if (sf.kinds) f.kinds = [...sf.kinds];
    if (sf.ids !== undefined && sf.ids.length > 0) f.ids = [...sf.ids];
    if (sf['#t']) f['#t'] = [...sf['#t']];
    if (sf['#e']) f['#e'] = [...sf['#e']];
    if (sf['#q']) f['#q'] = [...sf['#q']];
    if (sf.limit !== undefined) f.limit = sf.limit;
    if (sf.since !== undefined) f.since = sf.since;
    if (sf.until !== undefined) f.until = sf.until;
    console.log('[SCRUTINY:sub] toNdkFilter', { input: sf, output: f });
    return f as NDKFilter;
}

/**
 * Convert an NDKEvent to the scrutiny-fabric NostrEvent type.
 * Explicit field projection avoids issues with NDKEvent class methods.
 */
function toScrutinyEvent(e: NDKEvent): NostrEvent {
    return {
        id: e.id,
        pubkey: e.pubkey,
        kind: e.kind ?? 1,
        content: e.content,
        created_at: e.created_at ?? 0,
        tags: e.tags,
    } as unknown as NostrEvent;
}

// ---------------------------------------------------------------------------
// Core internal helper
// ---------------------------------------------------------------------------

/**
 * Fetch events from relays using NDK. NDK checks ndk-cache-dexie first
 * before hitting relays. Resolves on EOSE or timeout.
 */
async function fetchWithNdk(
    relayUrls: string[],
    filter: NDKFilter,
    timeoutMs = 10000,
    onEvent?: (event: NDKEvent) => void
): Promise<NDKEvent[]> {
    const ndk = getNdk();
    const collected: NDKEvent[] = [];

    console.log('[SCRUTINY:pool] fetchWithNdk', {
        relayUrls,
        filter: JSON.parse(JSON.stringify(filter)),
        timeoutMs
    });

    return new Promise((resolve) => {
        // Capture subscription so we can stop it on the timeout path.
        // In NDK 2.x, handlers are passed as the 3rd argument (NDKSubscriptionEventHandlers),
        // not inside opts.
        let sub: NDKSubscription | undefined;

        const timer = setTimeout(() => {
            sub?.stop();
            console.log('[SCRUTINY:pool] Timeout reached, resolving with', collected.length, 'events');
            resolve(collected);
        }, timeoutMs);

        sub = ndk.subscribe(
            filter,
            { closeOnEose: true, relayUrls },
            {
                onEvent: (event: NDKEvent) => {
                    collected.push(event);
                    onEvent?.(event);
                    console.log('[SCRUTINY:pool] Received event', event.id?.slice(0, 12) + '…');
                },
                onEose: () => {
                    clearTimeout(timer);
                    console.log('[SCRUTINY:pool] EOSE, collected:', collected.length);
                    resolve(collected);
                }
            }
        );
    });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function unpackOptions(options?: number | FetchScrutinyEventsOptions) {
    return {
        timeoutMs: typeof options === 'number' ? options : options?.timeoutMs,
        onEvent:   typeof options === 'number' ? undefined : options?.onEvent,
    };
}

// ---------------------------------------------------------------------------
// High-level query functions
// ---------------------------------------------------------------------------

/**
 * Fetch SCRUTINY events of specific types from relays.
 */
export async function fetchScrutinyEvents(
    relayUrls: string[],
    types: ScrutinyType[],
    options?: number | FetchScrutinyEventsOptions
): Promise<NostrEvent[]> {
    const { timeoutMs, onEvent } = unpackOptions(options);

    console.log('[SCRUTINY:sub] fetchScrutinyEvents', { types, relayCount: relayUrls.length });
    const t0 = performance.now();
    const filter = buildScrutinyTypesFilter(types);
    const raw = await fetchWithNdk(
        relayUrls,
        toNdkFilter(filter),
        timeoutMs,
        onEvent ? (e) => onEvent(toScrutinyEvent(e)) : undefined
    );
    const events = raw.map(toScrutinyEvent);
    console.log('[SCRUTINY:sub] fetchScrutinyEvents done:', events.length, 'events in', Math.round(performance.now() - t0), 'ms');
    return events;
}

/**
 * Fetch bindings anchored to a product (Product-First Traversal, spec §7).
 */
export async function fetchProductBindings(
    relayUrls: string[],
    productEventId: string,
    options?: number | FetchScrutinyEventsOptions
): Promise<NostrEvent[]> {
    const { timeoutMs, onEvent } = unpackOptions(options);

    console.log('[SCRUTINY:sub] fetchProductBindings', { productEventId: productEventId.slice(0, 12) + '…' });
    const t0 = performance.now();
    const filter = buildProductBindingsFilter(productEventId);
    const raw = await fetchWithNdk(
        relayUrls,
        toNdkFilter(filter),
        timeoutMs,
        onEvent ? (e) => onEvent(toScrutinyEvent(e)) : undefined
    );
    const events = raw.map(toScrutinyEvent);
    console.log('[SCRUTINY:sub] fetchProductBindings done:', events.length, 'events in', Math.round(performance.now() - t0), 'ms');
    return events;
}

/**
 * Fetch bindings quoting a metadata event (Metadata-First Traversal, spec §7).
 */
export async function fetchMetadataBindings(
    relayUrls: string[],
    metadataEventId: string,
    options?: number | FetchScrutinyEventsOptions
): Promise<NostrEvent[]> {
    const { timeoutMs, onEvent } = unpackOptions(options);

    console.log('[SCRUTINY:sub] fetchMetadataBindings', { metadataEventId: metadataEventId.slice(0, 12) + '…' });
    const t0 = performance.now();
    const filter = buildMetadataBindingsFilter(metadataEventId);
    const raw = await fetchWithNdk(
        relayUrls,
        toNdkFilter(filter),
        timeoutMs,
        onEvent ? (e) => onEvent(toScrutinyEvent(e)) : undefined
    );
    const events = raw.map(toScrutinyEvent);
    console.log('[SCRUTINY:sub] fetchMetadataBindings done:', events.length, 'events in', Math.round(performance.now() - t0), 'ms');
    return events;
}

/**
 * Fetch specific events by their IDs.
 * NDK + ndk-cache-dexie handles cache-first automatically.
 */
export async function fetchEventsByIds(
    relayUrls: string[],
    ids: string[],
    options?: number | FetchScrutinyEventsOptions
): Promise<NostrEvent[]> {
    const { timeoutMs, onEvent } = unpackOptions(options);

    if (ids.length === 0) return [];
    console.log('[SCRUTINY:sub] fetchEventsByIds', { count: ids.length, ids: ids.map(id => id.slice(0, 12) + '…') });
    const t0 = performance.now();
    const filter = buildEventsByIdsFilter(ids);
    const raw = await fetchWithNdk(
        relayUrls,
        toNdkFilter(filter),
        timeoutMs,
        onEvent ? (e) => onEvent(toScrutinyEvent(e)) : undefined
    );
    const events = raw.map(toScrutinyEvent);

    // Preserve requested ordering
    const byId = new Map(events.map(e => [e.id as string, e]));
    const ordered = ids
        .map(id => byId.get(id))
        .filter((e): e is NostrEvent => !!e);

    console.log('[SCRUTINY:sub] fetchEventsByIds done:', ordered.length, '/', ids.length, 'found in', Math.round(performance.now() - t0), 'ms');
    return ordered;
}

/**
 * Fetch all update/retraction/binding events targeting specific event IDs.
 */
export async function fetchEventsTargeting(
    relayUrls: string[],
    targetIds: string[],
    options?: number | FetchScrutinyEventsOptions
): Promise<NostrEvent[]> {
    const { timeoutMs, onEvent } = unpackOptions(options);

    if (targetIds.length === 0) return [];
    console.log('[SCRUTINY:sub] fetchEventsTargeting', { count: targetIds.length });
    const t0 = performance.now();
    const filter = buildEventsTargetingFilter(targetIds);
    const raw = await fetchWithNdk(
        relayUrls,
        toNdkFilter(filter),
        timeoutMs,
        onEvent ? (e) => onEvent(toScrutinyEvent(e)) : undefined
    );
    const events = raw.map(toScrutinyEvent);
    console.log('[SCRUTINY:sub] fetchEventsTargeting done:', events.length, 'events in', Math.round(performance.now() - t0), 'ms');
    return events;
}

// ---------------------------------------------------------------------------
// NDK cache-only helpers (replace deleted cache/events.ts and cache/searches.ts)
// ---------------------------------------------------------------------------

/**
 * Fetch a single event from the local ndk-cache-dexie store without hitting relays.
 * Drop-in replacement for the deleted getCachedEvent() from cache/events.ts.
 */
export async function getCachedEvent(id: string): Promise<NostrEvent | null> {
    if (typeof window === 'undefined') return null;
    const ndk = getNdk();
    const event = await ndk.fetchEvent(
        { ids: [id] },
        { cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE }
    );
    return event ? toScrutinyEvent(event) : null;
}

/**
 * Fetch all scrutiny events from the local ndk-cache-dexie store without hitting relays.
 * Drop-in replacement for the deleted getAllCachedEvents() from cache/events.ts.
 */
export async function getAllCachedEvents(): Promise<NostrEvent[]> {
    if (typeof window === 'undefined') return [];
    const ndk = getNdk();
    const filter = buildScrutinyTypesFilter(['product', 'metadata', 'binding']);
    const raw = await ndk.fetchEvents(
        toNdkFilter(filter),
        { cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE }
    );
    return Array.from(raw, toScrutinyEvent);
}

/**
 * Fetch a Nostr profile (kind 0) for a given pubkey.
 * NDK checks ndk-cache-dexie first.
 */
export async function fetchAuthorProfile(
    relayUrls: string[],
    pubkey: string,
): Promise<NostrEvent | null> {
    const ndk = getNdk();
    const event = await ndk.fetchEvent(
        { kinds: [0], authors: [pubkey], limit: 1 },
        { relayUrls, closeOnEose: true },
    );
    return event ? toScrutinyEvent(event) : null;
}
