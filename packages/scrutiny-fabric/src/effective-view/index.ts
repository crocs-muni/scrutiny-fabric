import { extractImeta, extractIdentifiers, extractLabels } from '../parse/index.js';
import type {
  EffectiveView,
  EventId,
  NostrEvent,
  ParsedIdentifier,
  ParsedImeta,
  Pubkey,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ComputeEffectiveViewInput {
  /** The original Product or Metadata event. */
  readonly target: NostrEvent;
  /** All candidate UpdateEvents (will be filtered for authoritativeness). */
  readonly updates: readonly NostrEvent[];
  /** All candidate RetractionEvents. */
  readonly retractions: readonly NostrEvent[];
  /**
   * Optional set of trusted pubkeys. When provided, retractions from
   * trusted pubkeys are also honoured for BindingEvent targets (§6 step 4).
   */
  readonly trustedPubkeys?: ReadonlySet<Pubkey>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Sort by `created_at` ascending, then `id` lexicographically (spec §6 step 3). */
const sortByCreatedAtThenId = (events: readonly NostrEvent[]): NostrEvent[] =>
  [...events].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at - b.created_at;
    return (a.id as string).localeCompare(b.id as string);
  });

/** Extract the single `e root` target ID from an event. */
const getRootTargetId = (event: NostrEvent): EventId | null => {
  const roots = event.tags.filter((tag) => tag[0] === 'e' && tag[3] === 'root');
  if (roots.length !== 1) return null;
  return (roots[0][1] ?? null) as EventId | null;
};

/** Check that an event is authoritative for a given target (same author + targets it). */
const authoritativeForTarget = (event: NostrEvent, target: NostrEvent): boolean =>
  event.pubkey === target.pubkey && getRootTargetId(event) === target.id;

/**
 * Merge a label patch into the current label state.
 *
 * Per spec §5.1:
 * - Namespaces present in the patch **replace** the current namespace entirely.
 * - An empty `l` value (`""`) in a namespace **deletes** that namespace.
 */
const applyLabelPatch = (
  current: Record<string, string[]>,
  patch: Record<string, string[]>,
): Record<string, string[]> => {
  const next: Record<string, string[]> = { ...current };
  for (const [namespace, values] of Object.entries(patch)) {
    if (values.some((v) => v === '')) {
      delete next[namespace];
      continue;
    }
    next[namespace] = [...values];
  }
  return next;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Effective View of a Product or Metadata event.
 *
 * Implements the full algorithm from spec §6:
 * 1. Start with the target's content, labels, identifiers, and artifacts.
 * 2. Collect authoritative (same-author) retractions of the target.
 * 3. Collect authoritative updates, excluding retracted ones.
 * 4. Apply updates in merge order (ascending `created_at`, then lex `id`).
 * 5. Content: replaced by `update.content` when non-empty (§5.1).
 * 6. Labels: replaced per namespace; empty `l` deletes namespace (§5.1).
 * 7. `i` and `imeta`: full-set replacement when present in update (§5.1).
 */
export const computeEffectiveView = ({
  target,
  updates,
  retractions,
  trustedPubkeys,
}: ComputeEffectiveViewInput): EffectiveView => {
  let content = target.content;
  let labels = extractLabels(target);
  let identifiers: ParsedIdentifier[] = extractIdentifiers(target);
  let artifacts: ParsedImeta[] = extractImeta(target);

  // --- Retractions of the target itself ---
  const authoritativeRetractions = retractions.filter((r) =>
    authoritativeForTarget(r, target),
  );

  // Trusted retractions (for BindingEvents, §6 step 4)
  const trustedRetractions = trustedPubkeys
    ? retractions.filter(
      (r) =>
        trustedPubkeys.has(r.pubkey) &&
        getRootTargetId(r) === target.id,
    )
    : [];

  const retracted =
    authoritativeRetractions.length > 0 || trustedRetractions.length > 0;

  // --- Identify retracted updates ---
  const retractedUpdateIds = new Set<string>(
    retractions
      .filter((r) =>
        updates.some(
          (u) =>
            (u.id as string) === (getRootTargetId(r) as string | null) &&
            r.pubkey === u.pubkey,
        ),
      )
      .map((r) => getRootTargetId(r) as string)
      .filter(Boolean),
  );

  // --- Authoritative updates, sorted in merge order ---
  const authoritativeUpdates = sortByCreatedAtThenId(
    updates.filter(
      (u) =>
        authoritativeForTarget(u, target) &&
        !retractedUpdateIds.has(u.id as string),
    ),
  );

  // --- Apply updates sequentially ---
  for (const update of authoritativeUpdates) {
    // Content: replaced when non-empty (spec §5.1)
    if (update.content !== '') {
      content = update.content;
    }

    // Labels: per-namespace replacement (spec §5.1)
    const patchLabels = extractLabels(update);
    if (Object.keys(patchLabels).length > 0) {
      labels = applyLabelPatch(labels, patchLabels);
    }

    // Identifiers: full-set replacement when present (spec §5.1)
    const replacementI = extractIdentifiers(update);
    if (replacementI.length > 0) {
      identifiers = replacementI;
    }

    // Artifacts: full-set replacement when present (spec §5.1)
    const replacementImeta = extractImeta(update);
    if (replacementImeta.length > 0) {
      artifacts = replacementImeta;
    }
  }

  return {
    targetId: target.id,
    retracted,
    content,
    labels,
    identifiers,
    artifacts,
    appliedUpdateIds: authoritativeUpdates.map((u) => u.id),
  };
};
