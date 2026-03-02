import { describe, expect, it } from 'vitest';
import { createScrutinyEngine, ScrutinyEngine } from '../src/engine/index.js';
import { CURRENT_VERSION_TAG, eventId, pubkey } from '../src/types/index.js';
import { makeEvent } from './fixtures.js';

describe('ScrutinyEngine', () => {
    it('instantiates with default configuration when no overrides provided', () => {
        const engine = createScrutinyEngine();

        expect(engine.config.trust.maxTrustHops).toBe(1);
        expect(engine.config.validation.maxTags).toBe(1000);
        expect(engine.config.graph.maxTraversalDepth).toBe(10);
    });

    it('deep merges partial overrides', () => {
        const mk = pubkey('a'.repeat(64));
        const engine = createScrutinyEngine({
            trust: { trustedPubkeys: new Set([mk]), maxTrustHops: 5 },
            validation: { strictIdentifiers: false },
            // Leaves `graph` completely untouched
        });

        expect(engine.config.trust.maxTrustHops).toBe(5);
        expect(engine.config.trust.minEndorsements).toBe(1); // from default
        expect(engine.config.trust.trustedPubkeys.has(mk)).toBe(true);

        expect(engine.config.validation.strictIdentifiers).toBe(false);
        expect(engine.config.validation.maxTags).toBe(1000); // from default

        expect(engine.config.graph.maxTraversalDepth).toBe(10); // from default
    });

    describe('encapsulated operations', () => {
        const rootKey = pubkey('a'.repeat(64));
        const engine = new ScrutinyEngine({
            trust: { trustedPubkeys: new Set([rootKey]), maxTrustHops: 0 },
            validation: { strictIdentifiers: false },
        });

        it('validates events using the bound ValidationConfig (strictIdentifiers: false)', () => {
            // Using uppercase CPE which would fail strict validation
            const event = makeEvent({
                tags: [['t', 'scrutiny_fabric'], ['t', 'scrutiny_product'], ['i', 'CPE:2.3:h:infineon']]
            });

            // Because engine was configured with strictIdentifiers: false, it passes!
            const result = engine.validateEvent(event);
            expect(result.ok).toBe(true);
        });

        it('evaluates trust boundaries using the bound TrustConfig (0-hop)', () => {
            const target = makeEvent({ id: eventId('1'.repeat(64)), pubkey: pubkey('b'.repeat(64)) });
            const binding = makeEvent({
                pubkey: rootKey,
                tags: [['t', 'scrutiny_binding'], ['e', target.id, '', 'root'], ['q', '2'.repeat(64)]],
            });

            // Even though rootKey binds it, engine is configured with maxTrustHops=0
            expect(engine.isAdmitted(target, [binding])).toBe(false);
        });
    });
});
