/**
 * Persistent config — relay configuration and trusted pubkeys via localStorage.
 * Publish drafts remain in IndexedDB via db.ts.
 *
 * Using localStorage (synchronous) for relay config and trust since these
 * are small JSON arrays and don't require idb's complexity.
 */

import type { StoredRelayConfig, StoredPublishDraft } from './db.js';
import { getDb } from './db.js';

const RELAY_CONFIG_KEY = 'scrutiny:relayConfig';
const TRUSTED_PUBKEYS_KEY = 'scrutiny:trustedPubkeys';

function isServer(): boolean {
    return typeof window === 'undefined' || typeof localStorage === 'undefined';
}

// ---------------------------------------------------------------------------
// Relay config (localStorage)
// ---------------------------------------------------------------------------

export function loadRelayConfigs(): StoredRelayConfig[] {
    if (isServer()) return [];
    try {
        const raw = localStorage.getItem(RELAY_CONFIG_KEY);
        return raw ? (JSON.parse(raw) as StoredRelayConfig[]) : [];
    } catch {
        return [];
    }
}

export function saveRelayConfig(config: StoredRelayConfig): void {
    if (isServer()) return;
    const all = loadRelayConfigs();
    const idx = all.findIndex(r => r.url === config.url);
    if (idx >= 0) all[idx] = config; else all.push(config);
    localStorage.setItem(RELAY_CONFIG_KEY, JSON.stringify(all));
}

export function removeRelayConfig(url: string): void {
    if (isServer()) return;
    const all = loadRelayConfigs().filter(r => r.url !== url);
    localStorage.setItem(RELAY_CONFIG_KEY, JSON.stringify(all));
}

export function clearRelayConfigs(): void {
    if (isServer()) return;
    localStorage.removeItem(RELAY_CONFIG_KEY);
}

// ---------------------------------------------------------------------------
// Trusted pubkeys (localStorage)
// ---------------------------------------------------------------------------

export function loadTrustedPubkeys(): string[] {
    if (isServer()) return [];
    try {
        const raw = localStorage.getItem(TRUSTED_PUBKEYS_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

export function addTrustedPubkey(pubkey: string): void {
    if (isServer()) return;
    const all = loadTrustedPubkeys();
    if (!all.includes(pubkey)) {
        all.push(pubkey);
        localStorage.setItem(TRUSTED_PUBKEYS_KEY, JSON.stringify(all));
    }
}

export function removeTrustedPubkey(pubkey: string): void {
    if (isServer()) return;
    const all = loadTrustedPubkeys().filter(p => p !== pubkey);
    localStorage.setItem(TRUSTED_PUBKEYS_KEY, JSON.stringify(all));
}

export function clearTrustedPubkeys(): void {
    if (isServer()) return;
    localStorage.removeItem(TRUSTED_PUBKEYS_KEY);
}

// ---------------------------------------------------------------------------
// Publish drafts (IndexedDB via db.ts)
// ---------------------------------------------------------------------------

export async function loadDrafts(): Promise<StoredPublishDraft[]> {
    const db = await getDb();
    return db.getAll('publishDrafts');
}

export async function saveDraft(draft: StoredPublishDraft): Promise<void> {
    const db = await getDb();
    await db.put('publishDrafts', draft);
}

export async function removeDraft(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('publishDrafts', id);
}

export async function clearDrafts(): Promise<void> {
    const db = await getDb();
    await db.clear('publishDrafts');
}
