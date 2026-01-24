import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  categorizeEvents,
  mapRelationships,
  deduplicateEvents,
  extractETags,
  type CategorizedEvents,
  type Relationships,
} from '@/lib/scrutiny';
import { useAppContext } from '@/hooks/useAppContext';

interface ScrutinyData {
  categorized: CategorizedEvents;
  relationships: Relationships;
  allEvents: NostrEvent[];
}

export function useScrutinyEvents() {
  const { nostr } = useNostr();
  const { config } = useAppContext();

  return useQuery({
    queryKey: ['scrutiny-events', config.relayUrl],
    queryFn: async (c) => {
      console.log('🔄 Starting SCRUTINY events fetch from', config.relayUrl);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(30000)]);

      const relay = nostr.relay(config.relayUrl);

      // Phase 1: Query all SCRUTINY tagged events
      console.log('📡 Phase 1: Querying all SCRUTINY tagged events...');
      const phase1Events = await relay.query(
        [
          {
            kinds: [1],
            '#t': [
              'scrutiny_fabric',
              '#scrutiny_fabric',
              'scrutiny_fabric_v01',
              '#scrutiny_fabric_v01',

              // Legacy namespace (backwards compatibility)
              'scrutiny_mo',
              '#scrutiny_mo',
              'scrutiny_mo_v01',
              '#scrutiny_mo_v01',
              'scrutiny-mo',
              '#scrutiny-mo',
              'scrutiny-mo-v0',
              '#scrutiny-mo-v0',

              'scrutiny_binding',
              '#scrutiny_binding',
              'scrutiny_binding_v01',
              '#scrutiny_binding_v01',
              'scrutiny-binding',
              '#scrutiny-binding',
              'scrutiny-binding-v0',
              '#scrutiny-binding-v0',
              'scrutiny_product',
              '#scrutiny_product',
              'scrutiny_product_v01',
              '#scrutiny_product_v01',
              'scrutiny-product',
              '#scrutiny-product',
              'scrutiny-product-v0',
              '#scrutiny-product-v0',
              'scrutiny_metadata',
              '#scrutiny_metadata',
              'scrutiny_metadata_v01',
              '#scrutiny_metadata_v01',
              'scrutiny-metadata',
              '#scrutiny-metadata',
              'scrutiny-metadata-v0',
              '#scrutiny-metadata-v0',
              'scrutiny_update',
              '#scrutiny_update',
              'scrutiny_update_v01',
              '#scrutiny_update_v01',
              'scrutiny-update',
              '#scrutiny-update',
              'scrutiny-update-v0',
              '#scrutiny-update-v0',
              'scrutiny_contestation',
              '#scrutiny_contestation',
              'scrutiny_contestation_v01',
              '#scrutiny_contestation_v01',
              'scrutiny-contestation',
              '#scrutiny-contestation',
              'scrutiny-contestation-v0',
              '#scrutiny-contestation-v0',
              'scrutiny_confirmation',
              '#scrutiny_confirmation',
              'scrutiny_confirmation_v01',
              '#scrutiny_confirmation_v01',
              'scrutiny-confirmation',
              '#scrutiny-confirmation',
              'scrutiny-confirmation-v0',
              '#scrutiny-confirmation-v0',

              // Demo variants (with _demo suffix)
              'scrutiny_fabric_demo',
              '#scrutiny_fabric_demo',
              'scrutiny_binding_demo',
              '#scrutiny_binding_demo',
              'scrutiny_product_demo',
              '#scrutiny_product_demo',
              'scrutiny_metadata_demo',
              '#scrutiny_metadata_demo',
              'scrutiny_update_demo',
              '#scrutiny_update_demo',
              'scrutiny_contestation_demo',
              '#scrutiny_contestation_demo',
              'scrutiny_confirmation_demo',
              '#scrutiny_confirmation_demo',
              'scrutiny_v02_demo',
              '#scrutiny_v02_demo',
            ],
          },
        ],
        { signal }
      );

      console.log(`✅ Phase 1: Fetched ${phase1Events.length} SCRUTINY events`);

      // Categorize phase 1 events
      const phase1Categorized = categorizeEvents(phase1Events);
      console.log('📊 Phase 1 categorization:', {
        bindings: phase1Categorized.bindings.size,
        products: phase1Categorized.products.size,
        metadata: phase1Categorized.metadata.size,
        updates: phase1Categorized.updates.size,
        confirmations: phase1Categorized.confirmations.size,
        contestations: phase1Categorized.contestations.size,
      });

      // Extract ALL e-tag mentions from bindings to fetch referenced products/metadata
      console.log('📡 Phase 1.5: Extracting e-tag mentions from bindings...');
      const mentionedEventIds = new Set<string>();

      for (const binding of phase1Categorized.bindings.values()) {
        const mentions = extractETags(binding, 'mention');
        mentions.forEach(id => mentionedEventIds.add(id));
      }

      console.log(`📋 Found ${mentionedEventIds.size} mentioned event IDs from bindings`);

      // Query for mentioned events that we don't already have
      const missingIds = Array.from(mentionedEventIds).filter(
        id => !phase1Categorized.products.has(id) && !phase1Categorized.metadata.has(id)
      );

      console.log(`🔍 Need to fetch ${missingIds.length} missing referenced events`);

      let mentionedEvents: NostrEvent[] = [];
      if (missingIds.length > 0) {
        // Split into chunks of 100 IDs to avoid query limits
        const chunkSize = 100;
        for (let i = 0; i < missingIds.length; i += chunkSize) {
          const chunk = missingIds.slice(i, i + chunkSize);
          const chunkEvents = await relay.query(
            [
              {
                kinds: [1],
                ids: chunk,
              },
            ],
            { signal }
          );
          mentionedEvents = [...mentionedEvents, ...chunkEvents];
        }
        console.log(`✅ Fetched ${mentionedEvents.length} mentioned events`);
      }

      // Phase 2: Query events that reference products/metadata/bindings
      const allProductIds = Array.from(phase1Categorized.products.keys());
      const allMetadataIds = Array.from(phase1Categorized.metadata.keys());
      const allBindingIds = Array.from(phase1Categorized.bindings.keys());

      console.log('📡 Phase 2: Querying events that reference products/metadata/bindings...');
      const referencedEventIds = [...allProductIds, ...allMetadataIds, ...allBindingIds];

      let phase2Events: NostrEvent[] = [];
      if (referencedEventIds.length > 0) {
        phase2Events = await relay.query(
          [
            {
              kinds: [1],
              '#e': referencedEventIds,
            },
          ],
          { signal }
        );
        console.log(`✅ Phase 2: Fetched ${phase2Events.length} referencing events`);
      }

      // Phase 3: Extract alternative metadata IDs from contestations and fetch them
      const contestationAlternativeIds: string[] = [];
      for (const contestations of phase1Categorized.contestations.values()) {
        for (const contestation of contestations) {
          const alternativeIds = extractETags(contestation, 'mention');
          contestationAlternativeIds.push(...alternativeIds);
        }
      }

      let phase3Events: NostrEvent[] = [];
      if (contestationAlternativeIds.length > 0) {
        console.log('📡 Phase 3: Fetching alternative metadata events...');
        phase3Events = await relay.query(
          [
            {
              kinds: [1],
              ids: contestationAlternativeIds,
            },
          ],
          { signal }
        );
        console.log(`✅ Phase 3: Fetched ${phase3Events.length} alternative metadata events`);
      }

      // Combine and deduplicate all events
      const allEvents = [...phase1Events, ...mentionedEvents, ...phase2Events, ...phase3Events];
      const uniqueEvents = deduplicateEvents(allEvents);
      console.log(`🔄 Total unique events after deduplication: ${uniqueEvents.length}`);

      // Final categorization
      const categorized = categorizeEvents(uniqueEvents);
      console.log('📊 Final categorization:', {
        bindings: categorized.bindings.size,
        products: categorized.products.size,
        metadata: categorized.metadata.size,
        updates: categorized.updates.size,
        confirmations: categorized.confirmations.size,
        contestations: categorized.contestations.size,
      });

      const relationships = mapRelationships(categorized);
      console.log('🔗 Relationship mapping complete');

      const data: ScrutinyData = {
        categorized,
        relationships,
        allEvents: uniqueEvents,
      };

      console.log('✨ SCRUTINY data fetch complete!');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
