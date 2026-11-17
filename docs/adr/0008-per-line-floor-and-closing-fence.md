# ADR-0008: RL-2 per-line floor and E3 closing-fence existence

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.8.1 |
| **Former record** | DECISIONS S9 |

## Context

Two issues: F12 (the work unit of RL-2) and F18 (the wording of E3).

T1's uniqueness scan costs `|content| × |pattern|` element comparisons whatever bytes those elements carry. Measured in bytes compared, a pattern of empty lines runs a full-length scan at a billed cost of zero. E3 said the closing fence must be at least as long as the opening fence, which allows two readings: a constraint on its length when it exists, or a requirement that it exist.

## Decision

- **F12:** keep "bytes compared" as the unit, which implementations can cheaply sum, and add a floor of one unit per line of the hunk's match pattern. This is a SHOULD, not a MUST. RL-2 is a ceiling policy at layer A, local and configurable by design, and OV-4's permitted divergence relies on that locality.
- **F18:** pick the first reading and add no rule. CommonMark §4.5 lets an unclosed block run to the end of the document, and the specification delegates fenced-block parsing to CommonMark. The reference implementation had always treated unclosed blocks as payloads.
- Example version tags in the specification use the template form, so the concrete version appears in a few places that `tools/verify-corpus.mjs` checks.

## Consequences

No vector cites E3 or RL-2, so the corpus is unchanged. The release was a PATCH because neither change alters conformant behavior.
