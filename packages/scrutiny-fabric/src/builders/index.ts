import {
    CURRENT_VERSION_TAG,
    NAMESPACE_TAG,
    type NostrTag,
    type Relationship,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Shared internals
// ---------------------------------------------------------------------------

const baseTags = (typeTag: string): NostrTag[] => [
    ['t', NAMESPACE_TAG],
    ['t', typeTag],
    ['t', CURRENT_VERSION_TAG],
];

/** Encode a set of labels as NIP-32 `L`/`l` tag pairs. */
const labelTags = (labels: Record<string, string[]>): NostrTag[] => {
    const tags: NostrTag[] = [];
    for (const [namespace, values] of Object.entries(labels)) {
        tags.push(['L', namespace]);
        for (const value of values) {
            tags.push(['l', value, namespace]);
        }
    }
    return tags;
};

/** Encode canonical identifiers as `i` tags. */
const identifierTags = (identifiers: string[]): NostrTag[] =>
    identifiers.map((id) => ['i', id]);

/** Encode imeta fields. */
const imetaTags = (
    artifacts: Array<{
        url: string;
        mime?: string;
        sha256?: string;
        size?: number;
    }>,
): NostrTag[] =>
    artifacts.map((a) => {
        const segments: string[] = [`url ${a.url}`];
        if (a.mime) segments.push(`m ${a.mime}`);
        if (a.sha256) segments.push(`x ${a.sha256}`);
        if (a.size !== undefined) segments.push(`size ${a.size}`);
        return ['imeta', ...segments];
    });

// ---------------------------------------------------------------------------
// Partial result type (kind, content, tags — caller adds id/pubkey/created_at)
// ---------------------------------------------------------------------------

/** The portion of a NostrEvent that the builder can produce (no id/pubkey/sig). */
export interface UnsignedEventTemplate {
    readonly kind: 1;
    readonly content: string;
    readonly tags: readonly NostrTag[];
}

// ---------------------------------------------------------------------------
// Product Event builder (§4.1)
// ---------------------------------------------------------------------------

export interface BuildProductEventParams {
    /** Human-readable description (required). */
    content: string;
    /** Canonical identifiers, e.g. `"cpe:2.3:h:infineon:…"`. */
    identifiers?: string[];
    /** Labels keyed by namespace, e.g. `{ "scrutiny:product:vendor": ["Infineon"] }`. */
    labels?: Record<string, string[]>;
}

/**
 * Build the content/tags for a ProductEvent.
 *
 * The caller is responsible for signing and adding `id`, `pubkey`, `created_at`.
 */
export const buildProductEvent = (params: BuildProductEventParams): UnsignedEventTemplate => ({
    kind: 1,
    content: params.content,
    tags: [
        ...baseTags('scrutiny_product'),
        ...identifierTags(params.identifiers ?? []),
        ...labelTags(params.labels ?? {}),
    ],
});

// ---------------------------------------------------------------------------
// Metadata Event builder (§4.2)
// ---------------------------------------------------------------------------

export interface BuildMetadataEventParams {
    /** Human-readable summary or full report text (required). */
    content: string;
    /** Canonical identifiers, e.g. `"cve:CVE-2017-15361"`. */
    identifiers?: string[];
    /** Labels keyed by namespace. */
    labels?: Record<string, string[]>;
    /** Artifact attachments. */
    artifacts?: Array<{
        url: string;
        mime?: string;
        sha256?: string;
        size?: number;
    }>;
}

/**
 * Build the content/tags for a MetadataEvent.
 */
export const buildMetadataEvent = (params: BuildMetadataEventParams): UnsignedEventTemplate => ({
    kind: 1,
    content: params.content,
    tags: [
        ...baseTags('scrutiny_metadata'),
        ...identifierTags(params.identifiers ?? []),
        ...labelTags(params.labels ?? {}),
        ...imetaTags(params.artifacts ?? []),
    ],
});

// ---------------------------------------------------------------------------
// Binding Event builder (§4.3)
// ---------------------------------------------------------------------------

export interface BuildBindingEventParams {
    /** Human-readable description of the binding. */
    content: string;
    /** The anchor event (e root — typically the Product). */
    anchor: { eventId: string; relayHint?: string; pubkeyHint?: string };
    /** The other event (q — typically the Metadata). */
    other: { eventId: string; relayHint?: string; pubkeyHint?: string };
    /** Relationship label. Defaults to `"related"`. */
    relationship?: Relationship | string;
}

/**
 * Build the content/tags for a BindingEvent.
 *
 * Both `anchor` and `other` are required — this prevents construction of
 * a binding with missing endpoints at the call site.
 */
export const buildBindingEvent = (params: BuildBindingEventParams): UnsignedEventTemplate => {
    const rel = params.relationship ?? 'related';
    return {
        kind: 1,
        content: params.content,
        tags: [
            ...baseTags('scrutiny_binding'),
            ['e', params.anchor.eventId, params.anchor.relayHint ?? '', 'root', params.anchor.pubkeyHint ?? ''],
            ['q', params.other.eventId, params.other.relayHint ?? '', params.other.pubkeyHint ?? ''],
            ['L', 'scrutiny:binding:relationship'],
            ['l', rel, 'scrutiny:binding:relationship'],
        ],
    };
};

// ---------------------------------------------------------------------------
// Update Event builder (§5.1)
// ---------------------------------------------------------------------------

export interface BuildUpdateEventParams {
    /**
     * New content. Empty string (`""`) means "no content change".
     * Per spec §5.1: the UpdateEvent's content field replaces the target's content.
     */
    content: string;
    /** The event being updated (must be a Product or Metadata event). */
    targetEventId: string;
    targetRelayHint?: string;
    targetPubkeyHint?: string;
    /** Label replacements (per namespace). Use `[""]` to delete a namespace. */
    labels?: Record<string, string[]>;
    /** Full-set identifier replacement. */
    identifiers?: string[];
    /** Full-set artifact replacement. */
    artifacts?: Array<{
        url: string;
        mime?: string;
        sha256?: string;
        size?: number;
    }>;
}

/**
 * Build the content/tags for an UpdateEvent.
 */
export const buildUpdateEvent = (params: BuildUpdateEventParams): UnsignedEventTemplate => ({
    kind: 1,
    content: params.content,
    tags: [
        ...baseTags('scrutiny_update'),
        ['e', params.targetEventId, params.targetRelayHint ?? '', 'root', params.targetPubkeyHint ?? ''],
        ...identifierTags(params.identifiers ?? []),
        ...labelTags(params.labels ?? {}),
        ...imetaTags(params.artifacts ?? []),
    ],
});

// ---------------------------------------------------------------------------
// Retraction Event builder (§5.2)
// ---------------------------------------------------------------------------

export interface BuildRetractionEventParams {
    /** Human-readable reason for retraction. */
    content: string;
    /** The event being retracted. */
    targetEventId: string;
    targetRelayHint?: string;
    targetPubkeyHint?: string;
}

/**
 * Build the content/tags for a RetractionEvent.
 */
export const buildRetractionEvent = (params: BuildRetractionEventParams): UnsignedEventTemplate => ({
    kind: 1,
    content: params.content,
    tags: [
        ...baseTags('scrutiny_retract'),
        ['e', params.targetEventId, params.targetRelayHint ?? '', 'root', params.targetPubkeyHint ?? ''],
    ],
});
