import { describe, expect, it } from 'vitest';
import { eventId, pubkey } from '../src/types/index.js';
import {
  extractBindingEndpoints,
  extractIdentifiers,
  extractImeta,
  extractLabels,
  extractRelationship,
  extractScrutinyType,
  isValidIdentifierPrefix,
} from '../src/parse/index.js';
import { makeEvent } from './fixtures.js';

describe('parse module', () => {
  // ── Type extraction ─────────────────────────────────────────────────
  it('extracts scrutiny type from a valid event', () => {
    expect(extractScrutinyType(makeEvent())).toBe('product');
  });

  it('returns null when zero type tags present', () => {
    const event = makeEvent({ tags: [['t', 'scrutiny_fabric'], ['t', 'scrutiny_v032']] });
    expect(extractScrutinyType(event)).toBeNull();
  });

  it('returns null when multiple type tags present', () => {
    const event = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_product'],
        ['t', 'scrutiny_metadata'],
      ],
    });
    expect(extractScrutinyType(event)).toBeNull();
  });

  // ── Labels & identifiers ────────────────────────────────────────────
  it('extracts labels and identifiers', () => {
    const event = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_product'],
        ['L', 'scrutiny:product:vendor'],
        ['l', 'Infineon', 'scrutiny:product:vendor'],
        ['i', 'cpe:2.3:h:infineon:m7794a12'],
      ],
    });

    const labels = extractLabels(event);
    const identifiers = extractIdentifiers(event);

    expect(labels['scrutiny:product:vendor']).toEqual(['Infineon']);
    expect(identifiers[0].prefix).toBe('cpe');
    expect(identifiers[0].value).toBe('2.3:h:infineon:m7794a12');
  });

  // ── Identifier prefix validation ────────────────────────────────────
  it('validates lowercase ASCII prefixes', () => {
    expect(isValidIdentifierPrefix('cpe')).toBe(true);
    expect(isValidIdentifierPrefix('purl')).toBe(true);
    expect(isValidIdentifierPrefix('CPE')).toBe(false);
    expect(isValidIdentifierPrefix('cpe2')).toBe(false);
    expect(isValidIdentifierPrefix('')).toBe(false);
  });

  // ── Binding endpoints ───────────────────────────────────────────────
  it('extracts binding endpoints and default relationship', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root', '2'.repeat(64)],
        ['q', '3'.repeat(64), '', '4'.repeat(64)],
      ],
    });

    const endpoints = extractBindingEndpoints(binding);
    expect(endpoints?.anchorEventId).toBe('1'.repeat(64));
    expect(endpoints?.otherEventId).toBe('3'.repeat(64));
    expect(extractRelationship(binding)).toBe('related');
  });

  it('returns null when binding has multiple q tags', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['q', '3'.repeat(64)],
      ],
    });
    expect(extractBindingEndpoints(binding)).toBeNull();
  });

  // ── Relationship ambiguity ──────────────────────────────────────────
  it('returns null when multiple conflicting relationship labels exist', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'test', 'scrutiny:binding:relationship'],
        ['l', 'vulnerability', 'scrutiny:binding:relationship'],
      ],
    });
    expect(extractRelationship(binding)).toBeNull();
  });

  // ── imeta ───────────────────────────────────────────────────────────
  it('extracts imeta fields', () => {
    const metadata = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_metadata'],
        [
          'imeta',
          'url https://example.com/report.pdf',
          'm application/pdf',
          'x 146c288512b1bd16b0c4fb29de255ad72c3757fcaf431cd8ef856e28f0a4aacf',
          'size 100',
        ],
      ],
    });

    const artifacts = extractImeta(metadata);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].url).toBe('https://example.com/report.pdf');
    expect(artifacts[0].m).toBe('application/pdf');
    expect(artifacts[0].x).toBe('146c288512b1bd16b0c4fb29de255ad72c3757fcaf431cd8ef856e28f0a4aacf');
  });
});
