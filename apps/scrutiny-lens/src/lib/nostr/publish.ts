/**
 * NIP-07 event signing and publishing via NDK.
 *
 * Uses window.nostr for event signing (NIP-07 browser extension).
 * After signing, broadcasts to relays via NDKEvent.publish().
 */

import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { getNdk } from './pool.js';

const NIP07_SIGN_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// Local event types (replace nostr-tools type imports)
// ---------------------------------------------------------------------------

export interface UnsignedNostrEvent {
    kind: number;
    content: string;
    tags: string[][];
    pubkey: string;
    created_at: number;
}

export interface SignedNostrEvent extends UnsignedNostrEvent {
    id: string;
    sig: string;
}

// ---------------------------------------------------------------------------
// NIP-07 types
// ---------------------------------------------------------------------------

/**
 * The NIP-07 window.nostr interface provided by browser extensions
 * like Alby, nos2x, Amber. Cast window.nostr to this type when calling
 * to avoid conflicts with nostr-tools' global declaration.
 */
interface Nip07Nostr {
    getPublicKey(): Promise<string>;
    signEvent(event: UnsignedNostrEvent): Promise<SignedNostrEvent>;
}

// ---------------------------------------------------------------------------
// NIP-07 helpers
// ---------------------------------------------------------------------------

/**
 * Check if a NIP-07 extension is available.
 */
export function hasNip07(): boolean {
    const available = typeof window !== 'undefined' && !!window.nostr;
    console.log('[SCRUTINY:nip07] hasNip07:', available);
    return available;
}

/**
 * Await NIP-07 extension injection. Some extensions inject window.nostr asynchronously.
 *
 * Note: this polling loop is always bounded by `timeout` and clears its interval
 * in both resolve paths, so it does not run indefinitely after caller teardown.
 */
export async function detectNostrExtension(timeout = 1000, interval = 50): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (window.nostr) {
        console.log('[SCRUTINY:nip07] Extension already present');
        return true;
    }

    console.log('[SCRUTINY:nip07] Polling for extension...', { timeout, interval });
    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
            if (window.nostr) {
                clearInterval(check);
                console.log('[SCRUTINY:nip07] Extension detected after', Date.now() - start, 'ms');
                resolve(true);
            } else if (Date.now() - start > timeout) {
                clearInterval(check);
                console.warn('[SCRUTINY:nip07] Extension NOT detected after', timeout, 'ms');
                resolve(false);
            }
        }, interval);
    });
}

/**
 * Get the user's public key from the NIP-07 extension.
 * Throws if no extension is available.
 */
export async function getPublicKey(): Promise<string> {
    const found = await detectNostrExtension();
    if (!found) {
        throw new Error(
            'No NIP-07 extension found. Install Alby, nos2x, or Amber to sign events.'
        );
    }
    const pk = await (window.nostr as unknown as Nip07Nostr).getPublicKey();
    console.log('[SCRUTINY:nip07] Got public key:', pk.slice(0, 12) + '…');
    return pk;
}

/**
 * Sign an unsigned event using the NIP-07 extension.
 * Throws if no extension is available.
 * Automatically injects a `client` tag before signing to identify the origin.
 */
export async function signEvent(unsignedEvent: UnsignedNostrEvent): Promise<SignedNostrEvent> {
    const found = await detectNostrExtension();
    if (!found) {
        throw new Error(
            'No NIP-07 extension found. Install Alby, nos2x, or Amber to sign events.'
        );
    }

    // Add client tag matching `lens-demo` practice to denote origin
    if (typeof window !== 'undefined' && window.location) {
        const hasClientTag = unsignedEvent.tags.some(([name]) => name === 'client');
        if (!hasClientTag) {
            unsignedEvent.tags.push(['client', window.location.origin]);
        }
    }

    console.log('[SCRUTINY:nip07] Signing event', { kind: unsignedEvent.kind, tags: unsignedEvent.tags.length });
    const nip07 = window.nostr as unknown as Nip07Nostr;
    const signed = await Promise.race([
        nip07.signEvent(unsignedEvent),
        new Promise<SignedNostrEvent>((_, reject) =>
            setTimeout(() => reject(new Error('NIP-07 signing timed out')), NIP07_SIGN_TIMEOUT_MS)
        )
    ]);
    console.log('[SCRUTINY:nip07] Signed event ID:', signed.id?.slice(0, 12) + '…');
    return signed;
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface PublishResult {
    url: string;
    success: boolean;
    error?: string;
}

/**
 * Publish a signed event to multiple relays via NDK.
 * Returns per-relay success/failure status.
 */
export async function publishToRelays(
    relayUrls: string[],
    event: SignedNostrEvent
): Promise<PublishResult[]> {
    const ndk = getNdk();

    console.log('[SCRUTINY:publish] Publishing to', relayUrls.length, 'relays, event:', event.id?.slice(0, 12) + '…');

    try {
        // Reconstruct as NDKEvent so we can use NDK's publish
        const ndkEvent = new NDKEvent(ndk, {
            id: event.id,
            pubkey: event.pubkey,
            kind: event.kind,
            content: event.content,
            tags: event.tags,
            created_at: event.created_at,
            sig: event.sig,
        });

        const relaySet = NDKRelaySet.fromRelayUrls(relayUrls, ndk);
        // publish() returns the Set of relays that acknowledged the event
        const publishedRelays = await ndkEvent.publish(relaySet);
        const publishedUrls = new Set([...publishedRelays].map(r => r.url));

        const results: PublishResult[] = relayUrls.map((url) => {
            const success = publishedUrls.has(url);
            if (success) {
                console.log('[SCRUTINY:publish] ✅ Success:', url);
            } else {
                console.warn('[SCRUTINY:publish] ❌ Not acknowledged:', url);
            }
            return { url, success, error: success ? undefined : 'Not acknowledged by relay' };
        });

        console.log('[SCRUTINY:publish] Publish complete:', results.filter(r => r.success).length, 'ok,', results.filter(r => !r.success).length, 'failed');
        return results;

    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[SCRUTINY:publish] ❌ Publish failed:', errMsg);
        return relayUrls.map((url) => ({ url, success: false, error: errMsg }));
    }
}
