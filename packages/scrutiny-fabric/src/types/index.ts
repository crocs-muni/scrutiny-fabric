// ---------------------------------------------------------------------------
// Branded primitives — prevent accidental ID / pubkey mix-ups at compile time
// ---------------------------------------------------------------------------

/** 64-char lowercase hex Nostr event identifier. */
export type EventId = string & { readonly __brand: unique symbol };

/** 64-char lowercase hex Nostr public key. */
export type Pubkey = string & { readonly __brand: unique symbol };

/** Relay websocket URL (wss://…). */
export type RelayUrl = string & { readonly __brand: unique symbol };

// Narrow helpers — call these at trust boundaries (e.g. after parsing raw JSON)
export const eventId = (raw: string): EventId => raw as EventId;
export const pubkey = (raw: string): Pubkey => raw as Pubkey;
export const relayUrl = (raw: string): RelayUrl => raw as RelayUrl;

// ---------------------------------------------------------------------------
// Nostr primitives
// ---------------------------------------------------------------------------

export type NostrTag = string[];

/** Minimal Nostr `kind:1` event shape consumed by the library. */
export interface NostrEvent {
  readonly id: EventId;
  readonly pubkey: Pubkey;
  readonly kind: number;
  readonly content: string;
  readonly created_at: number;
  readonly tags: readonly NostrTag[];
}

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

/** The five SCRUTINY Fabric event types. */
export type ScrutinyType =
  | 'product'
  | 'metadata'
  | 'binding'
  | 'update'
  | 'retract';

/** Raw `t`-tag values corresponding to each ScrutinyType. */
export type ScrutinyTypeTag =
  | 'scrutiny_product'
  | 'scrutiny_metadata'
  | 'scrutiny_binding'
  | 'scrutiny_update'
  | 'scrutiny_retract';

/** Protocol version tag for v0.3.2. */
export const CURRENT_VERSION_TAG = 'scrutiny_v032' as const;

/** Namespace marker tag required on every SCRUTINY event. */
export const NAMESPACE_TAG = 'scrutiny_fabric' as const;

// ---------------------------------------------------------------------------
// Relationships (spec §4.3)
// ---------------------------------------------------------------------------

export const DIRECTED_RELATIONSHIPS = [
  'test',
  'vulnerability',
  'patch',
  'certification',
  'audit',
  'analysis',
  'contains',
  'depends_on',
] as const;

export const SYMMETRIC_RELATIONSHIPS = ['same', 'related'] as const;

export const ALL_RELATIONSHIPS = [
  ...DIRECTED_RELATIONSHIPS,
  ...SYMMETRIC_RELATIONSHIPS,
] as const;

export type DirectedRelationship = (typeof DIRECTED_RELATIONSHIPS)[number];
export type SymmetricRelationship = (typeof SYMMETRIC_RELATIONSHIPS)[number];
export type Relationship = DirectedRelationship | SymmetricRelationship;

/** Default relationship when no label is provided on a BindingEvent. */
export const DEFAULT_RELATIONSHIP: Relationship = 'related';

export const isSymmetric = (r: string): r is SymmetricRelationship =>
  (SYMMETRIC_RELATIONSHIPS as readonly string[]).includes(r);

export const isKnownRelationship = (r: string): r is Relationship =>
  (ALL_RELATIONSHIPS as readonly string[]).includes(r);

// ---------------------------------------------------------------------------
// Parsed sub-structures
// ---------------------------------------------------------------------------

/** A parsed `i` (canonical identifier) tag. */
export interface ParsedIdentifier {
  /** Original tag value, e.g. `"cpe:2.3:h:infineon:…"`. */
  readonly raw: string;
  /** Lowercase-ASCII prefix, e.g. `"cpe"`. */
  readonly prefix: string;
  /** Everything after the first colon. */
  readonly value: string;
}

/** A parsed `imeta` (NIP-92 artifact attachment) tag. */
export interface ParsedImeta {
  readonly raw: NostrTag;
  readonly url?: string;
  readonly m?: string;
  /** SHA-256 hash — 64 lowercase hex chars. */
  readonly x?: string;
  readonly size?: string;
  readonly service?: string;
  readonly extras: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Binding endpoints (spec §4.3)
// ---------------------------------------------------------------------------

/**
 * The two endpoints of a BindingEvent.
 *
 * `anchor` = `e root` (the product/target),
 * `other`  = `q` (the metadata/source).
 */
export interface BindingEndpoints {
  readonly anchorEventId: EventId;
  readonly anchorRelayHint?: RelayUrl;
  readonly anchorPubkeyHint?: Pubkey;
  readonly otherEventId: EventId;
  readonly otherRelayHint?: RelayUrl;
  readonly otherPubkeyHint?: Pubkey;
}

// ---------------------------------------------------------------------------
// Effective View (spec §6)
// ---------------------------------------------------------------------------

/** The computed current state of an event after merging all authoritative updates. */
export interface EffectiveView {
  /** ID of the original target event. */
  readonly targetId: EventId;
  /** `true` when the target has an authoritative retraction. */
  readonly retracted: boolean;
  /** Merged content after applying updates. */
  readonly content: string;
  /** Merged labels keyed by namespace. */
  readonly labels: Readonly<Record<string, readonly string[]>>;
  /** Merged canonical identifiers. */
  readonly identifiers: readonly ParsedIdentifier[];
  /** Merged artifact attachments. */
  readonly artifacts: readonly ParsedImeta[];
  /** IDs of updates that were applied, in merge order. */
  readonly appliedUpdateIds: readonly EventId[];
}

// ---------------------------------------------------------------------------
// Relay filter (NIP-01)
// ---------------------------------------------------------------------------

/** A Nostr relay subscription filter. */
export interface RelayFilter {
  readonly kinds?: readonly number[];
  readonly ids?: readonly string[];
  readonly '#t'?: readonly string[];
  readonly '#e'?: readonly string[];
  readonly '#q'?: readonly string[];
  readonly limit?: number;
  readonly since?: number;
  readonly until?: number;
}

// ---------------------------------------------------------------------------
// Result pattern — functional error handling
// ---------------------------------------------------------------------------

/**
 * Discriminated union result type.
 *
 * Prefer `Result<T>` over throwing exceptions for protocol-level operations
 * so callers are forced to handle the error path.
 */
export type Result<T, E = ScrutinyError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export enum ErrorCode {
  // Tag-level
  INVALID_KIND = 'INVALID_KIND',
  MISSING_NAMESPACE_TAG = 'MISSING_NAMESPACE_TAG',
  MISSING_TYPE_TAG = 'MISSING_TYPE_TAG',
  MULTIPLE_TYPE_TAGS = 'MULTIPLE_TYPE_TAGS',
  MULTIPLE_VERSION_TAGS = 'MULTIPLE_VERSION_TAGS',
  UNKNOWN_VERSION_TAG = 'UNKNOWN_VERSION_TAG',

  // Binding
  INVALID_BINDING_ENDPOINT_CARDINALITY = 'INVALID_BINDING_ENDPOINT_CARDINALITY',
  INVALID_BINDING_ROOT_MARKER = 'INVALID_BINDING_ROOT_MARKER',
  INVALID_RELATIONSHIP_CARDINALITY = 'INVALID_RELATIONSHIP_CARDINALITY',
  UNKNOWN_RELATIONSHIP_VALUE = 'UNKNOWN_RELATIONSHIP_VALUE',

  // Imeta
  INVALID_IMETA_HASH = 'INVALID_IMETA_HASH',
  INVALID_IMETA_SIZE = 'INVALID_IMETA_SIZE',

  // Identifiers
  INVALID_IDENTIFIER_PREFIX = 'INVALID_IDENTIFIER_PREFIX',

  // Update / Retraction
  INVALID_UPDATE_TARGET = 'INVALID_UPDATE_TARGET',
  INVALID_RETRACTION_TARGET = 'INVALID_RETRACTION_TARGET',

  // Adversarial
  TAG_LIMIT_EXCEEDED = 'TAG_LIMIT_EXCEEDED',

  // Verify Module
  VERIFY_MISSING_URL = 'VERIFY_MISSING_URL',
  VERIFY_MISSING_HASH = 'VERIFY_MISSING_HASH',
  VERIFY_FETCH_FAILED = 'VERIFY_FETCH_FAILED',
  VERIFY_FILE_TOO_LARGE = 'VERIFY_FILE_TOO_LARGE',
  VERIFY_HASH_MISMATCH = 'VERIFY_HASH_MISMATCH',
  VERIFY_TIMEOUT = 'VERIFY_TIMEOUT',
}

/** A single validation issue with structured context. */
export interface ScrutinyIssue {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Aggregate validation result (may contain multiple issues). */
export interface ScrutinyError {
  readonly issues: readonly ScrutinyIssue[];
}

export const issue = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ScrutinyIssue => ({ code, message, details });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TrustConfig {
  /** The root pubkeys the local user explicitly trusts. */
  readonly trustedPubkeys: ReadonlySet<Pubkey>;
  /**
   * Number of degrees of separation allowed from root `trustedPubkeys`.
   * 0 = strict (only events directly authored by a trusted pubkey).
   * 1 = current default (connected via a trusted binding).
   * N = arbitrary depth.
   */
  readonly maxTrustHops: number;
  /** Minimum number of distinct trusted pubkeys required to endorse an edge. */
  readonly minEndorsements: number;
}

export interface ValidationConfig {
  /** Maximum number of tags allowed before rejecting the event. */
  readonly maxTags: number;
  /** Acceptable SCRUTINY version tags. */
  readonly allowedVersionTags: readonly string[];
  /** Allow events that omit a version tag entirely. */
  readonly allowMissingVersionTag: boolean;
  /** If true, 'i' prefixes MUST be strictly lowercase ASCII as per the spec. If false, case-insensitivity or extended characters may be permitted. */
  readonly strictIdentifiers: boolean;
  /** If true, relationship values outside of DIRECTED_RELATIONSHIPS / SYMMETRIC_RELATIONSHIPS are allowed. */
  readonly allowUnknownRelationships: boolean;
}

export interface GraphConfig {
  /** Maximum traversal limit (hops) for pathfinding/DFS. */
  readonly maxTraversalDepth: number;
}

export interface ScrutinyConfig {
  readonly trust: TrustConfig;
  readonly validation: ValidationConfig;
  readonly graph: GraphConfig;
}

export const DEFAULT_CONFIG: ScrutinyConfig = {
  trust: {
    trustedPubkeys: new Set<Pubkey>(),
    maxTrustHops: 1,
    minEndorsements: 1,
  },
  validation: {
    maxTags: 1000,
    allowedVersionTags: [CURRENT_VERSION_TAG],
    allowMissingVersionTag: true,
    strictIdentifiers: true, // strict lowercase ASCII by default
    allowUnknownRelationships: true, // by default let it pass
  },
  graph: {
    maxTraversalDepth: 10,
  },
};
