/**
 * Trust store — reactive set of trusted pubkeys.
 *
 * Events authored by trusted pubkeys are shown by default.
 * Events connected via trusted BindingEvents are also admitted.
 */

import { writable, derived, get } from 'svelte/store';
import { loadTrustedPubkeys, addTrustedPubkey, removeTrustedPubkey } from '../cache/config.js';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Set of trusted hex pubkeys. */
export const trustedPubkeys = writable<Set<string>>(new Set());

/** Whether to show untrusted events (toggle for UI). */
export const showUntrusted = writable<boolean>(true);

/** Derived count for display. */
export const trustedCount = derived(trustedPubkeys, ($tp) => $tp.size);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Load trusted pubkeys from IndexedDB.
 */
export async function initTrust(): Promise<void> {
    const stored = await loadTrustedPubkeys();
    trustedPubkeys.set(new Set(stored));
    console.log('[SCRUTINY:trust] Loaded', stored.length, 'trusted pubkeys');
}

/**
 * Add a pubkey to the trusted set.
 */
export async function trustPubkey(pubkey: string): Promise<void> {
    const hex = pubkey.trim().toLowerCase();
    if (hex.length !== 64) return;
    console.log('[SCRUTINY:trust] Trusting pubkey:', hex.slice(0, 12) + '…');
    trustedPubkeys.update((s) => {
        const next = new Set(s);
        next.add(hex);
        return next;
    });
    await addTrustedPubkey(hex);
}

/**
 * Remove a pubkey from the trusted set.
 */
export async function untrustPubkey(pubkey: string): Promise<void> {
    const hex = pubkey.trim().toLowerCase();
    console.log('[SCRUTINY:trust] Removing trust for:', hex.slice(0, 12) + '…');
    trustedPubkeys.update((s) => {
        const next = new Set(s);
        next.delete(hex);
        return next;
    });
    await removeTrustedPubkey(hex);
}

/**
 * Check if a pubkey is trusted.
 */
export function isTrusted(pubkey: string): boolean {
    return get(trustedPubkeys).has(pubkey);
}
