import { describe, expect, it } from 'vitest';
import {
  buildBindingEvent,
  buildMetadataEvent,
  buildProductEvent,
  buildRetractionEvent,
  buildUpdateEvent,
} from '../src/builders/index.js';
import { SCRUTINY_EVENT_KIND } from '../src/query/index.js';

describe('event builders', () => {
  it('buildProductEvent builds required base and identifier tags', () => {
    const event = buildProductEvent({
      content: 'Product A',
      identifiers: ['cpe:2.3:h:acme:widget:1.0:*:*:*:*:*:*:*'],
      labels: { 'scrutiny:product:vendor': ['ACME'] },
    });

    expect(event.kind).toBe(SCRUTINY_EVENT_KIND);
    expect(event.content).toBe('Product A');
    expect(event.tags).toContainEqual(['t', 'scrutiny_fabric']);
    expect(event.tags).toContainEqual(['t', 'scrutiny_product']);
    expect(event.tags).toContainEqual(['t', 'scrutiny_v032']);
    expect(event.tags).toContainEqual(['i', 'cpe:2.3:h:acme:widget:1.0:*:*:*:*:*:*:*']);
    expect(event.tags).toContainEqual(['L', 'scrutiny:product:vendor']);
    expect(event.tags).toContainEqual(['l', 'ACME', 'scrutiny:product:vendor']);
  });

  it('buildMetadataEvent includes imeta and labels', () => {
    const event = buildMetadataEvent({
      content: 'Metadata report',
      identifiers: ['cve:CVE-2026-0001'],
      labels: { 'scrutiny:metadata:source': ['internal'] },
      artifacts: [
        {
          url: 'https://example.com/report.json',
          mime: 'application/json',
          sha256: 'a'.repeat(64),
          size: 123,
        },
      ],
    });

    expect(event.tags).toContainEqual(['t', 'scrutiny_metadata']);
    expect(event.tags).toContainEqual(['i', 'cve:CVE-2026-0001']);
    expect(event.tags).toContainEqual(['L', 'scrutiny:metadata:source']);
    expect(event.tags).toContainEqual(['l', 'internal', 'scrutiny:metadata:source']);
    expect(event.tags).toContainEqual([
      'imeta',
      'url https://example.com/report.json',
      'm application/json',
      `x ${'a'.repeat(64)}`,
      'size 123',
    ]);
  });

  it('buildBindingEvent generates canonical e-root/q endpoints and relationship labels', () => {
    const event = buildBindingEvent({
      content: 'Binding',
      anchor: { eventId: 'p'.repeat(64), relayHint: 'wss://relay.example', pubkeyHint: 'f'.repeat(64) },
      other: { eventId: 'm'.repeat(64), relayHint: 'wss://relay2.example', pubkeyHint: 'e'.repeat(64) },
      relationship: 'vulnerability',
    });

    expect(event.tags).toContainEqual(['t', 'scrutiny_binding']);
    expect(event.tags).toContainEqual(['e', 'p'.repeat(64), 'wss://relay.example', 'root', 'f'.repeat(64)]);
    expect(event.tags).toContainEqual(['q', 'm'.repeat(64), 'wss://relay2.example', 'e'.repeat(64)]);
    expect(event.tags).toContainEqual(['L', 'scrutiny:binding:relationship']);
    expect(event.tags).toContainEqual(['l', 'vulnerability', 'scrutiny:binding:relationship']);
  });

  it('buildBindingEvent emits directed relationship label for provides', () => {
    const event = buildBindingEvent({
      content: 'Component provides capability to product',
      anchor: { eventId: 'a'.repeat(64) },
      other: { eventId: 'b'.repeat(64) },
      relationship: 'provides',
    });

    expect(event.tags).toContainEqual(['t', 'scrutiny_binding']);
    expect(event.tags).toContainEqual(['L', 'scrutiny:binding:relationship']);
    expect(event.tags).toContainEqual(['l', 'provides', 'scrutiny:binding:relationship']);
  });

  it('buildUpdateEvent points at target event and supports replacement tags', () => {
    const event = buildUpdateEvent({
      content: 'Updated description',
      targetEventId: 'u'.repeat(64),
      targetRelayHint: 'wss://relay.example',
      targetPubkeyHint: '1'.repeat(64),
      identifiers: ['cve:CVE-2026-1111'],
      labels: { 'scrutiny:update:reason': ['correction'] },
    });

    expect(event.tags).toContainEqual(['t', 'scrutiny_update']);
    expect(event.tags).toContainEqual(['e', 'u'.repeat(64), 'wss://relay.example', 'root', '1'.repeat(64)]);
    expect(event.tags).toContainEqual(['i', 'cve:CVE-2026-1111']);
    expect(event.tags).toContainEqual(['L', 'scrutiny:update:reason']);
    expect(event.tags).toContainEqual(['l', 'correction', 'scrutiny:update:reason']);
  });

  it('buildRetractionEvent points at target event with root marker', () => {
    const event = buildRetractionEvent({
      content: 'Retracted due to error',
      targetEventId: 'r'.repeat(64),
      targetRelayHint: 'wss://relay.example',
      targetPubkeyHint: '2'.repeat(64),
    });

    expect(event.tags).toContainEqual(['t', 'scrutiny_retract']);
    expect(event.tags).toContainEqual(['e', 'r'.repeat(64), 'wss://relay.example', 'root', '2'.repeat(64)]);
  });
});
