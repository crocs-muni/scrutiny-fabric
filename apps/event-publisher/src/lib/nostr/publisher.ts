// src/lib/nostr/publisher.ts
// Relay management and event publishing utilities

import { writable, derived, get } from 'svelte/store';
import { SimplePool } from 'nostr-tools/pool';
import type { VerifiedEvent } from 'nostr-tools';

/**
 * Default relays for publishing SCRUTINY Fabric events
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

/**
 * Relay connection status
 */
export type RelayConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Per-relay status info
 */
export interface RelayStatus {
  url: string;
  status: RelayConnectionStatus;
  error?: string;
}

/**
 * Publish result for a single relay
 */
export interface PublishResult {
  url: string;
  ok: boolean;
  reason?: string;
}

/**
 * Store for configured relays (persisted to localStorage)
 */
function createRelayStore() {
  // Load from localStorage or use defaults
  const stored = typeof window !== 'undefined'
    ? localStorage.getItem('scrutiny_relays_v1')
    : null;

  const initial: string[] = stored ? JSON.parse(stored) : DEFAULT_RELAYS;

  const { subscribe, set, update } = writable<string[]>(initial);

  return {
    subscribe,

    addRelay(url: string): boolean {
      const normalized = normalizeRelayUrl(url);
      if (!normalized) return false;

      let added = false;
      update((relays) => {
        if (!relays.includes(normalized)) {
          relays = [...relays, normalized];
          added = true;
        }
        return relays;
      });

      if (added) {
        persist();
      }
      return added;
    },

    removeRelay(url: string): void {
      update((relays) => relays.filter((r) => r !== url));
      persist();
    },

    resetToDefaults(): void {
      set(DEFAULT_RELAYS);
      persist();
    }
  };

  function persist() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scrutiny_relays_v1', JSON.stringify(get({ subscribe })));
    }
  }
}

/**
 * Normalize a relay URL (ensure wss:// prefix, trim whitespace)
 */
function normalizeRelayUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Add wss:// if missing
  if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) {
    return `wss://${trimmed}`;
  }

  return trimmed;
}

/**
 * Store for user's configured relays
 */
export const relaysStore = createRelayStore();

/**
 * Store for relay connection statuses
 */
export const relayStatuses = writable<Record<string, RelayStatus>>({});

/**
 * Derived store: count of connected relays
 */
export const connectedRelayCount = derived(relayStatuses, ($statuses) => {
  return Object.values($statuses).filter((s) => s.status === 'connected').length;
});

/**
 * Derived store: total relay count
 */
export const totalRelayCount = derived(relaysStore, ($relays) => $relays.length);

// Shared pool for relay connections
let pool: SimplePool | null = null;

/**
 * Get or create the SimplePool instance
 */
function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

/**
 * Publish an event to configured relays
 *
 * @param event - The signed event to publish
 * @param relays - Optional custom relay list (defaults to configured relays)
 * @param timeout - Timeout in ms per relay (default: 5000)
 * @returns Map of relay URL to publish result
 */
export async function publishToRelays(
  event: VerifiedEvent,
  relays?: string[],
  timeout: number = 5000
): Promise<Record<string, PublishResult>> {
  const targetRelays = relays ?? get(relaysStore);
  const results: Record<string, PublishResult> = {};
  const pool = getPool();

  // Initialize all as pending
  for (const url of targetRelays) {
    relayStatuses.update((statuses) => ({
      ...statuses,
      [url]: { url, status: 'connecting' }
    }));
  }

  // Publish to each relay with individual timeout handling
  const publishPromises = targetRelays.map(async (url) => {
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeout);
      });

      // Race between publish and timeout
      await Promise.race([
        pool.publish([url], event),
        timeoutPromise
      ]);

      results[url] = { url, ok: true };
      relayStatuses.update((statuses) => ({
        ...statuses,
        [url]: { url, status: 'connected' }
      }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      results[url] = { url, ok: false, reason };
      relayStatuses.update((statuses) => ({
        ...statuses,
        [url]: { url, status: 'error', error: reason }
      }));
    }
  });

  await Promise.allSettled(publishPromises);

  return results;
}

/**
 * Close all relay connections
 */
export function closeAllRelays(): void {
  if (pool) {
    pool.close(get(relaysStore));
    pool = null;
  }
  relayStatuses.set({});
}

/**
 * Check if offline (browser only)
 */
export function isOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return !navigator.onLine;
}
