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

## Open questions

- No BCP 14 boilerplate paragraph in the spec yet (S1).
- No formal **Scope** clause, **Conformance** clause, or collected **Normative References** section.
  Currently implicit in §1 Abstract, the rule tables collectively, and each rule's "inherits from"
  column, respectively. A rigorous spec states these explicitly; whether to add them is undecided.
