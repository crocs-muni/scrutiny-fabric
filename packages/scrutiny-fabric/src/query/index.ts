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
  return { kinds: [1], '#t': tags };
};

/**
 * Product-First Traversal (spec §7):
 * Fetch BindingEvents anchored to a specific product.
 */
export const buildProductBindingsFilter = (productEventId: string): RelayFilter => ({
  kinds: [1],
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
  kinds: [1],
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
    kinds: [1],
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
    kinds: [1],
    '#e': cleaned,
    '#t': [NAMESPACE_TAG, 'scrutiny_update', 'scrutiny_retract', 'scrutiny_binding'],
  };
};
