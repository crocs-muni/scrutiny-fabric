import {
  CURRENT_VERSION_TAG,
  NAMESPACE_TAG,
  type RelayFilter,
  type ScrutinyType,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TYPE_TO_TAG: Record<ScrutinyType, string> = {
  product: 'scrutiny_product',
  metadata: 'scrutiny_metadata',
  binding: 'scrutiny_binding',
  update: 'scrutiny_update',
  retract: 'scrutiny_retract',
};

// SCRUTINY v0.3.x currently uses Nostr kind:1 text notes for all events.
export const SCRUTINY_EVENT_KIND = 1 as const;

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

const cleanIds = (ids: string[]): string[] =>
  uniq(ids.map((id) => id.trim()).filter(Boolean));

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

/**
 * Build a filter for fetching events of specific SCRUTINY types.
 *
 * Always includes the `scrutiny_fabric` namespace tag and version tag.
 */
export const buildScrutinyTypesFilter = (
  types: ScrutinyType[],
  versionTag: string = CURRENT_VERSION_TAG,
): RelayFilter => {
  const tags = uniq([NAMESPACE_TAG, versionTag, ...types.map((t) => TYPE_TO_TAG[t])]);
  // NIP-01 tag arrays are relay-side OR matching, so this filter intentionally
  // returns a superset. Callers should perform client-side validation to enforce
  // strict SCRUTINY conformance.
  return { kinds: [SCRUTINY_EVENT_KIND], '#t': tags };
};

/**
 * Product-First Traversal (spec §7):
 * Fetch BindingEvents anchored to a specific product.
 */
export const buildProductBindingsFilter = (productEventId: string): RelayFilter => ({
  kinds: [SCRUTINY_EVENT_KIND],
  '#t': [NAMESPACE_TAG, 'scrutiny_binding'],
  '#e': [productEventId],
});

/**
 * Metadata-First Traversal (spec §7):
 * Fetch BindingEvents quoting a specific metadata event.
 *
 * ```json
 * { "kinds": [1], "#t": ["scrutiny_fabric", "scrutiny_binding"], "#q": ["<id>"] }
 * ```
 */
export const buildMetadataBindingsFilter = (metadataEventId: string): RelayFilter => ({
  kinds: [SCRUTINY_EVENT_KIND],
  '#t': [NAMESPACE_TAG, 'scrutiny_binding'],
  '#q': [metadataEventId],
});

/**
 * Fetch specific events by their IDs.
 *
 * @param ids   — Event IDs to fetch (deduplicated).
 * @param limit — Optional limit, clamped to [1, 5000].
 * @throws When `ids` is empty after cleaning.
 */
export const buildEventsByIdsFilter = (ids: string[], limit?: number): RelayFilter => {
  const cleaned = cleanIds(ids);
  if (cleaned.length === 0) {
    throw new Error('ids cannot be empty');
  }

  const filter: { kinds: number[]; ids: string[]; limit?: number } = {
    kinds: [SCRUTINY_EVENT_KIND],
    ids: cleaned,
  };
  if (typeof limit === 'number') {
    filter.limit = Math.max(1, Math.min(limit, 5000));
  }
  return filter;
};

/**
 * Fetch all events that target the given IDs (updates, retractions, bindings).
 *
 * Useful for resolving the full state graph of a Product or Metadata event.
 *
 * @param targetIds — IDs of the events to find referencing events for.
 * @throws When `targetIds` is empty after cleaning.
 */
export const buildEventsTargetingFilter = (targetIds: string[]): RelayFilter => {
  const cleaned = cleanIds(targetIds);
  if (cleaned.length === 0) {
    throw new Error('targetIds cannot be empty');
  }

  return {
    kinds: [SCRUTINY_EVENT_KIND],
    '#e': cleaned,
    '#t': [NAMESPACE_TAG, 'scrutiny_update', 'scrutiny_retract', 'scrutiny_binding'],
  };
};
