import { extractBindingEndpoints, extractRelationship } from '../parse/index.js';
import {
  DEFAULT_RELATIONSHIP,
  isSymmetric,
  type EventId,
  type NostrEvent,
  type Pubkey,
  type Relationship,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Edge types
// ---------------------------------------------------------------------------

/** A single directed edge in the SCRUTINY graph with endorsement metadata. */
export interface RelationshipEdge {
  /** Canonical key for deduplication: `from|to|relationship`. */
  readonly key: string;
  readonly from: EventId;
  readonly to: EventId;
  readonly relationship: string;
  readonly symmetric: boolean;
  /** Original binding event IDs that produced this edge. */
  readonly bindingIds: readonly EventId[];
  /** Set of unique pubkeys that authored identical bindings (endorsement). */
  readonly endorsers: readonly Pubkey[];
  /** Number of distinct endorsers (convenience). */
  readonly endorsementCount: number;
}

/** Graph traversal output. */
export interface TraversalResult {
  readonly visited: ReadonlySet<string>;
  readonly traversed: readonly RelationshipEdge[];
}

// ---------------------------------------------------------------------------
// Edge key
// ---------------------------------------------------------------------------

const edgeKey = (from: string, to: string, relationship: string): string =>
  `${from}|${to}|${relationship}`;

// ---------------------------------------------------------------------------
// Build & deduplicate edges (spec §4.3 deduplication & endorsement)
// ---------------------------------------------------------------------------

/**
 * Build relationship edges from an array of BindingEvents.
 *
 * Applies the spec's deduplication rules:
 * - Identical `(from, to, relationship)` edges from the **same pubkey**
 *   are collapsed into one (§4.3 deduplication).
 * - Identical edges from **different pubkeys** are merged with aggregated
 *   endorser metadata (§4.3 endorsement).
 * - Symmetric relationships produce edges in both directions.
 */
export const buildRelationshipEdges = (
  bindings: readonly NostrEvent[],
): RelationshipEdge[] => {
  // Intermediate: keyed by `from|to|relationship`
  const edgeMap = new Map<
    string,
    {
      from: EventId;
      to: EventId;
      relationship: string;
      symmetric: boolean;
      bindingIds: Set<string>;
      endorsers: Set<string>;
    }
  >();

  const upsertEdge = (
    from: EventId,
    to: EventId,
    relationship: string,
    symm: boolean,
    bindingId: EventId,
    authorPubkey: Pubkey,
  ) => {
    const k = edgeKey(from as string, to as string, relationship);
    const existing = edgeMap.get(k);
    if (existing) {
      existing.bindingIds.add(bindingId as string);
      existing.endorsers.add(authorPubkey as string);
    } else {
      edgeMap.set(k, {
        from,
        to,
        relationship,
        symmetric: symm,
        bindingIds: new Set([bindingId as string]),
        endorsers: new Set([authorPubkey as string]),
      });
    }
  };

  for (const binding of bindings) {
    const endpoints = extractBindingEndpoints(binding);
    if (!endpoints) continue;

    const rel = extractRelationship(binding);
    const relationship = rel ?? (DEFAULT_RELATIONSHIP as string);
    const symm = isSymmetric(relationship);

    // Primary direction:  q → e root
    upsertEdge(
      endpoints.otherEventId,
      endpoints.anchorEventId,
      relationship,
      symm,
      binding.id,
      binding.pubkey,
    );

    // Reverse direction for symmetric relationships
    if (symm) {
      upsertEdge(
        endpoints.anchorEventId,
        endpoints.otherEventId,
        relationship,
        symm,
        binding.id,
        binding.pubkey,
      );
    }
  }

  // Flatten map into array
  return [...edgeMap.values()].map((e) => ({
    key: edgeKey(e.from as string, e.to as string, e.relationship),
    from: e.from,
    to: e.to,
    relationship: e.relationship,
    symmetric: e.symmetric,
    bindingIds: [...e.bindingIds] as EventId[],
    endorsers: [...e.endorsers] as Pubkey[],
    endorsementCount: e.endorsers.size,
  }));
};

// ---------------------------------------------------------------------------
// Adjacency list
// ---------------------------------------------------------------------------

/** Build an adjacency list from deduplicated edges. */
export const buildAdjacency = (
  edges: readonly RelationshipEdge[],
): Map<string, RelationshipEdge[]> => {
  const adjacency = new Map<string, RelationshipEdge[]>();
  for (const edge of edges) {
    const current = adjacency.get(edge.from as string) ?? [];
    current.push(edge);
    adjacency.set(edge.from as string, current);
  }
  return adjacency;
};

// ---------------------------------------------------------------------------
// BFS traversal with depth limit
// ---------------------------------------------------------------------------

/**
 * Traverse the SCRUTINY graph from a seed node using BFS.
 *
 * @param adjacency — Adjacency list from `buildAdjacency`.
 * @param seedId    — Starting node ID.
 * @param maxDepth  — Maximum hop count (default 1).
 */
export const traverseGraph = (
  adjacency: ReadonlyMap<string, readonly RelationshipEdge[]>,
  seedId: string,
  maxDepth = 1,
): TraversalResult => {
  const visited = new Set<string>([seedId]);
  const traversed: RelationshipEdge[] = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: seedId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const outgoing = adjacency.get(current.id) ?? [];
    for (const edge of outgoing) {
      traversed.push(edge);
      if (!visited.has(edge.to as string)) {
        visited.add(edge.to as string);
        queue.push({ id: edge.to as string, depth: current.depth + 1 });
      }
    }
  }

  return { visited, traversed };
};
