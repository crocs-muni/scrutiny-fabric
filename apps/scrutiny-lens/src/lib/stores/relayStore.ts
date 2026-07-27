/**
 * Relay store — reactive relay list, connection status, and pool lifecycle.
 *
 * Single source of truth for the relay configuration.
 */

import { writable, derived, get } from 'svelte/store';
import type { StoredRelayConfig } from '../cache/db.js';
import { loadRelayConfigs, saveRelayConfig, removeRelayConfig } from '../cache/config.js';
import { isValidRelayUrl, normalizeRelayUrl } from '../security/sanitize.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelayConfig {
    url: string;
    enabled: boolean;
    label?: string;
}

export interface RelayStatus {
    url: string;
    connected: boolean;
    lastError?: string;
}

// ---------------------------------------------------------------------------
// Default relay list (single source of truth)
// ---------------------------------------------------------------------------

export const DEFAULT_RELAYS: RelayConfig[] = [
    { url: 'ws://localhost:7777', enabled: false, label: 'Local Dev Relay' },
    { url: 'wss://relay.damus.io', enabled: true, label: 'Damus' },
    { url: 'wss://relay.nostr.band', enabled: true, label: 'Nostr.band' },
    { url: 'wss://nos.lol', enabled: true, label: 'nos.lol' },
    { url: 'wss://relay.primal.net', enabled: true, label: 'Primal' }
];

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/** All configured relays. */
export const relays = writable<RelayConfig[]>([...DEFAULT_RELAYS]);

/** Per-relay connection status. */
export const relayStatuses = writable<Map<string, RelayStatus>>(new Map());

/** URLs of enabled relays only. */
export const enabledRelayUrls = derived(relays, ($relays) =>
    $relays.filter((r) => r.enabled).map((r) => r.url)
);

/** Overall health indicator. */
export const relayHealth = derived(relayStatuses, ($statuses) => {
    const all = [...$statuses.values()];
    if (all.length === 0) return 'unknown' as const;
    const connectedCount = all.filter((s) => s.connected).length;
    if (connectedCount === 0) return 'red' as const;
    if (connectedCount < all.length) return 'yellow' as const;
    return 'green' as const;
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Load relay config from localStorage, falling back to defaults.
 */
export async function initRelays(): Promise<void> {
    console.log('[SCRUTINY:relay] Initializing relay config from localStorage');
    const stored = await loadRelayConfigs();
    if (stored.length > 0) {
        // Merge: add any new defaults that aren't already stored
        const storedUrls = new Set(stored.map((r) => r.url));
        const merged = [...stored];
        for (const def of DEFAULT_RELAYS) {
            if (!storedUrls.has(def.url)) {
                merged.unshift(def); // new defaults go to the top
                await saveRelayConfig(def);
            }
        }
        relays.set(merged);
        console.log('[SCRUTINY:relay] Loaded', merged.length, 'relays from localStorage (merged with defaults)');
    } else {
        // Persist defaults on first run
        for (const relay of DEFAULT_RELAYS) {
            await saveRelayConfig(relay);
        }
        relays.set([...DEFAULT_RELAYS]);
        console.log('[SCRUTINY:relay] First run — persisted', DEFAULT_RELAYS.length, 'default relays');
    }
}

/**
 * Add a new relay. Validates URL and normalizes it.
 */
export async function addRelay(url: string, label?: string): Promise<boolean> {
    const normalized = normalizeRelayUrl(url);
    if (!normalized) {
        console.warn('[SCRUTINY:relay] addRelay rejected — invalid URL:', url);
        return false;
    }

    const current = get(relays);
    if (current.some((r) => r.url === normalized)) {
        console.warn('[SCRUTINY:relay] addRelay rejected — duplicate:', normalized);
        return false;
    }

    const config: RelayConfig = { url: normalized, enabled: true, label };
    relays.update((r) => [...r, config]);
    await saveRelayConfig(config);
    console.log('[SCRUTINY:relay] Added relay:', normalized);
    return true;
}

/**
 * Remove a relay by URL.
 */
export async function removeRelay(url: string): Promise<void> {
    console.log('[SCRUTINY:relay] Removing relay:', url);
    relays.update((r) => r.filter((relay) => relay.url !== url));
    await removeRelayConfig(url);
}

/**
 * Toggle a relay on/off.
 */
export async function toggleRelay(url: string): Promise<void> {
    const previous = get(relays);

    relays.update((r) =>
        r.map((relay) =>
            relay.url === url ? { ...relay, enabled: !relay.enabled } : relay
        )
    );
    const current = get(relays);
    const relay = current.find((r) => r.url === url);
    if (relay) {
        console.log('[SCRUTINY:relay] Toggled', url, '→', relay.enabled ? 'enabled' : 'disabled');
        try {
            await saveRelayConfig(relay);
        } catch (err) {
            console.error('[SCRUTINY:relay] Failed to persist toggle; rolling back:', err);
            relays.set(previous);
            throw err;
        }
    }
}

/**
 * Update relay connection status.
 */
export function setRelayStatus(url: string, connected: boolean, error?: string): void {
    console.log('[SCRUTINY:relay] Status:', url, connected ? '✅ connected' : '❌ disconnected', error ? `(${error})` : '');
    relayStatuses.update((statuses) => {
        const current = statuses.get(url);
        if (current?.connected === connected && current?.lastError === error) return statuses;
        const next = new Map(statuses);
        next.set(url, { url, connected, lastError: error });
        return next;
    });
}
