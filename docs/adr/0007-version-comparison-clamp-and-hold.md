# ADR-0007: Digit-string version comparison, T2 clamp and UR-4 hold

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.7.1 and 0.8.0 |
| **Former record** | DECISIONS S8 |

## Context

A batch of spec feedback (F15, F16, F17) came from live reproductions on the reference implementation.

- F15: VER-1 said "parse as numbers", which collapses distinct tags past 2^53 on hosts whose widest integer is a double.
- F16: a root-author patch whose `e reply` parent is unobserved while its root is observed was covered by no rule. The reference implementation had chosen to include it optimistically in the chain.
- F17: a pure-insertion hunk whose header position lies outside the content had three defensible readings: clamp one way, clamp another way, or HALT.

## Decision

- **F15** restates the existing order. Fields compare as digit strings (ADR-0010).
- **F16** is resolved by holding the patch (UR-4), the treatment UR-2 gives a patch with an unobserved root. Including it optimistically would claim a contiguity the observed set cannot support, and two children of one missing parent would trigger SF-1 and freeze the canonical bytes for a fork that may disappear when the parent arrives. Holding adds the least machinery and leaves CHN-1 unchanged.
- **F17** is resolved by clamping to the content's line range, in one sentence of T2, with the bound defined in content terms (ADR-0013).

## Consequences

F15 and F17 are clarifications and shipped as 0.7.1. UR-4 makes an optimistic consumer's interim chain state non-conformant, which is a behavior change, so it shipped as 0.8.0. The vendored vectors in the tools repository needed re-pinning twice.
