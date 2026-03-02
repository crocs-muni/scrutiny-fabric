import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../src/types/index.js';
import {
  validateBindingEvent,
  validateCoreTags,
  validateEvent,
  validateIdentifiers,
  validateRetractionTarget,
  validateUpdateTarget,
} from '../src/validate/index.js';
import { makeEvent } from './fixtures.js';

// ── Core tags ───────────────────────────────────────────────────────────
describe('validateCoreTags', () => {
  it('accepts a minimally valid event', () => {
    expect(validateCoreTags(makeEvent()).ok).toBe(true);
  });

  it('rejects kind != 1', () => {
    const result = validateCoreTags(makeEvent({ kind: 7 }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.INVALID_KIND)).toBe(true);
  });

  it('rejects missing scrutiny_fabric tag', () => {
    const event = makeEvent({ tags: [['t', 'scrutiny_product']] });
    const result = validateCoreTags(event);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.MISSING_NAMESPACE_TAG)).toBe(true);
  });

  it('rejects multiple type tags', () => {
    const event = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_product'],
        ['t', 'scrutiny_metadata'],
      ],
    });
    const result = validateCoreTags(event);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.MULTIPLE_TYPE_TAGS)).toBe(true);
  });

  it('rejects multiple version tags', () => {
    const event = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_product'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_v099'],
      ],
    });
    const result = validateCoreTags(event);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.MULTIPLE_VERSION_TAGS)).toBe(true);
  });

  it('rejects adversarial tag count', () => {
    const tags = Array.from({ length: 1001 }, (_, i) => ['t', `tag_${i}`]);
    const result = validateCoreTags(makeEvent({ tags }), { maxTags: 1000 } as any);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.TAG_LIMIT_EXCEEDED)).toBe(true);
  });
});

// ── Binding validation ──────────────────────────────────────────────────
describe('validateBindingEvent', () => {
  it('accepts exactly one root e and one q', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root', '2'.repeat(64)],
        ['q', '3'.repeat(64), '', '4'.repeat(64)],
      ],
    });
    expect(validateBindingEvent(binding).ok).toBe(true);
  });

  it('rejects extra q endpoints', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['q', '3'.repeat(64)],
      ],
    });
    const result = validateBindingEvent(binding);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.code === ErrorCode.INVALID_BINDING_ENDPOINT_CARDINALITY),
    ).toBe(true);
  });

  it('rejects multiple conflicting relationship labels', () => {
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
    const result = validateBindingEvent(binding);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.code === ErrorCode.INVALID_RELATIONSHIP_CARDINALITY),
    ).toBe(true);
  });

  it('warns on unknown relationship value when configured strict', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'foobar', 'scrutiny:binding:relationship'],
      ],
    });
    const result = validateBindingEvent(binding, { allowUnknownRelationships: false } as any);
    expect(result.issues.some((i) => i.code === ErrorCode.UNKNOWN_RELATIONSHIP_VALUE)).toBe(true);
  });

  it('allows unknown relationship value when loose', () => {
    const binding = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_binding'],
        ['e', '1'.repeat(64), '', 'root'],
        ['q', '2'.repeat(64)],
        ['L', 'scrutiny:binding:relationship'],
        ['l', 'foobar', 'scrutiny:binding:relationship'],
      ],
    });
    const result = validateBindingEvent(binding, { allowUnknownRelationships: true } as any);
    expect(result.ok).toBe(true);
  });
});

// ── Identifier validation ───────────────────────────────────────────────
describe('validateIdentifiers', () => {
  it('accepts lowercase prefix in strict mode', () => {
    const event = makeEvent({ tags: [['t', 'scrutiny_fabric'], ['t', 'scrutiny_product'], ['i', 'cpe:2.3:h:infineon']] });
    expect(validateIdentifiers(event, { strictIdentifiers: true } as any).ok).toBe(true);
  });

  it('rejects uppercase prefix in strict mode', () => {
    const event = makeEvent({ tags: [['t', 'scrutiny_fabric'], ['t', 'scrutiny_product'], ['i', 'CPE:2.3:h:infineon']] });
    const result = validateIdentifiers(event, { strictIdentifiers: true } as any);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.INVALID_IDENTIFIER_PREFIX)).toBe(true);
  });

  it('accepts uppercase prefix when strict mode is disabled', () => {
    const event = makeEvent({ tags: [['t', 'scrutiny_fabric'], ['t', 'scrutiny_product'], ['i', 'CPE:2.3:h:infineon']] });
    const result = validateIdentifiers(event, { strictIdentifiers: false } as any);
    expect(result.ok).toBe(true);
  });
});

// ── Update target ───────────────────────────────────────────────────────
describe('validateUpdateTarget', () => {
  it('accepts product as target', () => {
    expect(validateUpdateTarget(makeEvent(), 'product').ok).toBe(true);
  });

  it('accepts metadata as target', () => {
    expect(validateUpdateTarget(makeEvent(), 'metadata').ok).toBe(true);
  });

  it('rejects binding as target (immutability)', () => {
    const result = validateUpdateTarget(makeEvent(), 'binding');
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe(ErrorCode.INVALID_UPDATE_TARGET);
  });

  it('rejects retract as target', () => {
    expect(validateUpdateTarget(makeEvent(), 'retract').ok).toBe(false);
  });
});

// ── Retraction target ───────────────────────────────────────────────────
describe('validateRetractionTarget', () => {
  it('accepts product as target', () => {
    expect(validateRetractionTarget(makeEvent(), 'product').ok).toBe(true);
  });

  it('accepts binding as target', () => {
    expect(validateRetractionTarget(makeEvent(), 'binding').ok).toBe(true);
  });

  it('rejects retraction targeting another retraction', () => {
    const result = validateRetractionTarget(makeEvent(), 'retract');
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe(ErrorCode.INVALID_RETRACTION_TARGET);
  });
});

// ── Aggregate validateEvent ─────────────────────────────────────────────
describe('validateEvent', () => {
  it('validates imeta hash and size', () => {
    const metadata = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_metadata'],
        ['imeta', 'url https://example.com/r.pdf', 'x abc', 'size nope'],
      ],
    });
    const result = validateEvent(metadata);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.INVALID_IMETA_HASH)).toBe(true);
    expect(result.issues.some((i) => i.code === ErrorCode.INVALID_IMETA_SIZE)).toBe(true);
  });

  it('rejects update targeting a binding when targetType is provided', () => {
    const update = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_update'],
        ['e', '1'.repeat(64), '', 'root'],
      ],
    });
    const result = validateEvent(update, undefined, 'binding');
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.INVALID_UPDATE_TARGET)).toBe(true);
  });

  it('rejects retraction of a retraction when targetType is provided', () => {
    const retract = makeEvent({
      tags: [
        ['t', 'scrutiny_fabric'],
        ['t', 'scrutiny_v032'],
        ['t', 'scrutiny_retract'],
        ['e', '1'.repeat(64), '', 'root'],
      ],
    });
    const result = validateEvent(retract, undefined, 'retract');
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === ErrorCode.INVALID_RETRACTION_TARGET)).toBe(true);
  });
});
