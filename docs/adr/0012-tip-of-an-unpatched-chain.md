# ADR-0012: The root event is the tip of a chain with no patches

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.6.1 |
| **Rules** | RC-5, OV state `clean` |

## Context

An overlay is `clean` when its target is the tip of the canonical chain. If the tip is defined as "the last patch", a root that was never patched has no tip, and the first overlay on any new Product would be `stale`. That claims the chain has advanced past a target it has not advanced past, in the most common case.

## Decision

The tip is the last event in the canonical chain: the last patch where the chain has patches, and the root event itself where it has none. A chain with no patches is not a chain without a tip. While an unresolved self-fork leaves the chain undefined, the tip is undefined too.

## Consequences

A consumer that reads the tip as "the last patch" misclassifies every overlay on an unpatched root as `stale`. The same reading also affects the `resolved` outcome of chain application, whose tip is the root event for a chain with no patches.
