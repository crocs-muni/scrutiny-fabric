import type { EventId, NostrEvent, Pubkey, TrustConfig } from '../types/index.js';
import { extractBindingEndpoints } from '../parse/index.js';

// ---------------------------------------------------------------------------
// Admission (spec §7)
// ---------------------------------------------------------------------------

/**
 * Determine whether an event should be admitted to the client's view based on 
 * an N-hop Web of Trust algorithm.
 *
 * An event is admitted if:
 * 1. It is authored directly by a pubkey in `trustedPubkeys` (0-hop), **or**
 * 2. It is connected to a trusted pubkey via a path of `BindingEvents` no 
 *    longer than `maxTrustHops`.
 *
 * @param event           — The event to check.
 * @param config          — Trust configuration (set of root pubkeys, max hops).
 * @param trustedBindings — A pool of locally known, previously verified bindings.
 */
export const isAdmitted = (
    event: NostrEvent,
    config: TrustConfig,
    trustedBindings: readonly NostrEvent[],
): boolean => {
    // 0-hop: Direct author trust
    if (config.trustedPubkeys.has(event.pubkey)) return true;
    if (config.maxTrustHops === 0) return false;

    const targetId = event.id as string;

    // Build an adjacency map from the pool of bindings that trace back to a trusted pubkey.
    // We only care about bindings authored by someone in the web of trust, but evaluating
    // full recursive trust paths for *other* authors is complex. For simplicity, we assume
    // the `trustedBindings` array *already* contains only bindings we consider valid, OR
    // we strictly evaluate trust hops originating from the root `trustedPubkeys`.
    //
    // The spec focuses on "connected via a trusted binding".
    // A path is: Root Pubkey -> Binding -> Target ID
    //        or: Root Pubkey -> Binding -> ID -> Binding -> Target ID (if maxTrustHops > 1)

    // 1-hop optimization (classic fast path)
    if (config.maxTrustHops === 1) {
        for (const binding of trustedBindings) {
            if (!config.trustedPubkeys.has(binding.pubkey)) continue;
            const endpoints = extractBindingEndpoints(binding);
            if (!endpoints) continue;
            if (
                (endpoints.anchorEventId as string) === targetId ||
                (endpoints.otherEventId as string) === targetId
            ) {
                return true;
            }
        }
        return false;
    }

    // N-hop BFS
    // For n-hops, we treat `trustedPubkeys` as the seed roots. The graph nodes are Event IDs.
    // Edges are BindingEvents authored by `trustedPubkeys`.
    // Strictly speaking, full WoT would mean delegating trust through profile follows, 
    // but the SCRUTINY spec scopes trust edges exclusively to BindingEvents.

    // Build bidirectional adjacency list from bindings authored by trusted root keys.
    const adjacency = new Map<string, string[]>();
    for (const binding of trustedBindings) {
        if (!config.trustedPubkeys.has(binding.pubkey)) continue;
        const endpoints = extractBindingEndpoints(binding);
        if (!endpoints) continue;

        const a = endpoints.anchorEventId as string;
        const b = endpoints.otherEventId as string;

        const curA = adjacency.get(a) ?? [];
        curA.push(b);
        adjacency.set(a, curA);

        const curB = adjacency.get(b) ?? [];
        curB.push(a);
        adjacency.set(b, curB);
    }

    // Since we don't start at a single event, we start BFS backwards from the TargetID.
    // If we can reach any event ID that is authored by a `trustedPubkey` within `maxTrustHops`, it's admitted.
    // However, since we don't know the authors of all intermediate nodes, a simpler equivalent 
    // is to check if the target is in the connected component constructed strictly from trusted bindings.
    // Note: If `trustedBindings` only contains bindings from `trustedPubkeys`, then ANY path through this
    // adjacency map implies traversing a trusted binding.

    const visited = new Set<string>([targetId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: targetId, depth: 0 }];

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Since the edges in `adjacency` are exclusively Trusted Bindings,
        // if the target is connected to *any* edge here within maxTrustHops, it meets the rule.
        // The spec phrasing "connected via a trusted binding" for 1-hop generalizes to
        // "reachable via a chain of trusted bindings of length <= maxTrustHops".
        if (current.depth > 0 && current.depth <= config.maxTrustHops) {
            // We successfully traversed at least 1 trusted binding to get here,
            // which means the target is connected to the trusted graph.
            return true;
        }

        if (current.depth >= config.maxTrustHops) continue;

        const neighbors = adjacency.get(current.id) ?? [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ id: neighbor, depth: current.depth + 1 });
            }
        }
    }

    return false;
};

// ---------------------------------------------------------------------------
// Trusted retraction check
// ---------------------------------------------------------------------------

/**
 * Check whether an event has been retracted by a trusted pubkey.
 *
 * Per spec §6 step 4: a BindingEvent can be retracted by a user-trusted
 * retraction, not just by the original author.
 *
 * @param targetId    — The ID of the event to check.
 * @param retractions — Candidate retraction events.
 * @param config      — Trust configuration.
 */
export const hasTrustedRetraction = (
    targetId: EventId,
    retractions: readonly NostrEvent[],
    config: TrustConfig,
): boolean => {
    for (const r of retractions) {
        if (!config.trustedPubkeys.has(r.pubkey)) continue;
        const roots = r.tags.filter((tag) => tag[0] === 'e' && tag[3] === 'root');
        if (roots.length === 1 && roots[0][1] === (targetId as string)) {
            return true;
        }
    }
    return false;
};
