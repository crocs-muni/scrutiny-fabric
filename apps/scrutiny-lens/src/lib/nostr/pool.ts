/**
 * Nostr relay pool — NDK singleton and connection lifecycle.
 *
 * Wraps @nostr-dev-kit/ndk with ndk-cache-dexie and relay store integration.
 * All relay queries go through this module.
 */

import NDK, { type NDKRelay } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { get } from 'svelte/store';
import { enabledRelayUrls, setRelayStatus } from '../stores/relayStore.js';
import { normalizeRelayUrl } from '../security/sanitize.js';

// ---------------------------------------------------------------------------
// NDK singleton
// ---------------------------------------------------------------------------

let ndk: NDK | null = null;
let onRelayConnect: ((relay: NDKRelay) => void) | null = null;
let onRelayDisconnect: ((relay: NDKRelay) => void) | null = null;

export function getNdk(): NDK {
    if (typeof window === 'undefined') throw new Error('[SCRUTINY:pool] NDK is browser-only');
    if (!ndk) {
        const relayUrls = get(enabledRelayUrls);
        const cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'scrutiny-ndk' });

        ndk = new NDK({
            explicitRelayUrls: relayUrls,
            cacheAdapter,
            enableOutboxModel: false,
            autoConnectUserRelays: false,
        });

        // Store references so destroyNdk can remove them.
        // Bridge NDK relay lifecycle events → relayStore.
        onRelayConnect = (relay: NDKRelay) => {
            const url = normalizeRelayUrl(relay.url) ?? relay.url;
            console.log('[SCRUTINY:pool] Relay connected:', url);
            setRelayStatus(url, true);
        };
        onRelayDisconnect = (relay: NDKRelay) => {
            const url = normalizeRelayUrl(relay.url) ?? relay.url;
            console.log('[SCRUTINY:pool] Relay disconnected:', url);
            setRelayStatus(url, false, 'Disconnected');
        };

        ndk.pool.on('relay:connect', onRelayConnect);
        ndk.pool.on('relay:disconnect', onRelayDisconnect);

        // Mark all as connecting immediately
        relayUrls.forEach(url => setRelayStatus(url, false, 'Connecting...'));

        void ndk.connect();
        console.log('[SCRUTINY:pool] NDK instance created', { relayCount: relayUrls.length });
    }
    return ndk;
}

/**
 * Add a relay to the live NDK pool and begin connecting.
 * No-op if NDK hasn't been initialized yet (getNdk() will include it at startup).
 */
export function addNdkRelay(url: string): void {
    if (!ndk) return;
    const normalized = normalizeRelayUrl(url) ?? url;
    setRelayStatus(normalized, false, 'Connecting...');
    ndk.addExplicitRelay(normalized, undefined, true);
}

/**
 * Remove a relay from the live NDK pool and disconnect it.
 * No-op if NDK hasn't been initialized yet.
 */
export function removeNdkRelay(url: string): void {
    if (!ndk) return;
    const normalized = normalizeRelayUrl(url) ?? url;
    ndk.pool.removeRelay(normalized);
}

export function destroyNdk(): void {
    if (ndk) {
        console.log('[SCRUTINY:pool] Destroying NDK');
        if (onRelayConnect) ndk.pool.off('relay:connect', onRelayConnect);
        if (onRelayDisconnect) ndk.pool.off('relay:disconnect', onRelayDisconnect);
        onRelayConnect = null;
        onRelayDisconnect = null;
        for (const relay of ndk.pool.relays.values()) {
            relay.disconnect();
        }
        ndk = null;
    }
}
