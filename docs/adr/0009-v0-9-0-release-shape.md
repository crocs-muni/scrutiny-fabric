# ADR-0009: One release for every change to rule wording; layers stay three; `supersedes`

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.9.0 |
| **Former record** | DECISIONS S10 |

## Context

Eight open issues (F19 to F26), the V-layer note (#36) and a vocabulary clean-up all change rule text. A planned restructure of the specification should be checkable as non-normative.

## Decision

- **One release.** Releasing all rule-wording changes together lets the restructure that follows (0.9.1) be checked by a rule census: same IDs, layers, inheritance and text.
- **Layers stay three.** A fourth layer for producer obligations was considered and rejected. After producer rules moved out of V in 0.6.1, TAG-4 was the only misfit, and moving it to D removes the contradiction with TAG-5. A new layer would touch about a dozen rules, the vector metadata and the tools library for no change in behavior (ADR-0011).
- **`supersedes` is ordered by the link graph, not by `created_at`.** The issue proposed resolving to the newest member, which needs the `created_at` ordering that the specification forbids elsewhere (SF-4). The final member of a succession is the one nothing supersedes. Two non-deleted successors fork it and are surfaced, never chosen between. A deleted final member retracts the succession. Successions run over all valid events and trust applies to the result, so a link grants no admission. Nothing attached to a superseded event moves to its replacement: carrying Bindings and overlays across would give a key authority over statements that others signed.
- **Vocabulary.** The vectors use `pending` as a verdict and `annotations` as a field, so those words stay. "Indexer" keeps its meaning for `i` values, and the service sense is "index service".
- **Implementer-test gaps (G1 to G14).** An implementation written from the rule text alone could pass the vectors only by guessing at fourteen points. Where the vectors and the reference library already agreed (counts bound a hunk, the tip under a HALT, overlapping T1 occurrences, a foreign patch awaiting its reply target is pending) the rule now says so. Two choices were not forced by them. A chain stopped by a ceiling has no tip, as RL-5 already implied by refusing the word `resolved`; OV-10 therefore gives such a chain the fork treatment (nothing `clean`, applied targets `stale`, targets past the stop `orphaned`). An `i` value with no colon breaks IR-1 (no prefix), not IR-3, so a NIP-73 style value such as a bare hashtag is V-invalid.
- **Deferred.** Issue #48, a machine-readable prefix vocabulary, needs census evidence from the pilot corpus and ships separately.

## Consequences

The first draft of SUP-1 to SUP-4 had four gaps (kind 5 interaction, an undefined "earlier", no fork-resolution path, no admission rule), found in an independent review. The rules in 0.9.0 are the corrected form.

Where the reference library differs from the amended rules, the rules follow the vectors and the library is the follow-up. The library makes an empty or headerless payload V-invalid (the vector `malformed/empty-fenced-block` expects HALT); it shifts T2's carry-forward by all prior hunks, not only those that end at or before the insertion; it appends after an unterminated final line where T2 now HALTs; it does not check "of the same root" in PT-6 and PT-7; and it reports a tip for a chain stopped by a ceiling. No vector covers the last four.
