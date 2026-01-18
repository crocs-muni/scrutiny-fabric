import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { normalizeLabel } from './labelRegistry';

export type EventType = 'product' | 'metadata' | 'binding' | 'update' | 'contestation' | 'confirmation' | 'unknown';

export interface ScrutinyEvent extends NostrEvent {
  eventType?: EventType;
}

export interface CategorizedEvents {
  bindings: Map<string, ScrutinyEvent>;
  products: Map<string, ScrutinyEvent>;
  metadata: Map<string, ScrutinyEvent>;
  updates: Map<string, ScrutinyEvent[]>;
  confirmations: Map<string, ScrutinyEvent[]>;
  contestations: Map<string, ScrutinyEvent[]>;
}

export interface Relationships {
  bindingToProducts: Map<string, string[]>;
  bindingToMetadata: Map<string, string[]>;
  productToBindings: Map<string, string[]>;
  metadataToBindings: Map<string, string[]>;
  contestationToAlternative: Map<string, string>;
  /** Product-to-product: A contains B (composition/BOM) */
  productContains: Map<string, string[]>;
  /** Product-to-product: A depends on B (library/firmware dependency) */
  productDependsOn: Map<string, string[]>;
  /** Reverse lookup: which products contain this product */
  productContainedBy: Map<string, string[]>;
  /** Reverse lookup: which products depend on this product */
  productDependedOnBy: Map<string, string[]>;
}

export function determineEventType(tags: string[][]): EventType {
  const tTags = tags.filter(t => t[0] === 't').map(t => t[1]);

  const includesAny = (base: string) => {
    // (underscores)
    const modern = [
      base,
      `#${base}`,
      `${base}_v01`,
      `#${base}_v01`
    ];

    // Legacy format (hyphens) - for backward compatibility
    const legacyBase = base.replace(/_/g, '-');
    const legacy = [
      legacyBase,
      `#${legacyBase}`,
      `${legacyBase}-v0`,
      `#${legacyBase}-v0`
    ];

    const allVariants = [...modern, ...legacy];
    return allVariants.some(variant => tTags.includes(variant));
  };

  // IMPORTANT: Check reply event types FIRST before base types
  // Reply events contain BOTH their reply tag AND the original event's tag
  if (includesAny('scrutiny_update')) return 'update';
  if (includesAny('scrutiny_contestation')) return 'contestation';
  if (includesAny('scrutiny_confirmation')) return 'confirmation';

  // Then check base event types
  if (includesAny('scrutiny_product')) return 'product';
  if (includesAny('scrutiny_metadata')) return 'metadata';
  if (includesAny('scrutiny_binding')) return 'binding';

  return 'unknown';
}

function extractTTags(tags: string[][]): string[] {
  return tags.filter(t => t[0] === 't').map(t => t[1]);
}

function tagVariants(base: string): string[] {
  // Some historical events used `_v01` while others used `-v0` (hyphenated) for versioning,
  // and some relays store hashtags as `#...` as well.
  return [
    base,
    `#${base}`,
    `${base}_v01`,
    `#${base}_v01`,
    `${base}-v0`,
    `#${base}-v0`,
  ];
}

function hasAnyTag(tTags: string[], variants: string[]): boolean {
  return variants.some(v => tTags.includes(v));
}

export type LegacyScrutinyReason = 'scrutiny_mo' | 'scrutiny-mo' | 'hyphenated-tags';

/**
 * Returns a legacy marker if the event appears to use pre-`scrutiny_fabric` tagging conventions.
 *
 * - If the event contains `scrutiny_fabric` namespace tags, it is NOT considered legacy.
 * - If the event contains legacy namespace tags (`scrutiny_mo` / `scrutiny-mo`), it is legacy.
 * - Otherwise, if it contains only legacy hyphenated type tags (e.g. `scrutiny-binding-v0`),
 *   it is treated as legacy as well.
 */
export function getLegacyScrutinyReason(tags: string[][]): LegacyScrutinyReason | null {
  const tTags = extractTTags(tags);

  if (hasAnyTag(tTags, tagVariants('scrutiny_fabric'))) {
    return null;
  }

  if (hasAnyTag(tTags, tagVariants('scrutiny_mo'))) {
    return 'scrutiny_mo';
  }

  if (hasAnyTag(tTags, tagVariants('scrutiny-mo'))) {
    return 'scrutiny-mo';
  }

  // Legacy hyphenated *type* tags (these can appear without an explicit namespace tag)
  const legacyHyphenTypes = [
    'scrutiny_binding',
    'scrutiny_product',
    'scrutiny_metadata',
    'scrutiny_update',
    'scrutiny_contestation',
    'scrutiny_confirmation',
  ].flatMap((base) => {
    const hyphen = base.replace(/_/g, '-');
    return [hyphen, `#${hyphen}`, `${hyphen}-v0`, `#${hyphen}-v0`];
  });

  return legacyHyphenTypes.some(v => tTags.includes(v)) ? 'hyphenated-tags' : null;
}

export function isLegacyScrutinyEvent(tags: string[][]): boolean {
  return getLegacyScrutinyReason(tags) !== null;
}

export function extractETags(event: NostrEvent, role: string | null = null): string[] {
  return event.tags
    .filter(t => t[0] === 'e' && (role === null || t[3] === role))
    .map(t => t[1]);
}

export function extractDTag(event: NostrEvent): string | null {
  return event.tags.find(t => t[0] === 'd')?.[1] || null;
}

export function extractLabels(event: NostrEvent): Record<string, { value: string; type?: string }> {
  const result: Record<string, { value: string; type?: string }> = {};

  for (const tag of event.tags) {
    if (tag[0] !== 'l') continue;

    // NIP-32 tag structure: ["l", value, namespace, optional_type]
    // The namespace identifies what kind of label it is (e.g., "scrutiny:product:vendor")
    // The value is the actual content (e.g., "Infineon Technologies AG")
    const [, value, namespace, type] = tag;
    if (!value || !namespace) continue;

    // Normalize the namespace (handles both legacy flat names and namespaced)
    const normalizedName = normalizeLabel(namespace);

    // Store under normalized name for backward compatibility
    // Only store first occurrence (don't overwrite)
    if (!result[normalizedName]) {
      result[normalizedName] = { value, type };
    }

    // Also store under original namespace if different (for direct access)
    if (namespace !== normalizedName && !result[namespace]) {
      result[namespace] = { value, type };
    }
  }

  return result;
}

/**
 * Extract all values for labels that can have multiple occurrences.
 * Handles both legacy flat names and namespaced labels.
 */
export function extractMultiLabels(event: NostrEvent, labelName: string): string[] {
  const normalizedTarget = normalizeLabel(labelName);
  const values: string[] = [];

  for (const tag of event.tags) {
    if (tag[0] !== 'l') continue;

    // NIP-32 tag structure: ["l", value, namespace]
    const [, value, namespace] = tag;
    if (!value || !namespace) continue;

    const normalizedName = normalizeLabel(namespace);
    if (normalizedName === normalizedTarget || namespace === labelName) {
      values.push(value);
    }
  }

  return values;
}

/**
 * Extract product-to-product relationships from e-tags with relationship markers.
 * Per SCRUTINY spec, relationships use e-tags with marker set to the relationship namespace.
 */
export interface ProductRelationships {
  contains: string[];      // Event IDs of contained products
  dependsOn: string[];     // Event IDs of dependencies
  supersedes?: string;     // Event ID of product this supersedes
  successor?: string;      // Event ID of successor product
}

export function extractProductRelationships(event: NostrEvent): ProductRelationships {
  const result: ProductRelationships = {
    contains: [],
    dependsOn: [],
  };

  for (const tag of event.tags) {
    if (tag[0] !== 'e') continue;

    const [, eventId, , marker] = tag;
    if (!eventId || !marker) continue;

    // Check for relationship markers
    if (marker === 'scrutiny:product:contains') {
      result.contains.push(eventId);
    } else if (marker === 'scrutiny:product:depends_on') {
      result.dependsOn.push(eventId);
    } else if (marker === 'scrutiny:product:supersedes') {
      result.supersedes = eventId;
    } else if (marker === 'scrutiny:product:successor') {
      result.successor = eventId;
    }
  }

  // Also check NIP-32 labels for relationships (fallback/additional source)
  const labels = extractLabels(event);
  if (labels['contains']?.value && !result.contains.includes(labels['contains'].value)) {
    result.contains.push(labels['contains'].value);
  }
  if (labels['depends_on']?.value && !result.dependsOn.includes(labels['depends_on'].value)) {
    result.dependsOn.push(labels['depends_on'].value);
  }
  if (labels['supersedes']?.value && !result.supersedes) {
    result.supersedes = labels['supersedes'].value;
  }
  if (labels['successor']?.value && !result.successor) {
    result.successor = labels['successor'].value;
  }

  return result;
}

export function extractURLAndHash(event: NostrEvent): { url?: string; hash?: string } {
  const url = event.tags.find(t => t[0] === 'url')?.[1];
  const hash = event.tags.find(t => t[0] === 'x')?.[1];
  return { url, hash };
}

function parseBindingReferences(binding: NostrEvent): Map<string, 'product' | 'metadata'> {
  const typeMap = new Map<string, 'product' | 'metadata'>();

  console.log('🔍 Parsing binding content for type hints:', binding.id.substring(0, 8));

  const lines = binding.content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    const productMatch = trimmed.match(/^Product:\s+nostr:(note1[a-z0-9]+|nevent1[a-z0-9]+)/i);
    const metadataMatch = trimmed.match(/^Metadata:\s+nostr:(note1[a-z0-9]+|nevent1[a-z0-9]+)/i);

    if (productMatch) {
      try {
        const bech32 = productMatch[1];
        if (bech32.startsWith('note1')) {
          const decoded = nip19.decode(bech32);
          if (decoded.type === 'note') {
            const eventId = decoded.data;
            typeMap.set(eventId, 'product');
            console.log('  📦 Product hint:', eventId.substring(0, 8));
          }
        }
      } catch {
        // Ignore parse errors
      }
    } else if (metadataMatch) {
      try {
        const bech32 = metadataMatch[1];
        if (bech32.startsWith('note1')) {
          const decoded = nip19.decode(bech32);
          if (decoded.type === 'note') {
            const eventId = decoded.data;
            typeMap.set(eventId, 'metadata');
            console.log('  📄 Metadata hint:', eventId.substring(0, 8));
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  console.log('📊 Total hints parsed:', typeMap.size);
  return typeMap;
}

export function shouldReplace(originalEvent: NostrEvent, updateEvent: NostrEvent): boolean {
  const rootTag = updateEvent.tags.find(t =>
    t[0] === 'e' && t[1] === originalEvent.id && t[3] === 'root'
  );
  if (!rootTag) return false;

  if (updateEvent.pubkey !== originalEvent.pubkey) return false;

  if (updateEvent.created_at <= originalEvent.created_at) return false;

  const hasUpdateTag = updateEvent.tags.some(t => {
    if (t[0] !== 't') return false;
    const v = t[1];
    return (
      v === 'scrutiny_update' ||
      v === '#scrutiny_update' ||
      v === 'scrutiny_update_v01' ||
      v === '#scrutiny_update_v01'
    );
  });
  if (!hasUpdateTag) return false;

  return true;
}

export function categorizeEvents(events: NostrEvent[]): CategorizedEvents {
  const categories: CategorizedEvents = {
    bindings: new Map(),
    products: new Map(),
    metadata: new Map(),
    updates: new Map(),
    confirmations: new Map(),
    contestations: new Map()
  };

  console.log('📋 Categorizing', events.length, 'events...');
  const unknownEvents: NostrEvent[] = [];

  for (const event of events) {
    const type = determineEventType(event.tags);
    const scrutinyEvent = { ...event, eventType: type };
    const shortId = event.id.substring(0, 8);

    switch (type) {
      case 'binding':
        categories.bindings.set(event.id, scrutinyEvent);
        console.log('  🔗 Binding:', shortId);
        break;
      case 'product':
        categories.products.set(event.id, scrutinyEvent);
        console.log('  📦 Product:', shortId);
        break;
      case 'metadata':
        categories.metadata.set(event.id, scrutinyEvent);
        console.log('  📄 Metadata:', shortId);
        break;
      case 'update':
        {
          const originalId = extractETags(event, 'root')[0];
          if (originalId) {
            if (!categories.updates.has(originalId)) {
              categories.updates.set(originalId, []);
            }
            categories.updates.get(originalId)!.push(scrutinyEvent);
            console.log('  🔄 Update:', shortId, '→', originalId.substring(0, 8));
          }
        }
        break;
      case 'confirmation':
        {
          const confirmedId = extractETags(event, 'root')[0];
          if (confirmedId) {
            if (!categories.confirmations.has(confirmedId)) {
              categories.confirmations.set(confirmedId, []);
            }
            categories.confirmations.get(confirmedId)!.push(scrutinyEvent);
            console.log('  ✓ Confirmation:', shortId, '→', confirmedId.substring(0, 8));
          }
        }
        break;
      case 'contestation':
        {
          const contestedId = extractETags(event, 'root')[0];
          if (contestedId) {
            if (!categories.contestations.has(contestedId)) {
              categories.contestations.set(contestedId, []);
            }
            categories.contestations.get(contestedId)!.push(scrutinyEvent);
            console.log('  ⚠ Contestation:', shortId, '→', contestedId.substring(0, 8));
          }
        }
        break;
      case 'unknown':
        unknownEvents.push(event);
        console.log('  ❓ Unknown type:', shortId, '- tags:', event.tags.filter(t => t[0] === 't').map(t => t[1]).join(', '));
        break;
    }
  }

  if (unknownEvents.length > 0) {
    console.log('⚠️ Found', unknownEvents.length, 'unknown events (no SCRUTINY tags)');
  }

  return categories;
}

export function mapRelationships(categorizedEvents: CategorizedEvents): Relationships {
  const relationships: Relationships = {
    bindingToProducts: new Map(),
    bindingToMetadata: new Map(),
    productToBindings: new Map(),
    metadataToBindings: new Map(),
    contestationToAlternative: new Map(),
    productContains: new Map(),
    productDependsOn: new Map(),
    productContainedBy: new Map(),
    productDependedOnBy: new Map(),
  };

  console.log('🔗 Mapping relationships for', categorizedEvents.bindings.size, 'bindings...');

  for (const [id, binding] of categorizedEvents.bindings) {
    const shortId = id.substring(0, 8);
    const mentions = extractETags(binding, 'mention');
    console.log(`\n🔍 Processing binding ${shortId}:`, mentions.length, 'mentions');

    const allProductIds: string[] = [];
    const allMetadataIds: string[] = [];

    // Parse content for type hints
    const typeHints = parseBindingReferences(binding);

    for (const mentionId of mentions) {
      const shortMentionId = mentionId.substring(0, 8);

      // Priority 1: Check if it exists and is categorized
      if (categorizedEvents.products.has(mentionId)) {
        allProductIds.push(mentionId);
        console.log(`  ✓ ${shortMentionId} → PRODUCT (categorized)`);
      } else if (categorizedEvents.metadata.has(mentionId)) {
        allMetadataIds.push(mentionId);
        console.log(`  ✓ ${shortMentionId} → METADATA (categorized)`);
      } else {
        // Priority 2: Use type hint from content parsing
        const hintedType = typeHints.get(mentionId);
        if (hintedType === 'product') {
          allProductIds.push(mentionId);
          console.log(`  ⚠ ${shortMentionId} → PRODUCT (content hint, not found in categorized)`);
        } else if (hintedType === 'metadata') {
          allMetadataIds.push(mentionId);
          console.log(`  ⚠ ${shortMentionId} → METADATA (content hint, not found in categorized)`);
        } else {
          // Priority 3: Default to metadata
          allMetadataIds.push(mentionId);
          console.log(`  ❌ ${shortMentionId} → METADATA (default, no hint)`);
        }
      }
    }

    console.log(`  📊 Result: ${allProductIds.length} products, ${allMetadataIds.length} metadata`);

    relationships.bindingToProducts.set(id, allProductIds);
    relationships.bindingToMetadata.set(id, allMetadataIds);

    // Reverse mapping for found events only
    for (const productId of allProductIds) {
      if (categorizedEvents.products.has(productId)) {
        if (!relationships.productToBindings.has(productId)) {
          relationships.productToBindings.set(productId, []);
        }
        relationships.productToBindings.get(productId)!.push(id);
      }
    }

    for (const metaId of allMetadataIds) {
      if (categorizedEvents.metadata.has(metaId)) {
        if (!relationships.metadataToBindings.has(metaId)) {
          relationships.metadataToBindings.set(metaId, []);
        }
        relationships.metadataToBindings.get(metaId)!.push(id);
      }
    }
  }

  // Map contestations to alternatives
  for (const [, contestations] of categorizedEvents.contestations) {
    for (const contestation of contestations) {
      const alternativeId = extractETags(contestation, 'mention')[0];
      if (alternativeId) {
        relationships.contestationToAlternative.set(contestation.id, alternativeId);
      }
    }
  }

  // Map product-to-product relationships (contains, depends_on)
  console.log('🔗 Mapping product relationships for', categorizedEvents.products.size, 'products...');
  for (const [id, product] of categorizedEvents.products) {
    const productRels = extractProductRelationships(product);
    const shortId = id.substring(0, 8);

    // Contains relationships
    if (productRels.contains.length > 0) {
      relationships.productContains.set(id, productRels.contains);
      console.log(`  📦 ${shortId} contains:`, productRels.contains.map(c => c.substring(0, 8)).join(', '));

      // Reverse mapping: which products contain this one
      for (const containedId of productRels.contains) {
        if (!relationships.productContainedBy.has(containedId)) {
          relationships.productContainedBy.set(containedId, []);
        }
        relationships.productContainedBy.get(containedId)!.push(id);
      }
    }

    // Depends-on relationships
    if (productRels.dependsOn.length > 0) {
      relationships.productDependsOn.set(id, productRels.dependsOn);
      console.log(`  📦 ${shortId} depends on:`, productRels.dependsOn.map(d => d.substring(0, 8)).join(', '));

      // Reverse mapping: which products depend on this one
      for (const depId of productRels.dependsOn) {
        if (!relationships.productDependedOnBy.has(depId)) {
          relationships.productDependedOnBy.set(depId, []);
        }
        relationships.productDependedOnBy.get(depId)!.push(id);
      }
    }
  }

  return relationships;
}

export function deduplicateEvents(events: NostrEvent[]): NostrEvent[] {
  const seen = new Set<string>();
  return events.filter(event => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}

export interface EventFilters {
  dateRange: { start: number | null; end: number | null };
  author: string | null;
  dTag: string | null;
  cpe23: string | null;
}

export function getLatestUpdate(updates: ScrutinyEvent[] | undefined): ScrutinyEvent | undefined {
  if (!updates || updates.length === 0) {
    return undefined;
  }
  // Sort by created_at descending and return the newest
  return updates.slice().sort((a, b) => b.created_at - a.created_at)[0];
}

export function getDisplayEvent<T extends NostrEvent>(original: T, update?: NostrEvent, forceOriginal = false): { display: T | NostrEvent; isUpdated: boolean } {
  if (update && !forceOriginal && shouldReplace(original, update)) {
    return { display: update, isUpdated: true };
  }
  return { display: original, isUpdated: false };
}

export function applyFilters(events: ScrutinyEvent[], filters: EventFilters): ScrutinyEvent[] {
  return events.filter(event => {
    if (filters.dateRange.start && event.created_at < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && event.created_at > filters.dateRange.end) {
      return false;
    }

    if (filters.author && event.pubkey !== filters.author) {
      return false;
    }

    if (filters.dTag) {
      const dTag = extractDTag(event);
      if (!dTag || !dTag.includes(filters.dTag)) {
        return false;
      }
    }

    if (filters.cpe23) {
      const labels = extractLabels(event);
      const cpe = labels['cpe23']?.value;
      if (!cpe || !cpe.includes(filters.cpe23)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validates CPE 2.3 format
 * Format: cpe:2.3:part:vendor:product:version:update:edition:lang:sw_ed:target_sw:target_hw:other
 */
/**
 * Validates Package URL (PURL) format
 * Format: pkg:type/namespace/name@version or pkg:type/name@version
 */
export function validatePURL(purl: string): boolean {
  const pattern = /^pkg:[a-z]+\/([a-zA-Z0-9\-._]+\/)?[a-zA-Z0-9\-._]+(@[a-zA-Z0-9\-._+]+)?(\?.*)?$/;
  return pattern.test(purl);
}

export { validateCPE23 } from './productUtils';
