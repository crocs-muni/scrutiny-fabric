import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, finalizeEvent, matchFilter } from 'nostr-tools';
import {
    buildProductEvent,
    buildMetadataEvent,
    buildBindingEvent,
    buildMetadataBindingsFilter,
    buildProductBindingsFilter,
} from '../src/index.js';

describe('Integration & NIP-01 Filter Matching Tests', () => {

    it('correctly matches generated BindingEvents against our NIP-01 query filters using reference Nostr logic', () => {
        const sk = generateSecretKey();
        const pk = getPublicKey(sk);

        // 1. Build a Product Event
        const pTmpl = buildProductEvent({ content: 'Product 1', identifiers: ['cpe:foo'] });
        const pEvt = finalizeEvent({ ...pTmpl, created_at: Math.floor(Date.now() / 1000), tags: Array.from(pTmpl.tags) as string[][] }, sk);

        // 2. Build a Metadata Event
        const mTmpl = buildMetadataEvent({ content: 'Metadata 1' });
        const mEvt = finalizeEvent({ ...mTmpl, created_at: Math.floor(Date.now() / 1000), tags: Array.from(mTmpl.tags) as string[][] }, sk);

        // 3. Build a Binding Event linking them (q=Metadata, e root=Product)
        const bTmpl = buildBindingEvent({
            content: 'Links metadata to product',
            anchor: { eventId: pEvt.id as string, pubkeyHint: pEvt.pubkey },
            other: { eventId: mEvt.id as string, pubkeyHint: mEvt.pubkey },
            relationship: 'vulnerability'
        });
        const bEvt = finalizeEvent({ ...bTmpl, created_at: Math.floor(Date.now() / 1000), tags: Array.from(bTmpl.tags) as string[][] }, sk);

        // 4. Test Metadata-First Traversal filter (#q array lookup)
        const metadataFilter = buildMetadataBindingsFilter(mEvt.id);

        // Use nostr-tools mathematically correct reference NIP-01 filter matcher
        const matchesMetadata = matchFilter(metadataFilter as any, bEvt);
        expect(matchesMetadata).toBe(true);

        const missesMetadata = matchFilter(metadataFilter as any, pEvt);
        expect(missesMetadata).toBe(false);

        // 5. Test Product-First Traversal filter (#e root array lookup)
        const productFilter = buildProductBindingsFilter(pEvt.id);

        const matchesProduct = matchFilter(productFilter as any, bEvt);
        expect(matchesProduct).toBe(true);

        const missesProduct = matchFilter(productFilter as any, mEvt);
        expect(missesProduct).toBe(false);
    });
});
