# ADR-0015: Ingestion is confluent; unobserved references are held

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.8.0, 0.9.0 |
| **Rules** | UR-1 to UR-4, BD-6, BD-7, SUP-1, DEL-8 |

## Context

On a relay mesh, an event can be observed before the events it names. An implementation could discard it, include it approximately, or hold it. If the state an implementation reaches depends on arrival order, two clients with the same event set disagree.

## Decision

Ingestion is confluent: the state depends only on the set of observed events. An event that refers to something unobserved is retained and re-evaluated when the target arrives. It appears in four places with one shape: a pending Binding, a held Patch, a held `supersedes` marker and a deletion request waiting for its target. No state beyond pending and held is required.

A classification is cached as permanent only when no further observation could change it. A Binding's endpoint typing cannot change once the endpoint is observed, so BD-7 may cache its rejection. A Patch's authorship class can change when its root arrives, so it is not cached while the root is unobserved (UR-3).

A root-author patch whose `e reply` target is unobserved takes no chain position (UR-4), for the reasons given in ADR-0007: counting it would claim an unsupported contiguity, and two such patches with one missing parent would look like a fork that may disappear.

## Consequences

The conformance vectors state the requirement as a property of the whole corpus: every `chain` case must give its expectation under every permutation of its events.
