// src/lib/nostr/signer.ts
// NIP-07 browser extension detection and signing utilities

import { writable, get } from 'svelte/store';
import type { EventTemplate, VerifiedEvent } from 'nostr-tools';

/**
 * Minimal interface for NIP-07 browser extensions (e.g., nos2x, Alby)
 */
export interface NostrExtension {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<VerifiedEvent>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

// Extend the global Window interface to include nostr
declare global {
  interface Window {
    nostr?: NostrExtension;
  }
}

/**
 * NIP-07 extension status
 */
export type NostrStatus = 'checking' | 'available' | 'unavailable';

/**
 * Store for NIP-07 extension status
 */
export const nostrStatus = writable<NostrStatus>('checking');

/**
 * Store for the user's public key (hex format)
 */
export const nostrPubkey = writable<string | null>(null);

/**
 * Check if NIP-07 extension is available and get public key
 */
async function detectNostrExtension(): Promise<void> {
  // Only run in browser
  if (typeof window === 'undefined') {
    nostrStatus.set('unavailable');
    return;
  }

  // Small delay to allow extensions to inject window.nostr
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!window.nostr) {
    nostrStatus.set('unavailable');
    return;
  }

  try {
    const pubkey = await window.nostr.getPublicKey();
    if (pubkey && typeof pubkey === 'string' && pubkey.length === 64) {
      nostrPubkey.set(pubkey);
      nostrStatus.set('available');
    } else {
      nostrStatus.set('unavailable');
    }
  } catch (error) {
    console.warn('NIP-07 extension detected but failed to get public key:', error);
    nostrStatus.set('unavailable');
  }
}

// Run detection on module load (browser only)
if (typeof window !== 'undefined') {
  // Detect immediately and also after a delay (some extensions load slowly)
  detectNostrExtension();
  
  // Also listen for when the extension might be ready
  window.addEventListener('load', () => {
    if (get(nostrStatus) === 'checking' || get(nostrStatus) === 'unavailable') {
      detectNostrExtension();
    }
  });
}

/**
 * Re-check for NIP-07 extension (useful if user installs extension after page load)
 */
export async function recheckNostrExtension(): Promise<void> {
  nostrStatus.set('checking');
  await detectNostrExtension();
}

/**
 * Sign an event template using NIP-07 extension
 * 
 * @param template - The unsigned event template to sign
 * @returns The signed event
 * @throws Error if NIP-07 extension is not available
 */
export async function signEventTemplate(
  template: EventTemplate
): Promise<VerifiedEvent> {
  const status = get(nostrStatus);
  
  if (status !== 'available') {
    throw new Error(
      'NIP-07 extension not available. Please install a Nostr browser extension (like nos2x or Alby) to sign events.'
    );
  }

  if (!window.nostr) {
    throw new Error('NIP-07 extension not found on window object.');
  }

  try {
    const signedEvent = await window.nostr.signEvent(template);
    return signedEvent;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to sign event: ${error.message}`);
    }
    throw new Error('Failed to sign event: Unknown error');
  }
}

/**
 * Format a public key for display (shortened hex)
 */
export function formatPubkeyShort(pubkey: string): string {
  if (!pubkey || pubkey.length < 16) return pubkey;
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`;
}
