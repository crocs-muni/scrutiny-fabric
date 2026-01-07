import { useCallback, useEffect, useRef, useState } from 'react';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  determineEventType,
  extractETags,
  type EventType,
  type ScrutinyEvent,
} from '@/lib/scrutiny';
import { useAppContext } from '@/hooks/useAppContext';

const FETCH_TIMEOUT = 15000;
const ID_CHUNK_SIZE = 100;

const BINDING_TAGS = [
  'scrutiny_binding',
  '#scrutiny_binding',
  'scrutiny_binding_v01',
  '#scrutiny_binding_v01',
];

const UPDATE_TAGS = [
  'scrutiny_update',
  '#scrutiny_update',
  'scrutiny_update_v01',
  '#scrutiny_update_v01',
];

const CONFIRMATION_TAGS = [
  'scrutiny_confirmation',
  '#scrutiny_confirmation',
  'scrutiny_confirmation_v01',
  '#scrutiny_confirmation_v01',
];

const CONTESTATION_TAGS = [
  'scrutiny_contestation',
  '#scrutiny_contestation',
  'scrutiny_contestation_v01',
  '#scrutiny_contestation_v01',
];

interface BindingCounts {
  productCount: number;
  metadataCount: number;
  confirmationCount: number;
  contestationCount: number;
  hasUpdate: boolean;
}

export interface BindingWithStats extends BindingCounts {
  binding: ScrutinyEvent;
}

export interface UseEventWithBindingsResult {
  event: NostrEvent | undefined;
  bindings: BindingWithStats[];
  isProduct: boolean;
  isMetadata: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (items.length <= size) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const getEventIdsByRole = (event: NostrEvent, role?: string): string[] => {
  return event.tags
    .filter(tag => tag[0] === 'e' && (role ? tag[3] === role : true))
    .map(tag => tag[1]);
};

const increment = (map: Map<string, number>, key: string) => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

export function useEventWithBindings(eventId: string | null): UseEventWithBindingsResult {
  const { nostr } = useNostr();
  const { config } = useAppContext();

  const [event, setEvent] = useState<NostrEvent | undefined>();
  const [bindings, setBindings] = useState<BindingWithStats[]>([]);
  const [isProduct, setIsProduct] = useState(false);
  const [isMetadata, setIsMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!eventId) {
      if (!isMountedRef.current) {
        return;
      }
      setEvent(undefined);
      setBindings([]);
      setIsProduct(false);
      setIsMetadata(false);
      setIsLoading(false);
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const relay = nostr.relay(config.relayUrl);

      const [fetchedEvent] = await relay.query(
        [
          {
            kinds: [1],
            ids: [eventId],
          },
        ],
        { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
      );

      if (!fetchedEvent) {
        throw new Error('Event not found');
      }

      const eventType = determineEventType(fetchedEvent.tags);
      if (eventType !== 'product' && eventType !== 'metadata') {
        throw new Error(`Event is not a product or metadata (type: ${eventType})`);
      }

      const bindingEvents = await relay.query(
        [
          {
            kinds: [1],
            '#e': [eventId],
            '#t': BINDING_TAGS,
          },
        ],
        { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
      );

      const validBindings = bindingEvents.filter(binding => determineEventType(binding.tags) === 'binding');

      const bindingIdSet = new Set(validBindings.map(b => b.id));
      const bindingIdChunks = chunkArray(Array.from(bindingIdSet), ID_CHUNK_SIZE);

      const mentionTypeMap = new Map<string, EventType>();
      mentionTypeMap.set(fetchedEvent.id, eventType);

      const mentionIdSet = new Set<string>();
      for (const binding of validBindings) {
        const mentions = extractETags(binding, 'mention');
        mentions.forEach(id => mentionIdSet.add(id));
      }
      mentionIdSet.delete('');
      mentionIdSet.delete(eventId);

      // Fetch referenced events to determine types for counting
      if (mentionIdSet.size > 0) {
        const mentionChunks = chunkArray(Array.from(mentionIdSet), ID_CHUNK_SIZE);
        for (const chunk of mentionChunks) {
          const referencedEvents = await relay.query(
            [
              {
                kinds: [1],
                ids: chunk,
              },
            ],
            { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
          );
          for (const refEvent of referencedEvents) {
            const refType = determineEventType(refEvent.tags);
            mentionTypeMap.set(refEvent.id, refType);
          }
        }
      }

      const updateCounts = new Map<string, number>();
      const confirmationCounts = new Map<string, number>();
      const contestationCounts = new Map<string, number>();

      const collectReplyCounts = async (
        tagVariants: string[],
        targetType: 'update' | 'confirmation' | 'contestation',
        resultMap: Map<string, number>
      ) => {
        if (bindingIdSet.size === 0) {
          return;
        }
        for (const chunk of bindingIdChunks) {
          const replyEvents = await relay.query(
            [
              {
                kinds: [1],
                '#e': chunk,
                '#t': tagVariants,
              },
            ],
            { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
          );

          for (const reply of replyEvents) {
            const replyType = determineEventType(reply.tags);
            if (replyType !== targetType) {
              continue;
            }
            const rootTargets = getEventIdsByRole(reply, 'root');
            const allTargets = rootTargets.length > 0 ? rootTargets : getEventIdsByRole(reply);
            for (const targetId of allTargets) {
              if (bindingIdSet.has(targetId)) {
                increment(resultMap, targetId);
              }
            }
          }
        }
      };

      await collectReplyCounts(UPDATE_TAGS, 'update', updateCounts);
      await collectReplyCounts(CONFIRMATION_TAGS, 'confirmation', confirmationCounts);
      await collectReplyCounts(CONTESTATION_TAGS, 'contestation', contestationCounts);

      const bindingDetails: BindingWithStats[] = validBindings.map(bindingEvent => {
        const mentionTags = extractETags(bindingEvent, 'mention');
        const mentions = mentionTags.length > 0 ? mentionTags : getEventIdsByRole(bindingEvent);

        let productCount = 0;
        let metadataCount = 0;

        for (const mentionId of mentions) {
          const mentionType = mentionTypeMap.get(mentionId);
          if (mentionType === 'product') {
            productCount += 1;
          } else if (mentionType === 'metadata') {
            metadataCount += 1;
          } else if (mentionId === fetchedEvent.id) {
            if (eventType === 'product') {
              productCount += 1;
            } else {
              metadataCount += 1;
            }
          } else {
            metadataCount += 1;
          }
        }

        const binding: ScrutinyEvent = {
          ...bindingEvent,
          eventType: 'binding',
        };

        return {
          binding,
          productCount,
          metadataCount,
          confirmationCount: confirmationCounts.get(binding.id) ?? 0,
          contestationCount: contestationCounts.get(binding.id) ?? 0,
          hasUpdate: (updateCounts.get(binding.id) ?? 0) > 0,
        };
      });

      if (!isMountedRef.current) {
        return;
      }

      setEvent(fetchedEvent);
      setBindings(bindingDetails);
      setIsProduct(eventType === 'product');
      setIsMetadata(eventType === 'metadata');
      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (!isMountedRef.current) {
        return;
      }
      setError(error);
      setEvent(undefined);
      setBindings([]);
      setIsProduct(false);
      setIsMetadata(false);
      setIsLoading(false);
    }
  }, [config.relayUrl, eventId, nostr]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await fetchData();
    };
    if (active) {
      run();
    }
    return () => {
      active = false;
    };
  }, [fetchData]);

  return {
    event,
    bindings,
    isProduct,
    isMetadata,
    isLoading,
    error,
    refetch: fetchData,
  };
}
