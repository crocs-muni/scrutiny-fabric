# ADR-0017: A Patch's root must be a Product or Metadata event

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.6.2 |
| **Rules** | PT-10, PT-11, UR-2, UR-3 |

## Context

A Binding's endpoints are typed: root is a Product, link is a Metadata event (BD-3 to BD-5). A Patch's `e root` had no type constraint, so a Patch could claim a chain anchored in a Binding, another Patch or a non-Fabric event.

## Decision

The event named by a Patch's `e root` must be a `scrutiny-product` or `scrutiny-metadata` event. A Patch whose observed root violates this is invalid and rejected, the same shape as a Binding's endpoint typing.

The rule is scoped to the observed case. While the root is unobserved, UR-2 holds the Patch, and UR-3 forbids caching its authorship class. Once the root is observed, the classification cannot change, because the root's own type is immutable, so a cached rejection follows from UR-3 as written. The two partition the cases the way BD-6 and BD-7 do for Bindings. No separate caching rule is needed.

## Consequences

Chain resolution can assume that every observed root is a Product or Metadata event.
