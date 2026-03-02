import { describe, expect, it } from 'vitest';
import {
  buildEventsByIdsFilter,
  buildEventsTargetingFilter,
  buildMetadataBindingsFilter,
  buildProductBindingsFilter,
  buildScrutinyTypesFilter,
} from '../src/query/index.js';

describe('query builders', () => {
  it('builds scrutiny type filter with namespace and version', () => {
    const filter = buildScrutinyTypesFilter(['product', 'binding']);
    expect(filter.kinds).toEqual([1]);
    expect(filter['#t']).toContain('scrutiny_fabric');
    expect(filter['#t']).toContain('scrutiny_v032');
    expect(filter['#t']).toContain('scrutiny_product');
    expect(filter['#t']).toContain('scrutiny_binding');
  });

  it('builds product bindings filter with scrutiny_fabric tag', () => {
    const id = 'a'.repeat(64);
    const filter = buildProductBindingsFilter(id);
    expect(filter['#e']).toEqual([id]);
    expect(filter['#t']).toContain('scrutiny_fabric');
    expect(filter['#t']).toContain('scrutiny_binding');
  });

  it('builds metadata bindings filter (Metadata-First traversal)', () => {
    const id = 'b'.repeat(64);
    const filter = buildMetadataBindingsFilter(id);
    expect(filter['#q']).toEqual([id]);
    expect(filter['#t']).toContain('scrutiny_fabric');
    expect(filter['#t']).toContain('scrutiny_binding');
  });

  it('builds by-ids filter with bounded limit', () => {
    const filter = buildEventsByIdsFilter(['a', 'b', 'a'], 99999);
    expect(filter.ids).toEqual(['a', 'b']);
    expect(filter.limit).toBe(5000);
  });

  it('throws on empty ids', () => {
    expect(() => buildEventsByIdsFilter([])).toThrowError('ids cannot be empty');
  });

  it('builds targeting filter with scrutiny_fabric tag', () => {
    const filter = buildEventsTargetingFilter(['1', '2']);
    expect(filter['#e']).toEqual(['1', '2']);
    expect(filter['#t']).toContain('scrutiny_fabric');
    expect(filter['#t']).toContain('scrutiny_update');
    expect(filter['#t']).toContain('scrutiny_retract');
  });
});
