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
as-is. **Open question below**: PATCH-slot exhaustion behaviour at the ten-revisions-per-MINOR
boundary is not yet specified.

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

---

## Open questions

- No BCP 14 boilerplate paragraph in the spec yet (S1).
- No formal **Scope** clause, **Conformance** clause, or collected **Normative References** section.
  Currently implicit in §1 Abstract, the rule tables collectively, and each rule's "inherits from"
  column, respectively. A rigorous spec states these explicitly; whether to add them is undecided.
- **PATCH-slot exhaustion.** What happens at the `scrutiny-v0510`-equivalent boundary — does MINOR
  roll and PATCH reset (`scrutiny-v070`), or does the tag format itself change? Currently
  unspecified, and this is the first revision close enough to the boundary (`v061` of ten) that the
  question stops being hypothetical.
