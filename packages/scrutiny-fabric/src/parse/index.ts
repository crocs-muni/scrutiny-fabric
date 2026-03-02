import {
  DEFAULT_RELATIONSHIP,
  eventId,
  pubkey,
  relayUrl,
  type BindingEndpoints,
  type NostrEvent,
  type NostrTag,
  type ParsedIdentifier,
  type ParsedImeta,
  type Relationship,
  type ScrutinyType,
  type ScrutinyTypeTag,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const TYPE_TAG_MAP: Record<ScrutinyTypeTag, ScrutinyType> = {
  scrutiny_product: 'product',
  scrutiny_metadata: 'metadata',
  scrutiny_binding: 'binding',
  scrutiny_update: 'update',
  scrutiny_retract: 'retract',
};

const LOWERCASE_ASCII = /^[a-z]+$/;

// ---------------------------------------------------------------------------
// Low-level tag helpers
// ---------------------------------------------------------------------------

/** Return all tags whose first element equals `tagName`. */
export const getTagsByName = (
  event: NostrEvent,
  tagName: string,
): NostrTag[] => event.tags.filter((tag) => tag[0] === tagName);

/** Return the second element of each tag matching `tagName`. */
export const getTagValues = (
  event: NostrEvent,
  tagName: string,
): string[] =>
  getTagsByName(event, tagName)
    .map((tag) => tag[1])
    .filter(Boolean);

// ---------------------------------------------------------------------------
// SCRUTINY type extraction
// ---------------------------------------------------------------------------

/** Return all recognized SCRUTINY type tags present on the event. */
export const extractScrutinyTypeTags = (
  event: NostrEvent,
): ScrutinyTypeTag[] => {
  const tValues = getTagValues(event, 't');
  return tValues.filter(
    (value): value is ScrutinyTypeTag => value in TYPE_TAG_MAP,
  );
};

/**
 * Return the single SCRUTINY type of the event, or `null` when zero or
 * multiple type tags are present (caller should treat this as invalid).
 */
export const extractScrutinyType = (
  event: NostrEvent,
): ScrutinyType | null => {
  const tags = extractScrutinyTypeTags(event);
  if (tags.length !== 1) return null;
  return TYPE_TAG_MAP[tags[0]];
};

// ---------------------------------------------------------------------------
// Labels (NIP-32)
// ---------------------------------------------------------------------------

/**
 * Collect all `l` tags into a namespace → values map.
 *
 * Tags without a namespace (third element) are silently skipped per NIP-32.
 */
export const extractLabels = (
  event: NostrEvent,
): Record<string, string[]> => {
  const labels: Record<string, string[]> = {};
  for (const tag of event.tags) {
    if (tag[0] !== 'l') continue;
    const value = tag[1] ?? '';
    const ns = tag[2] ?? '';
    if (!ns) continue;
    labels[ns] ??= [];
    labels[ns].push(value);
  }
  return labels;
};

// ---------------------------------------------------------------------------
// Canonical identifiers (`i` tags — spec §3.2)
// ---------------------------------------------------------------------------

/**
 * Parse `i` tags into structured identifiers.
 *
 * Entries whose prefix is not lowercase ASCII are included in the result
 * but flagged — callers can decide whether to reject or warn.
 */
export const extractIdentifiers = (
  event: NostrEvent,
): ParsedIdentifier[] => {
  const result: ParsedIdentifier[] = [];
  for (const tag of getTagsByName(event, 'i')) {
    const raw = tag[1] ?? '';
    const idx = raw.indexOf(':');
    if (idx <= 0 || idx === raw.length - 1) continue;
    result.push({
      raw,
      prefix: raw.slice(0, idx),
      value: raw.slice(idx + 1),
    });
  }
  return result;
};

/**
 * Returns `true` if an identifier prefix conforms to the spec's
 * lowercase-ASCII requirement (strict mode). If strict mode is false,
 * it accepts any non-empty string as a valid prefix.
 */
export const isValidIdentifierPrefix = (prefix: string, strict: boolean = true): boolean => {
  if (strict) return LOWERCASE_ASCII.test(prefix);
  return prefix.length > 0;
};

// ---------------------------------------------------------------------------
// imeta (NIP-92 artifact attachments — spec §3.3)
// ---------------------------------------------------------------------------

/** Parse a single `imeta` tag into its constituent key-value fields. */
export const parseImetaTag = (tag: NostrTag): ParsedImeta | null => {
  if (tag[0] !== 'imeta') return null;
  const parsed: {
    raw: NostrTag;
    url?: string;
    m?: string;
    x?: string;
    size?: string;
    service?: string;
    extras: Record<string, string>;
  } = { raw: tag, extras: {} };

  for (const segment of tag.slice(1)) {
    const firstSpace = segment.indexOf(' ');
    if (firstSpace <= 0 || firstSpace === segment.length - 1) continue;
    const key = segment.slice(0, firstSpace);
    const value = segment.slice(firstSpace + 1);

    switch (key) {
      case 'url':
        parsed.url = value;
        break;
      case 'm':
        parsed.m = value;
        break;
      case 'x':
        parsed.x = value;
        break;
      case 'size':
        parsed.size = value;
        break;
      case 'service':
        parsed.service = value;
        break;
      default:
        parsed.extras[key] = value;
        break;
    }
  }

  return parsed as ParsedImeta;
};

/** Extract all `imeta` tags from an event. */
export const extractImeta = (event: NostrEvent): ParsedImeta[] =>
  getTagsByName(event, 'imeta')
    .map(parseImetaTag)
    .filter((v): v is ParsedImeta => v !== null);

// ---------------------------------------------------------------------------
// Binding endpoints (spec §4.3)
// ---------------------------------------------------------------------------

/**
 * Extract the anchor (`e root`) and other (`q`) endpoints from a
 * BindingEvent. Returns `null` when cardinality is wrong (not exactly 1 of
 * each).
 */
export const extractBindingEndpoints = (
  event: NostrEvent,
): BindingEndpoints | null => {
  const eRoot = event.tags.filter(
    (tag) => tag[0] === 'e' && tag[3] === 'root',
  );
  const qTags = event.tags.filter((tag) => tag[0] === 'q');
  if (eRoot.length !== 1 || qTags.length !== 1) return null;

  const e = eRoot[0];
  const q = qTags[0];

  return {
    anchorEventId: eventId(e[1]),
    anchorRelayHint: e[2] ? relayUrl(e[2]) : undefined,
    anchorPubkeyHint: e[4] ? pubkey(e[4]) : undefined,
    otherEventId: eventId(q[1]),
    otherRelayHint: q[2] ? relayUrl(q[2]) : undefined,
    otherPubkeyHint: q[3] ? pubkey(q[3]) : undefined,
  };
};

// ---------------------------------------------------------------------------
// Relationship label (spec §4.3)
// ---------------------------------------------------------------------------

/**
 * Extract the relationship label from a BindingEvent.
 *
 * - 0 labels → returns `DEFAULT_RELATIONSHIP` (`"related"`).
 * - 1 label  → returns it (typed as `Relationship` if known, else raw string).
 * - >1 label → returns `null` (ambiguous — validation should reject).
 */
export const extractRelationship = (
  event: NostrEvent,
): Relationship | string | null => {
  const values = event.tags
    .filter(
      (tag) => tag[0] === 'l' && tag[2] === 'scrutiny:binding:relationship',
    )
    .map((tag) => tag[1])
    .filter(Boolean);

  if (values.length === 0) return DEFAULT_RELATIONSHIP;
  if (values.length > 1) return null;
  return values[0];
};

// ---------------------------------------------------------------------------
// Target root ID (shared by Update & Retraction)
// ---------------------------------------------------------------------------

/**
 * Extract the `e root` target ID used by UpdateEvents and RetractionEvents.
 * Returns `null` if there is not exactly one `e root` tag.
 */
export const extractTargetRootId = (
  event: NostrEvent,
): string | null => {
  const roots = event.tags.filter(
    (tag) => tag[0] === 'e' && tag[3] === 'root',
  );
  if (roots.length !== 1) return null;
  return roots[0][1] ?? null;
};
