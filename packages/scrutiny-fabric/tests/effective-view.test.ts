import { describe, expect, it } from 'vitest';
import { eventId, pubkey } from '../src/types/index.js';
import { computeEffectiveView } from '../src/effective-view/index.js';
import { makeEvent } from './fixtures.js';

const PK = pubkey('a'.repeat(64));

describe('computeEffectiveView', () => {
  // ── Baseline ──────────────────────────────────────────────────────────
  it('returns the original event when there are no updates or retractions', () => {
    const target = makeEvent({ id: eventId('1'.repeat(64)), pubkey: PK });
    const view = computeEffectiveView({ target, updates: [], retractions: [] });

    expect(view.targetId).toBe(target.id);
    expect(view.retracted).toBe(false);
    expect(view.content).toBe('content');
    expect(view.appliedUpdateIds).toEqual([]);
  });

  // ── Content update via content field (spec §5.1) ──────────────────────
  it('replaces content from update.content when non-empty', () => {
    const target = makeEvent({ id: eventId('1'.repeat(64)), pubkey: PK, content: 'original' });
    const update = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: PK,
      created_at: 2,
      content: 'updated content',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    const view = computeEffectiveView({ target, updates: [update], retractions: [] });
    expect(view.content).toBe('updated content');
  });

  it('preserves content when update.content is empty string', () => {
    const target = makeEvent({ id: eventId('1'.repeat(64)), pubkey: PK, content: 'original' });
    const update = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: PK,
      created_at: 2,
      content: '',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    const view = computeEffectiveView({ target, updates: [update], retractions: [] });
    expect(view.content).toBe('original');
  });

  // ── Label replacement and namespace deletion ──────────────────────────
  it('replaces labels per namespace and deletes via empty value', () => {
    const target = makeEvent({
      id: eventId('1'.repeat(64)),
      pubkey: PK,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_product'],
        ['L', 'scrutiny:product:vendor'],
        ['l', 'OldVendor', 'scrutiny:product:vendor'],
        ['L', 'scrutiny:product:category'],
        ['l', 'smartcard', 'scrutiny:product:category'],
      ],
    });

    const update = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: PK,
      created_at: 2,
      content: '',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
        ['L', 'scrutiny:product:vendor'],
        ['l', 'NewVendor', 'scrutiny:product:vendor'],
        // Delete category namespace via empty l value
        ['L', 'scrutiny:product:category'],
        ['l', '', 'scrutiny:product:category'],
      ],
    });

    const view = computeEffectiveView({ target, updates: [update], retractions: [] });
    expect(view.labels['scrutiny:product:vendor']).toEqual(['NewVendor']);
    expect(view.labels['scrutiny:product:category']).toBeUndefined();
  });

  // ── Deterministic merge order ─────────────────────────────────────────
  it('applies updates in ascending created_at, then lexicographic id', () => {
    const target = makeEvent({
      id: eventId('1'.repeat(64)),
      pubkey: PK,
      content: 'original',
    });

    const update1 = makeEvent({
      id: eventId('3'.repeat(64)), // lex later
      pubkey: PK,
      created_at: 2,
      content: 'from update1',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    const update2 = makeEvent({
      id: eventId('2'.repeat(64)), // lex earlier, same created_at
      pubkey: PK,
      created_at: 2,
      content: 'from update2',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    // Pass out of order — should be sorted by id since created_at is the same
    const view = computeEffectiveView({ target, updates: [update1, update2], retractions: [] });
    // update2 (id=222...) first, then update1 (id=333...) wins
    expect(view.content).toBe('from update1');
    expect(view.appliedUpdateIds).toEqual([update2.id, update1.id]);
  });

  // ── i and imeta full-set replacement ──────────────────────────────────
  it('replaces identifiers as full-set when present in update', () => {
    const target = makeEvent({
      id: eventId('1'.repeat(64)),
      pubkey: PK,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_product'],
        ['i', 'cpe:old'],
      ],
    });

    const update = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: PK,
      created_at: 2,
      content: '',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
        ['i', 'cpe:new1'],
        ['i', 'purl:new2'],
      ],
    });

    const view = computeEffectiveView({ target, updates: [update], retractions: [] });
    expect(view.identifiers.map((i) => i.raw)).toEqual(['cpe:new1', 'purl:new2']);
  });

  // ── Retracted updates are excluded ────────────────────────────────────
  it('excludes retracted updates from the merge', () => {
    const target = makeEvent({
      id: eventId('1'.repeat(64)),
      pubkey: PK,
      content: 'original',
    });

    const update = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: PK,
      created_at: 2,
      content: 'should be skipped',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    const retractUpdate = makeEvent({
      id: eventId('3'.repeat(64)),
      pubkey: PK,
      created_at: 3,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_retract'],
        ['e', update.id as string, '', 'root', update.pubkey as string],
      ],
    });

    const view = computeEffectiveView({
      target,
      updates: [update],
      retractions: [retractUpdate],
    });
    expect(view.content).toBe('original');
    expect(view.appliedUpdateIds).toEqual([]);
  });

  // ── Target retraction ─────────────────────────────────────────────────
  it('marks target as retracted when authoritative retraction exists', () => {
    const target = makeEvent({ id: eventId('1'.repeat(64)), pubkey: PK });
    const retract = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: PK,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_retract'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    const view = computeEffectiveView({ target, updates: [], retractions: [retract] });
    expect(view.retracted).toBe(true);
  });

  // ── Non-authoritative updates are ignored ─────────────────────────────
  it('ignores updates from a different pubkey', () => {
    const target = makeEvent({
      id: eventId('1'.repeat(64)),
      pubkey: PK,
      content: 'original',
    });
    const foreignUpdate = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: pubkey('f'.repeat(64)),
      created_at: 2,
      content: 'hacked',
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_update'],
        ['e', target.id as string, '', 'root', target.pubkey as string],
      ],
    });

    const view = computeEffectiveView({ target, updates: [foreignUpdate], retractions: [] });
    expect(view.content).toBe('original');
  });

  // ── Trusted retraction (for bindings) ─────────────────────────────────
  it('marks retracted via trusted pubkey for binding targets', () => {
    const trusted = pubkey('d'.repeat(64));
    const target = makeEvent({ id: eventId('1'.repeat(64)), pubkey: PK });
    const trustedRetract = makeEvent({
      id: eventId('2'.repeat(64)),
      pubkey: trusted,
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_retract'],
        ['e', target.id as string, '', 'root'],
      ],
    });

    const view = computeEffectiveView({
      target,
      updates: [],
      retractions: [trustedRetract],
      trustedPubkeys: new Set([trusted]),
    });
    expect(view.retracted).toBe(true);
  });
});
