import {
  ErrorCode,
  issue,
  isKnownRelationship,
  type ScrutinyError,
  type ScrutinyIssue,
  type ScrutinyType,
} from '../types/index.js';
import {
  extractBindingEndpoints,
  extractIdentifiers,
  extractImeta,
  extractRelationship,
  extractScrutinyType,
  extractScrutinyTypeTags,
  getTagValues,
  isValidIdentifierPrefix,
} from '../parse/index.js';
import type { NostrEvent } from '../types/index.js';

import type { ValidationConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ValidationAccumulator {
  issues: ScrutinyIssue[];
}

const acc = (): ValidationAccumulator => ({ issues: [] });

const toResult = (a: ValidationAccumulator): { ok: boolean; issues: readonly ScrutinyIssue[] } =>
  a.issues.length === 0
    ? { ok: true, issues: [] }
    : { ok: false, issues: a.issues };

// ---------------------------------------------------------------------------
// Core tag validation (§2)
// ---------------------------------------------------------------------------

export const validateCoreTags = (
  event: NostrEvent,
  config: ValidationConfig = DEFAULT_CONFIG.validation,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  const a = acc();

  // Adversarial input check
  if (event.tags.length > config.maxTags) {
    a.issues.push(
      issue(ErrorCode.TAG_LIMIT_EXCEEDED, `Event has ${event.tags.length} tags (max ${config.maxTags})`, {
        count: event.tags.length,
        max: config.maxTags,
      }),
    );
    return toResult(a); // short-circuit — don't iterate a massive array
  }

  if (event.kind !== 1) {
    a.issues.push(issue(ErrorCode.INVALID_KIND, 'SCRUTINY events must be kind 1'));
  }

  const tValues = getTagValues(event, 't');
  if (!tValues.includes('scrutiny_fabric')) {
    a.issues.push(
      issue(ErrorCode.MISSING_NAMESPACE_TAG, 'Missing required namespace tag scrutiny_fabric'),
    );
  }

  const typeTags = extractScrutinyTypeTags(event);
  if (typeTags.length === 0) {
    a.issues.push(issue(ErrorCode.MISSING_TYPE_TAG, 'Missing SCRUTINY type tag'));
  }
  if (typeTags.length > 1) {
    a.issues.push(
      issue(ErrorCode.MULTIPLE_TYPE_TAGS, 'Multiple SCRUTINY type tags found', {
        tags: typeTags,
      }),
    );
  }

  const versionTags = tValues.filter((v) => v.startsWith('scrutiny_v'));
  if (versionTags.length > 1) {
    a.issues.push(
      issue(ErrorCode.MULTIPLE_VERSION_TAGS, 'Multiple SCRUTINY version tags found', {
        tags: versionTags,
      }),
    );
  }
  if (!config.allowMissingVersionTag && versionTags.length === 0) {
    a.issues.push(issue(ErrorCode.UNKNOWN_VERSION_TAG, 'Missing SCRUTINY version tag'));
  }
  if (versionTags.length === 1 && !config.allowedVersionTags.includes(versionTags[0])) {
    a.issues.push(
      issue(ErrorCode.UNKNOWN_VERSION_TAG, `Unknown SCRUTINY version tag: ${versionTags[0]}`, {
        version: versionTags[0],
      }),
    );
  }

  return toResult(a);
};

// ---------------------------------------------------------------------------
// imeta validation (§3.3)
// ---------------------------------------------------------------------------

export const validateImeta = (
  event: NostrEvent,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  const artifacts = extractImeta(event);
  const a = acc();

  for (const artifact of artifacts) {
    if (artifact.x && !/^[a-fA-F0-9]{64}$/.test(artifact.x)) {
      a.issues.push(
        issue(ErrorCode.INVALID_IMETA_HASH, 'imeta x must be 64 hex chars', {
          hash: artifact.x,
        }),
      );
    }

    if (artifact.size && !/^\d+$/.test(artifact.size)) {
      a.issues.push(
        issue(ErrorCode.INVALID_IMETA_SIZE, 'imeta size must be a base-10 integer', {
          size: artifact.size,
        }),
      );
    }
  }

  return toResult(a);
};

// ---------------------------------------------------------------------------
// Identifier validation (§3.2)
// ---------------------------------------------------------------------------

export const validateIdentifiers = (
  event: NostrEvent,
  config: ValidationConfig = DEFAULT_CONFIG.validation,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  const identifiers = extractIdentifiers(event);
  const a = acc();

  for (const id of identifiers) {
    if (!isValidIdentifierPrefix(id.prefix, config.strictIdentifiers)) {
      a.issues.push(
        issue(ErrorCode.INVALID_IDENTIFIER_PREFIX, `Identifier prefix must be lowercase ASCII: "${id.prefix}"`, {
          prefix: id.prefix,
          raw: id.raw,
        }),
      );
    }
  }

  return toResult(a);
};

// ---------------------------------------------------------------------------
// Binding-specific validation (§4.3)
// ---------------------------------------------------------------------------

export const validateBindingEvent = (
  event: NostrEvent,
  config: ValidationConfig = DEFAULT_CONFIG.validation,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  const a = acc();

  const endpoints = extractBindingEndpoints(event);
  if (!endpoints) {
    const eTags = event.tags.filter((tag) => tag[0] === 'e');
    const qTags = event.tags.filter((tag) => tag[0] === 'q');
    const hasWrongRootMarker = eTags.some((tag) => tag[3] && tag[3] !== 'root');

    if (hasWrongRootMarker) {
      a.issues.push(
        issue(ErrorCode.INVALID_BINDING_ROOT_MARKER, 'BindingEvent requires e-tag marker "root"'),
      );
    }

    if (eTags.length !== 1 || qTags.length !== 1) {
      a.issues.push(
        issue(
          ErrorCode.INVALID_BINDING_ENDPOINT_CARDINALITY,
          'BindingEvent requires exactly one e(root) and one q endpoint',
          { eCount: eTags.length, qCount: qTags.length },
        ),
      );
    }
  }

  // Relationship cardinality & value
  const relationship = extractRelationship(event);
  if (relationship === null) {
    a.issues.push(
      issue(
        ErrorCode.INVALID_RELATIONSHIP_CARDINALITY,
        'BindingEvent has multiple conflicting relationship labels',
      ),
    );
  } else if (!config.allowUnknownRelationships && !isKnownRelationship(relationship)) {
    a.issues.push(
      issue(ErrorCode.UNKNOWN_RELATIONSHIP_VALUE, `Unknown relationship value: "${relationship}"`, {
        value: relationship,
      }),
    );
  }

  return toResult(a);
};

// ---------------------------------------------------------------------------
// Update target validation (§4.3 immutability + §5.1)
// ---------------------------------------------------------------------------

/**
 * Validate that an UpdateEvent targets an allowed event type.
 *
 * Per spec §4.3: BindingEvents are immutable — they cannot be targeted.
 * Per spec §5.1: Updates may only target Product or Metadata events.
 */
export const validateUpdateTarget = (
  _updateEvent: NostrEvent,
  targetType: ScrutinyType | null,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  if (targetType === 'product' || targetType === 'metadata') {
    return { ok: true, issues: [] };
  }

  return {
    ok: false,
    issues: [
      issue(
        ErrorCode.INVALID_UPDATE_TARGET,
        `UpdateEvents may only target Product or Metadata events, got: ${targetType ?? 'unknown'}`,
        { targetType },
      ),
    ],
  };
};

// ---------------------------------------------------------------------------
// Retraction target validation (§5.2)
// ---------------------------------------------------------------------------

/**
 * Validate that a RetractionEvent does not target another retraction.
 *
 * Per spec §5.2: "Retractions themselves cannot be retracted."
 */
export const validateRetractionTarget = (
  _retractionEvent: NostrEvent,
  targetType: ScrutinyType | null,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  if (targetType === 'retract') {
    return {
      ok: false,
      issues: [
        issue(
          ErrorCode.INVALID_RETRACTION_TARGET,
          'Retractions cannot target other RetractionEvents',
        ),
      ],
    };
  }

  return { ok: true, issues: [] };
};

// ---------------------------------------------------------------------------
// Aggregate validator
// ---------------------------------------------------------------------------

/**
 * Run all applicable validations on a SCRUTINY event.
 *
 * @param event        — The Nostr event to validate.
 * @param options      — Optional tuning knobs.
 * @param targetType   — If the event is an Update or Retraction, the type of
 *                        the target event. **Required** for full compliance
 *                        checking of updates and retractions.
 */
export const validateEvent = (
  event: NostrEvent,
  config: ValidationConfig = DEFAULT_CONFIG.validation,
  targetType?: ScrutinyType | null,
): { ok: boolean; issues: readonly ScrutinyIssue[] } => {
  const allIssues: ScrutinyIssue[] = [];
  const collect = (r: { issues: readonly ScrutinyIssue[] }) => {
    allIssues.push(...r.issues);
  };

  collect(validateCoreTags(event, config));
  collect(validateImeta(event));
  collect(validateIdentifiers(event, config));

  const type = extractScrutinyType(event);

  if (type === 'binding') {
    collect(validateBindingEvent(event, config));
  }

  if (type === 'update' && targetType !== undefined) {
    collect(validateUpdateTarget(event, targetType));
  }

  if (type === 'retract' && targetType !== undefined) {
    collect(validateRetractionTarget(event, targetType));
  }

  return allIssues.length === 0
    ? { ok: true, issues: [] }
    : { ok: false, issues: allIssues };
};
