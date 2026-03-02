import type { ScrutinyConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/index.js';
import type { NostrEvent, TrustConfig, ValidationConfig, GraphConfig } from '../types/index.js';
import { isAdmitted, hasTrustedRetraction } from '../trust/index.js';
import { validateEvent } from '../validate/index.js';
import { traverseGraph, buildRelationshipEdges, buildAdjacency } from '../graph/index.js';
import { computeEffectiveView } from '../effective-view/index.js';

/**
 * A centralized, stateful wrapper for the SCRUTINY Fabric protocol utilities.
 *
 * This engine allows consumers to define their security, WoT, and validation
 * thresholds exactly once at instantiation, and provides a surface of methods
 * automatically bound to that configuration.
 */
export class ScrutinyEngine {
    public readonly config: ScrutinyConfig;

    /**
     * Initialize a new ScrutinyEngine.
     * If a partial configuration is provided, it is deeply merged with the
     * protocol's default safe settings (`DEFAULT_CONFIG`).
     */
    constructor(configOverrides?: {
        trust?: Partial<TrustConfig>;
        validation?: Partial<ValidationConfig>;
        graph?: Partial<GraphConfig>;
    }) {
        this.config = {
            trust: { ...DEFAULT_CONFIG.trust, ...configOverrides?.trust },
            validation: { ...DEFAULT_CONFIG.validation, ...configOverrides?.validation },
            graph: { ...DEFAULT_CONFIG.graph, ...configOverrides?.graph },
        };
    }

    // ---------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------

    /**
     * Execute full protocol validation against a candidate event.
     */
    public validateEvent(event: NostrEvent) {
        return validateEvent(event, this.config.validation);
    }

    // ---------------------------------------------------------------------------
    // Trust (Admission)
    // ---------------------------------------------------------------------------

    /**
     * Determine whether an event is admitted to the client's view using the
     * N-hop Web of Trust parameters established during Engine creation.
     *
     * @param event The event in question.
     * @param trustedBindings A pool of BindingEvents currently known to the client.
     */
    public isAdmitted(event: NostrEvent, trustedBindings: readonly NostrEvent[]): boolean {
        return isAdmitted(event, this.config.trust, trustedBindings);
    }

    // ---------------------------------------------------------------------------
    // State Computation
    // ---------------------------------------------------------------------------

    /**
     * Compute the Effective View of a root event, projecting the sum of its
     * authoritative updates and verifying retractions against the WoT.
     */
    public computeEffectiveView(params: {
        target: NostrEvent;
        updates: readonly NostrEvent[];
        retractions: readonly NostrEvent[];
    }) {
        return computeEffectiveView({
            ...params,
            trustedPubkeys: this.config.trust.trustedPubkeys,
        });
    }

    // ---------------------------------------------------------------------------
    // Graph Traversal
    // ---------------------------------------------------------------------------

    /**
     * Build an adjacency map from a pool of BindingEvents, then execute a BFS
     * traversal starting at `seedId`. The maximum search depth is bound by
     * `config.graph.maxTraversalDepth`.
     *
     * This operates without WoT verification. Typically, `bindingEvents` should
     * only contain events that have already passed `isAdmitted`.
     */
    public traverseGraph(bindingEvents: readonly NostrEvent[], seedId: string) {
        const edges = buildRelationshipEdges(bindingEvents);
        const adjacency = buildAdjacency(edges);
        return traverseGraph(adjacency, seedId, this.config.graph.maxTraversalDepth);
    }
}

/**
 * Factory convenience method for instantiating a `ScrutinyEngine`.
 */
export const createScrutinyEngine = (configOverrides?: {
    trust?: Partial<TrustConfig>;
    validation?: Partial<ValidationConfig>;
    graph?: Partial<GraphConfig>;
}) => {
    return new ScrutinyEngine(configOverrides);
};
