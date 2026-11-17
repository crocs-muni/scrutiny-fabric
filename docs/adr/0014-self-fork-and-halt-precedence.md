# ADR-0014: Self-fork and HALT precedence; deleting a sibling

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.6.1, 0.9.0 |
| **Rules** | SF-5, SF-7 |

## Context

A self-fork and a HALT are independent freeze conditions, and both can be live in one chain. Implementations that order them differently return different canonical bytes for the same event set. A fork can also be resolved in several ways, and the author needs to know which deletion works.

## Decision

- The canonical bytes freeze at whichever point is earlier in chain order. A self-fork upstream of a HALT freezes at the shared parent, and nothing downstream of it is evaluated, including the patch that would have halted. A HALT upstream of a fork freezes at the last applied patch, and the fork is still surfaced.
- An implementation does not apply any patch past a HALT to reach a downstream fork parent. H1 admits no exception, and doing so would return different bytes than an implementation that did not.
- Resolution is deleting one sibling, that is, a patch that replies directly to the shared parent. The cascade removes that sibling's whole subtree. Deleting a patch below a sibling removes only that patch and its descendants and leaves the fork in place. Deleting the shared parent or an ancestor removes both siblings.

## Consequences

SF-3 and H2 still surface every condition found, so a fork downstream of a HALT is reported although it did not determine the content.
