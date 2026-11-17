# ADR-0012: The root event is the tip of a chain with no patches

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.6.1 |
| **Rules** | RC-5, OV state `clean` |

## Context

An overlay is `clean` when its target is the tip of the canonical chain. If the tip is defined as "the last patch", a root that was never patched has no tip, and the first overlay on any new Product would be `stale`. That claims the chain has advanced past a target it has not advanced past, in the most common case.

## Decision

The tip is the last event of the applied chain: the root event where the chain has no patches, otherwise the last successfully applied patch. A chain with no patches is not a chain without a tip. The tip is undefined while an unresolved self-fork or a ceiling is the earlier freeze point (RC-5, OV-10).

## Consequences

A consumer that reads the tip as "the last patch" misclassifies every overlay on an unpatched root as `stale`. The same reading also affects the `resolved` outcome of chain application, whose tip is the root event for a chain with no patches.
