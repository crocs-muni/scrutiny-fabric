# Spec repo — decision record

Cross-cutting rationale that is not tied to one rule ID lives here. Rationale for why a *specific
rule* reads as it does lives inline in `protocol-spec.md`, next to that rule. Release history is in
[`CHANGELOG.md`](../CHANGELOG.md). This mirrors the reference implementation's own
`scrutiny-fabric-tools/docs/DECISIONS-2026-07-27.md`, one repo behind the other.

---

## S1 — Normative keywords: RFC 2119 + BCP 14 (RFC 8174), not ISO/IEC Directives' shall/should/may

The spec uses MUST / SHOULD / MAY throughout (180+ lines as of v0.6.1) with no boilerplate defining
them. RFC 2119 is what Nostr's own NIPs use; adopting ISO/IEC Directives Part 2's shall/should/may
vocabulary instead would fight the ecosystem the protocol is built on, for no benefit — a reader
moving between a NIP and this spec would meet two incompatible normative vocabularies.

**Not yet executed.** The spec is still missing the standard BCP 14 boilerplate paragraph. Cheapest,
highest-value fix identified and deliberately deferred pending a decision on whether to also add the
Scope / Conformance / Normative References gaps in the same pass (see Open questions below).

## S2 — Licence: MIT retained for the pre-1.0 phase

MIT is a software licence with no patent language, applied to a *specification document* — for a
protocol whose premise is permissionless implementation, this is a real gap, not a formality.
Researched alternative: CC0-1.0 (matching Nostr NIPs' own public-domain practice) paired with a
patent non-assertion statement (OWFa 1.0 Patent-Only, or informal prose if the formal instrument is
too heavy for a single-maintainer stage).

**Decision:** keep MIT for now. Single maintainer, pre-1.0, not yet the point to commit to a
permanent licensing instrument. Revisit before a public 1.0 release or before accepting outside
implementations that would rely on the patent posture.

## S3 — Changelog / rationale / decisions split

The inline changelog had grown to 13% of the spec's total words, and its per-release entry size grew
superlinearly — 24 words/bullet at v0.5.7, 138 words/bullet at v0.6.1 — because it was doing three
jobs at once: release notes, per-rule design rationale, and defect traceability (closing numbered
items from `SPEC-FEEDBACK-v0.6.0.md`). The rationale job was placed badly: ordered by *release*, so
a reader asking "why does T2 work this way?" had to know which release touched T2 first.

**Decision, executed this pass:**
- `CHANGELOG.md` — terse release notes, one entry per version, citing rule IDs.
- Per-rule rationale — stays inline in the spec, next to the rule (already the practice for T2, C5,
  SF-7, RC-5, C7, and the reworded §6.0 preamble).
- This file — cross-cutting rationale not attached to one rule.

## S4 — Versioning: `scrutiny-vMMP` retained

Three digits, MAJOR/MINOR/PATCH, `^scrutiny-v\d{3}$` (VER-1), embedded on every wire event. SemVer's
model doesn't fit a fixed-width protocol-visible field, and neither does CalVer or W3C's dated-URI
scheme — changing the tag format itself would be a breaking change to every implementation. Kept
as-is.

**Superseded by S7 (v0.7.0).** The "changing the format is itself breaking, so don't" reasoning above
turned out to be exactly backwards: not changing the format meant the ordering claim (VER-1) was
already false the moment any field needed two digits, not just at the eventual digit-count wall. F14
retires the `t`-tag scheme this decision kept.

## S5 — Governance / citation / contributing infrastructure deferred

Researched and deliberately not added yet: `CITATION.cff`, `CONTRIBUTING.md`, `GOVERNANCE.md`,
`SECURITY.md`, `CODE_OF_CONDUCT.md`, Zenodo DOI minting, SWHID, SPDX per-file headers, OpenSSF
badge/Scorecard. All are real instruments with a place in this project's eventual maturity; none of
them fit a single-maintainer, pre-1.0 repo where there is no outside contributor to govern, cite, or
disclose to yet.

**Decision:** add none of them this pass either. See S6 for the one item that was planned
(CI validation) and why it didn't land.

## S6 — CI validator deferred: `scrutiny-fabric-tools` is private

The plan was a GitHub Actions workflow in this (public) repo running the existing rule-registry
validator (`scrutiny-fabric-tools/tools/extract-rules.mjs`) against every push and pull request
touching `docs/protocol-spec.md` — turning a check run by hand before every commit into an enforced
gate.

Blocked: `scrutiny-fabric-tools` is **private**, and a workflow in a public repo cannot
`actions/checkout` a private one without a manually-created, manually-stored credential — GitHub's
default per-job token only reaches the repo the workflow runs in.

Three options were identified, none clean without a decision that wasn't this pass's to make:
1. Cross-repo checkout with a fine-grained PAT stored as a repo secret — correct shape, needs a
   manual credential step.
2. Vendor a copy of `extract-rules.mjs` into this repo's own `tools/` — works with no secrets, but
   recreates the exact hand-maintained-duplicate drift that script was generated (not hand-written)
   specifically to avoid.
3. Make `scrutiny-fabric-tools` public.

**Decision:** skip CI for now — `scrutiny-fabric-tools` stays private. Revisit once that changes;
option 3 is the one that also removes the blocker for good rather than working around it.

## S7 — Version-tag scheme retired: unpadded `scrutiny-v<MAJOR>.<MINOR>.<PATCH>` replaces `scrutiny-vMMP` (F13/F14 landing)

S4 kept the three-digit `t`-tag scheme on the reasoning that changing the format was itself a breaking
change to avoid. F13/F14's independent re-verification (`scrutiny-fabric-tools/docs/SPEC-FEEDBACK-
v0.6.0.md`) found the ordering claim (VER-1) was already false the moment any field needed two
digits — not only at the eventual MAJOR=9/MINOR=9 wall D45 first hit. Fixing the ordering claim
without also removing the fixed-width ceiling would just relocate the same defect one release later,
so this pass retires the fixed-width form outright: unpadded decimal integers, no digit-count ceiling
in any field, no dual-path acceptance of the old form.

**Rejected alternative: a dedicated `v` tag.** The amendment initially shipped as a new single-letter
`["v", "<MAJOR>.<MINOR>.<PATCH>"]` tag, on the premise that this followed the same precedent as `i`/`k`
(§3.1). Caught in review before merge: the precedent doesn't hold. `i`/`k` reuse letters an *existing*
NIP (NIP-73) already claims; a new `v` tag would be SCRUTINY unilaterally minting a claim on a
previously-unclaimed letter, backed by no NIP. Checked against the actual registry, not just
recollection: NIP-01 itself reserves only `e`/`p`/`a`; every other single-letter tag in the ecosystem
(`d`, `g`, `i`, `k`, `l`/`L`, `r`, `t`, `u`, `x`, `m`, …) was claimed by precedent, not by a central
reservation process, and a grep of all 99 files in `nostr-protocol/nips` for a literal `["v", ...]` tag
found zero hits — `v` is unclaimed today, but nothing stops another kind:1-based application from
claiming it later, and there is no registry to check against to find out. Worse, the new tag bought
nothing: the stated motivation was `#v` relay-side filtering, but `{"#t": ["scrutiny-v0.7.0"]}`
already gives identical exact-match filtering on the existing `t`-tag value. Reworked to widen the
existing `scrutiny-` `t`-tag's value instead — the fix stays inside a namespace SCRUTINY already owns
by prefix, so no new standardization exposure at all, at the same implementation cost.

**One release or two.** F13 (PT-10/PT-11 — two new V rules, additive, no downstream sweep) landed
alone as v0.6.2. F14 (the breaking wire-format rewrite, whole-document sweep, Appendix G vector
regeneration) landed separately as v0.7.0. Bundling them would have made F13's already-fully-
specified fix wait on F14's much larger scope for no reason.

**Version number: v0.7.0, not v0.6.3 or v1.0.0.** Not PATCH — F14 breaks every previously-valid
event's wire format, no grandfather clause. Not MAJOR — D45's own precedent (v0.5.9 → v0.6.0) already
established that this spec treats a breaking change as the MINOR slot while MAJOR stays 0, the
standard pre-1.0 semver carve-out ("anything MAY change" under major-zero). D45's forcing was a hit
ceiling; F14's is a deliberate breaking rewrite, but the same MINOR-not-MAJOR logic applies to both.

**Appendix G vectors regenerated here; `scrutiny-fabric-tools`'s vendored copies are not.** Both
`vectors/application.json` and `vectors/validity.json` carried the old fixed-width form in every
fixture event (100 occurrences total) and were swept to the unpadded form in this release, with fresh
SHA-256 digests recorded in Appendix G. This was safe without any signing infrastructure: every
fixture in both files already carries an all-zero placeholder `id`/`sig` (G.3 states this for
`application.json`; it holds for `validity.json` too, on inspection) — retagging changed no
cryptographic relationship that existed to begin with.

What this repo cannot fix: `scrutiny-fabric-tools/packages/core`'s checksum-pinned vendored copies of
these two files (D33's gate) are pinned to the pre-F14 digest. The moment this release merges, that
pin is stale — the vendored corpus no longer matches what Appendix G's table now says it should.
Re-vendoring at the new digest is that repo's own follow-up, not scheduled here.

---

## S8 — F15–F17 landing (v0.7.1 + v0.8.0): digit-string version comparison, T2 out-of-range clamp, UR-4 hold-pending

The third batched spec-feedback landing, from `scrutiny-fabric-tools/docs/SPEC-FEEDBACK-v0.7.0.md`
(the F13/F14 batch landed as v0.6.2 + v0.7.0, see S7). All three findings were adversarially
verified with live reproductions on the reference implementation side (the 2026-08-08 audit);
this session's work was the normative text and the two behavior rulings below.

**F16 ruling: hold-pending (new UR-4), not optimistic-include.** The gap was the third dangling-
reference shape: a root-author patch whose `e reply` parent is unobserved while its root is
observed — PT-6 covers an observed foreign parent, UR-2 an unobserved root, nothing covered this.
The reference implementation had quietly picked optimistic-include in the `linkable` filter's
`parent === undefined` disjunct, code no test, generator, or vector exercised; the audit showed
the disjunct is behaviorally inert at fixpoint (a parent absent from the observed set can never
become a walk position), so it was either dead code or untested load-bearing code and nobody could
say which. Hold-pending was ratified in UR-2's exact shape for three reasons. (i) Chain membership
asserts a contiguity the observed set cannot support while the parent is missing; every other
pending lifecycle in the spec (BD-6, DEL-8, UR-2) reports *held*, never approximate-*resolved*.
(ii) Optimistic inclusion is not interim-safe in general: two children of one dangling parent
would fire SF-1 and freeze canonical bytes (SF-2) behind an error annotation (SF-3) for a fork
that may evaporate when the parent arrives foreign, kind-5 deleted, or never. Hold-pending's
interim state is already the normative state that set-confluence (UR-1) reaches at fixpoint.
(iii) It is the least new machinery — UR-2's shape one tag over — and composes with CHN-1's
forward walk unchanged (the walk simply has no position for the patch yet). The respected
counterargument (surface the patch's content earlier) is a presentation concern serviceable
without a canonical-chain claim (a §7.3-shaped provisional rendering); it does not justify letting
canonical bytes turn on unobserved evidence.

**F17 ruling: clamp to the content's line range, as one T2 sentence, with the bound named in
content terms.** The alternatives allowed were clamp-to-a-different-bound (divergent canonical
bytes) and HALT (a full chain freeze over a coordinate C6 declares advisory and C7 forbids
rejecting the payload over — disproportionate, and a pure-insertion hunk asserts nothing about
existing content that clamping could falsify). The decisive evidence that "clamp" alone was not an
answer: the reference implementation itself clamped, and the audit found its bound was a
sentinel-inclusive container length rather than the content's line count — producing `a\nb\n\nNEW`
(dropped the trailing newline, added a phantom blank line) under a clean verdict. The sentence
therefore defines the count as the content's own lines, a final newline terminating the last line
rather than adding one — the exact ambiguity the implementation bug lived in.

**F15 is a re-description of VER-1's existing order, not a new one.** The digit-string formulation
(leading zeros ignored; greater length, then lexicographic — Go `x/mod/semver`'s `compareInt`,
RPM's `rpmvercmp`, dpkg/glibc's `verrevcmp`, none of which converts a fixed-width integer) agrees
with the numeric tuple order on every field the ecosystem can produce today, and is the settled
mainstream solution, not an invention. It removes the representation choice that made §3's two
paragraphs mutually unimplementable past 2^53 on an IEEE-754-double host — where the reference
implementation's literal "parse as numbers" reading silently collapsed distinct tags, and past
overflow returned `NaN` from the comparator while VER-4 still obliged it not to reject the
higher-version event it could no longer order. node-semver is the standing counterexample:
converting fields with `Number()` forced it to bolt a digit ceiling back on — the very ceiling F14
removed from the grammar. This is the third recurrence of the defect class D45 and F14 record;
landing the comparator fix as a clarification (implementation-validated, boundary-tested on the
tools side before this session) closes it one level down, with headroom instead of forced-bump
pressure.

**Release split: v0.7.1 (F15+F17), then v0.8.0 (F16).** House convention (D45, reaffirmed in S7):
pre-1.0, a breaking wire or behavioral change takes MINOR with MAJOR pinned at 0; clarifications
and additive rule-registry growth take PATCH (v0.6.1's new rules, v0.6.2's PT-10/PT-11). F15 and
F17 are clarifications — the same order on every tag that exists, and in-range pure insertions
untouched — and the reference implementation already runs both amended behaviors, so any other
reading was a latent bug, not a feature other implementations could have relied on. UR-4 instead
makes a currently-optimistic consumer's interim chain state non-conformant: a normative behavioral
change, its own MINOR. Two releases rather than one also keeps the small clarifications from
waiting on the breaking change's review, the same shape as F13-alone (v0.6.2) then F14 (v0.7.0).

**Vendored copies are stale — tools-repo consequence.** Appendix G changed twice in this landing:
`vectors/application.json` gained `t2/out-of-range-insert-clamps-to-content-end` at v0.7.1
(46 → 47) and `chain/root-author-patches-sharing-an-unobserved-reply-parent-are-held` at v0.8.0
(47 → 48), with the G.1 digest re-pinned each time (the `specVersion` field stays at `0.6.1`, the
corpus-introduction version, as it did through the v0.7.0 regeneration). `scrutiny-fabric-tools`
`packages/core`'s checksum-pinned vendored copies (D33's gate) match neither post-release digest:
re-vendoring at the new digests, `pnpm rules:gen` against the amended Appendix F (new UR-4 row),
UR-4 enforcement in `resolve.ts` replacing the characterized `parent === undefined` disjunct, and
the S3-21/S3-30 characterization-pin flips are that repo's follow-up session — tracked against the
v0.8.0 number, not scheduled here.

---

## S9 — F12 + F18 landing (v0.8.1): RL-2's per-line floor, E3's closing-fence existence

The fourth batched spec-feedback landing, from GitHub issues #30 (F12) and #37 (F18). Both
findings were verified on the `scrutiny-fabric-tools` side before filing: F12 has a landed
reference fix (the per-line floor in `patch.ts`, `83d2393`), F18 a landed comment correction
(the `FencedBlock.closed` doc comment, PR #66 there). This session's work was the normative
text only.

**F18 ruling: clarify, don't add a rule.** E3's "closing fence ≥ opening-fence length" admits
two readings: a constraint on the fence's length when one exists (CommonMark §4.5's model, in
which an unclosed block runs to the end of the document and is still a code block), or a
requirement that a closing fence exist — stricter than CommonMark, which the issue correctly
noted would need its own V rule. The clarification picks the first. Requiring closure was never
tenable: §3.2 delegates fenced-block parsing to CommonMark unchanged ("lookup, fence-length
matching, and payload byte boundary are CommonMark's responsibility"), and the reference
implementation had always treated unclosed blocks as payloads — its only defect was a doc
comment naming E3 as the reason for tracking `closed`, now corrected. E5 gained the boundary
consequence in words (with no closing fence, the payload is every line after the opening fence
to the end of `content`). No corpus change: behavior is unamended, the corpus grows
evidence-driven, and no vector cites E3.

**F12 ruling: a per-line floor inside the byte unit — not a unit rename, not a MUST.**
§5.4 asked consumers to bound total work "measured in bytes compared", but T1's uniqueness
scan costs `|content| × |pattern|` element comparisons regardless of the bytes those elements
carry, so a pattern of empty lines ran a full-length scan while billing zero bytes — exactly
the adversary-optimisation the unit exists to prevent. The issue offered two amendments: name
the unit "comparisons, charged at no less than one per line", or require a per-element floor in
whatever unit is chosen. The landing composes them at SHOULD-strength: keep "bytes compared"
(the unit implementations can cheaply sum, and the one the §5.4 prose and Appendix F digest
already name) and state the floor explicitly — no less than one unit per line of the hunk's
match pattern, which is exactly the reference implementation's `Σ(len(line) + 1)` charge. A
MUST was rejected: RL-2 is a ceiling policy at the A layer, local and configurable by design,
and OV-4's permitted divergence leans on that locality — hardening the unit would pretend
ceilings are consensus when they are not.

**Release: one patch, v0.8.1.** Neither finding changes conformant behavior — F18 restates what
the §3.2 CommonMark inheritance already implied, F12 refines a consumer-SHOULD whose exact
charged unit was always local — so both ship together as a PATCH under the D45/S7 convention,
no MINOR split. Appendix G is untouched: no vector cites E3 or RL-2 (verified against both JSON
corpora), and the `specVersion` field stays at `0.6.1`.

---

## Open questions

- No BCP 14 boilerplate paragraph in the spec yet (S1).
- No formal **Scope** clause, **Conformance** clause, or collected **Normative References** section.
  Currently implicit in §1 Abstract, the rule tables collectively, and each rule's "inherits from"
  column, respectively. A rigorous spec states these explicitly; whether to add them is undecided.
