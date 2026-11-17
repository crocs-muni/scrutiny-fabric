# ADR-0013: Position of a pure-insertion hunk

| | |
|---|---|
| **Status** | Accepted; extended in 0.9.2 |
| **Spec release** | 0.5.x (carve-out), 0.7.1 (clamp) |
| **Rules** | T1, T2, T3, C6 |

## Context

A hunk with no context lines and no removed lines has no pattern to disambiguate, so T1's uniqueness check cannot apply. Its only guide is the `-` line number in its `@@` header. Two questions follow: in which coordinates is that number read, and what happens when it lies outside the content?

## Decision

- The line number is read in the coordinates of the patch's pre-application content and is carried forward by the net line delta of all earlier hunks in the same patch. Without the carry-forward, T2 and T3 designate different positions as soon as an earlier hunk has added or removed lines, and the patch silently produces wrong content. `git apply` and jsdiff both carry forward.
- A position outside the content's line range clamps: past the last line it inserts after the final line, before the first it inserts at the start. Clamping defines a position and is not a failed match, so it never reaches T1 or H1.
- An insertion positioned after, or clamped to follow, a final line that has no terminator HALTs (H1), a disposition added in 0.9.0 (ADR-0009).
- T1 does not use the `@@` line numbers to disambiguate a match. `git apply` and jsdiff treat those numbers as advisory and relocate hunks by context match, so an implementation may use them only as a hint for the initial search position and verifies uniqueness across the full content.
- The line count is the count of the content's own lines. A final newline terminates the last line and does not add one, so `a\nb\n` has two lines, and `@@ -3,0 +3,1 @@` against it appends after `b`.

## Consequences

HALT was rejected: it freezes the whole chain over a coordinate that C6 calls advisory, while a pure-insertion hunk asserts nothing about existing content that clamping could falsify. The reference implementation clamped but used a sentinel-inclusive length, which produced a phantom blank line and dropped the final newline under a clean verdict. The third bullet exists because of that bug.
