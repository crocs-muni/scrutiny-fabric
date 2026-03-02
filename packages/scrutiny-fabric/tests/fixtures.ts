import type { NostrEvent } from '../src/types/index.js';
import { eventId, pubkey } from '../src/types/index.js';

/**
 * Create a minimal valid SCRUTINY ProductEvent.
 * Override any field via the `overrides` parameter.
 */
export const makeEvent = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
  id: eventId('a'.repeat(64)),
  pubkey: pubkey('b'.repeat(64)),
  kind: 1,
  content: 'content',
  created_at: 1700000000,
  tags: [
    ['t', 'scrutiny_fabric'],
    ['t', 'scrutiny_v032'],
    ['t', 'scrutiny_product'],
  ],
  ...overrides,
});

/** Convenience: a different pubkey for multi-actor tests. */
export const ALT_PUBKEY = pubkey('c'.repeat(64));
