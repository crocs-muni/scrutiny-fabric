/**
 * IndexedDB schema — publish drafts only.
 *
 * Events, search results, relay config, and trusted pubkeys have been
 * migrated out of idb:
 * - Events → ndk-cache-dexie (managed automatically by NDK)
 * - Relay config / trusted pubkeys → localStorage (see cache/config.ts)
 * - Search result TTL caches → removed (ndk-cache-dexie makes them redundant)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export interface StoredRelayConfig {
    url: string;
    enabled: boolean;
    label?: string;
}

export interface StoredPublishDraft {
    id: string;
    type: 'product' | 'metadata' | 'binding';
    data: Record<string, unknown>;
    updatedAt: number;
}

// ---------------------------------------------------------------------------
// IDB schema definition
// ---------------------------------------------------------------------------

interface ScrutinyLensDB extends DBSchema {
    publishDrafts: {
        key: string;
        value: StoredPublishDraft;
    };
}

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

const DB_NAME = 'scrutiny-lens';
// v2: removed events, searchResults, updateScans, relayConfig, trustedPubkeys stores
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ScrutinyLensDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ScrutinyLensDB>> {
    if (!dbPromise) {
        dbPromise = openDB<ScrutinyLensDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // Drop stores from v1 that are no longer needed.
                // Cast to IDBDatabase to bypass idb's strict store-name typing.
                if (oldVersion < 2) {
                    const rawDb = db as unknown as IDBDatabase;
                    for (const storeName of ['events', 'searchResults', 'updateScans', 'relayConfig', 'trustedPubkeys']) {
                        if (rawDb.objectStoreNames.contains(storeName)) {
                            rawDb.deleteObjectStore(storeName);
                        }
                    }
                }
                if (!db.objectStoreNames.contains('publishDrafts')) {
                    db.createObjectStore('publishDrafts', { keyPath: 'id' });
                }
            }
        });
    }
    return dbPromise;
}
