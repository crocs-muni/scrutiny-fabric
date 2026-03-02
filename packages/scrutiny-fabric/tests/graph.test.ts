import { describe, expect, it } from 'vitest';
import { eventId, pubkey } from '../src/types/index.js';
import { buildAdjacency, buildRelationshipEdges, traverseGraph } from '../src/graph/index.js';
import { makeEvent, ALT_PUBKEY } from './fixtures.js';

describe('graph module', () => {
  // ── Edge building ─────────────────────────────────────────────────────
  it('builds a directed edge from a binding event', () => {
    const binding = makeEvent({
      id: eventId('b'.repeat(64)),
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'test', 'scrutiny:binding:relationship'],
      ],
    });

    const edges = buildRelationshipEdges([binding]);
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe('2'.repeat(64));
    expect(edges[0].to).toBe('1'.repeat(64));
    expect(edges[0].relationship).toBe('test');
    expect(edges[0].symmetric).toBe(false);
    expect(edges[0].endorsementCount).toBe(1);
  });

  it('produces bidirectional edges for symmetric relationships', () => {
    const binding = makeEvent({
      id: eventId('b'.repeat(64)),
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'same', 'scrutiny:binding:relationship'],
      ],
    });

    const edges = buildRelationshipEdges([binding]);
    expect(edges).toHaveLength(2);
    const froms = edges.map((e) => e.from as string);
    expect(froms).toContain('1'.repeat(64));
    expect(froms).toContain('2'.repeat(64));
  });

  // ── Deduplication ─────────────────────────────────────────────────────
  it('deduplicates identical edges from the same pubkey', () => {
    const PK = pubkey('a'.repeat(64));
    const binding1 = makeEvent({
      id: eventId('b'.repeat(64)),
      pubkey: PK,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'test', 'scrutiny:binding:relationship'],
      ],
    });

    const binding2 = makeEvent({
      id: eventId('c'.repeat(64)),
      pubkey: PK,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'test', 'scrutiny:binding:relationship'],
      ],
    });

    const edges = buildRelationshipEdges([binding1, binding2]);
    expect(edges).toHaveLength(1);
    expect(edges[0].endorsementCount).toBe(1); // same pubkey → 1 endorser
    expect(edges[0].bindingIds).toHaveLength(2); // both binding IDs tracked
  });

  // ── Multi-pubkey endorsement ──────────────────────────────────────────
  it('aggregates endorsers from different pubkeys', () => {
    const pk1 = pubkey('a'.repeat(64));
    const pk2 = ALT_PUBKEY;

    const binding1 = makeEvent({
      id: eventId('b'.repeat(64)),
      pubkey: pk1,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'vulnerability', 'scrutiny:binding:relationship'],
      ],
    });

    const binding2 = makeEvent({
      id: eventId('d'.repeat(64)),
      pubkey: pk2,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'vulnerability', 'scrutiny:binding:relationship'],
      ],
    });

    const edges = buildRelationshipEdges([binding1, binding2]);
    expect(edges).toHaveLength(1);
    expect(edges[0].endorsementCount).toBe(2);
    expect(edges[0].endorsers).toContain(pk1);
    expect(edges[0].endorsers).toContain(pk2);
  });

  // ── Traversal ─────────────────────────────────────────────────────────
  it('traverses with depth limit', () => {
    const edges = buildRelationshipEdges([
      makeEvent({
        id: eventId('b'.repeat(64)),
        tags: [
          ['t', 'scrutiny_fabric'],
          ['t', 'scrutiny_binding'],
          ['e', 'B'.repeat(64), '', 'root'],
          ['q', 'A'.repeat(64)],
          ['L', 'scrutiny:binding:relationship'],
          ['l', 'related', 'scrutiny:binding:relationship'],
        ],
      }),
      makeEvent({
        id: eventId('c'.repeat(64)),
        tags: [
          ['t', 'scrutiny_fabric'],
          ['t', 'scrutiny_binding'],
          ['e', 'C'.repeat(64), '', 'root'],
          ['q', 'B'.repeat(64)],
          ['L', 'scrutiny:binding:relationship'],
          ['l', 'test', 'scrutiny:binding:relationship'],
        ],
      }),
    ]);

    const adjacency = buildAdjacency(edges);
    const d1 = traverseGraph(adjacency, 'A'.repeat(64), 1);
    const d2 = traverseGraph(adjacency, 'A'.repeat(64), 2);

    // related is symmetric, so A→B and B→A are both edges
    expect(d1.visited.has('B'.repeat(64))).toBe(true);
    expect(d1.visited.has('C'.repeat(64))).toBe(false);
    expect(d2.visited.has('C'.repeat(64))).toBe(true);
  });
});
