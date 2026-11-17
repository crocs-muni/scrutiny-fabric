# Changelog

Release history for the SCRUTINY Fabric protocol specification (`docs/protocol-spec.md`). Entries
are terse and cite the affected rule IDs; [`rules.json`](rules.json) lists every rule. The reasons for
cross-cutting decisions and for long-running rules are in [docs/adr/](docs/adr/README.md). Entries before
0.9.1 cite sections, appendices and `DECISIONS.md` entries by the numbering of their own release; the
tables under 0.9.1 map the old names to the new ones.

## v0.9.1

Restructure. **No rule changed:** the 152 rules have the same IDs, layers, inheritance and wording as in
0.9.0, and `vectors/` is byte-identical. The only edits inside rule rows are the section references
they contain, updated to the new numbering (28 rows; E7 also drops a section title). Section titles and numbers changed, so citations
of sections need updating; rule IDs are stable.

- **One normative file.** `docs/protocol-spec.md` holds the rule tables as the only statement of each
  rule. Appendix F is dropped and `rules.json` is generated from the tables by `tools/gen-rules.mjs`;
  `tools/verify-corpus.mjs` checks that it is current. Rule anchors (`#rule-BD-3`) are unchanged.
- **New documents.** `docs/overview.md`; `docs/guide/` (worked example, git mapping, roadmap, optional
  signals); `docs/adr/` with 17 decision records. `docs/DECISIONS.md` is removed: S1 to S10 are ADR-0001
  to ADR-0009 (S4 and S7 are merged into ADR-0004).
- **Terms and figures.** Section 2 defines every term once (the old Appendix C glossary). The specification
  carries nine figures: event graph, Binding lifecycle, successions, application pipeline, where each layer
  acts, self-fork states, overlay classification, deletion and α/β rendering, a discovery session.
- **Rule-layer prose.** The layer "manifests" of the old section 6.0 are removed; the Layer column is the
  only authority. The argument for the layers is ADR-0011.
- **Normative sentences outside rule rows.** The old prose carried requirements that no rule row states.
  They keep their keywords where they now stand: MUST defer to the base layers (3.2), MAY attach NIP-03
  attestations (3.1), SHOULD publish a competing Binding (3.4), SHOULD produce grammar-conforming payloads
  (4.3), SHOULD query several relays and cross-check, SHOULD warn when a trust expansion admits many new keys
  (9), SHOULD check NIP-11 before NIP-50 search (8.1), SHOULD treat a retracted root as absent in the default
  view and show its full history in an audit view (7), SHOULD verify the vector digest in CI, MUST NOT use the A-layer vectors for SIG-1, and the per-permutation
  MUST (10). The proof-of-work advice stays in the optional-signals guide. A later normative release may give
  them rule IDs. Where a rule row owns the requirement (RL-1, RL-2, RC-4, DEL-11, DQ-2, IM-1, IX-1, IX-4),
  the prose now names the rule and no longer restates the keyword.
- **Two prose clarifications.** Section 8.2 now says the `#t` list is not to combine `scrutiny-fabric` with
  another SCRUTINY value (DQ-5), as the rule does; section 4.4 steps now say honored deletion requests, two or
  more siblings, and give the annotation (H2) and the RL-4 consequence.
- **Known gaps carried over.** The threat model still cites the 0.8.1 numbering and `tools/verify-tm-sync.mjs`
  does not run until the threat model is rewritten.

Section map (old to new):

| Old | New |
|---|---|
| Keywords and conformance | Keywords and conformance |
| 1 Abstract, 2 Motivation | 1 Scope; [overview](docs/overview.md) |
| 3 Versioning and identification | 3.1 |
| 3.1 NIP dependencies, 3.2 inherited semantics | 3.2; optional signals in [guide](docs/guide/optional-signals.md) |
| 4.1, 4.2 Product, Metadata | 3.3 |
| 4.3 Binding | 3.4 |
| 4.4 Patch | 3.5 |
| 4.5 Indexer discipline | 3.7 |
| 4.6 Payload attachments | 3.8 |
| 4.7 Supersession | 3.6 |
| 5.1, 5.2 Patch payload and format | 4.1, 4.2, 4.3 |
| 5.3 Application, 7.4 Computing the canonical bytes | 4.4 |
| 5.4 Resource limits | 4.5 |
| 6.0 Rule layers | 5.1 |
| 6.1 to 6.4 Trust and admission | 5.2 |
| 7.1 Root author and canonical chain | 6.1 |
| 7.2 Root self-fork | 6.2 |
| 7.3 Foreign overlays | 6.3 |
| 7.5 Trust model and assumptions | 9 Security considerations |
| 7.6 Unresolved references | 6.4 |
| 8 Discovery and queries | 8 |
| 9 Canonical indexer registry | 3.7 |
| 10 Kind 5 deletion | 7 |
| 11 Future work | [roadmap](docs/guide/roadmap.md) |
| Appendix A Companion CLI | removed; the tools repository documents it |
| Appendix B Git mapping | [guide](docs/guide/git-mapping.md) |
| Appendix C Glossary | 2 Terms |
| Appendix D Worked example | [guide](docs/guide/worked-example.md) |
| Appendix E Interop validation | one sentence in 4.2; the findings stay in the tools repository |
| Appendix F Rule registry | [`rules.json`](rules.json) |
| Appendix G Conformance vectors | 10 |

## v0.9.0

- **Why 0.9.0.** New rules (SUP-1..4, DQ-5..8, IR-5, OV-10) and amended rule text (TAG-4, BD-2, BD-5, BD-6,
  PT-6, PT-11, VER-2, SF-1..SF-6, DEL-2, DEL-4, DEL-8, DEL-11, DQ-1, DQ-4, DQ-5, DQ-6, IM-3, CA-1,
  RC-3..RC-5, E1, H1, RL-5, C1, C2, C5, C6, T1, T2, OV-3, PT-3, PT-7, UR-4, IR-1). One release carries every change to normative wording; the restructure
  that follows moves text without changing any rule.
- **Keywords and conformance (DECISIONS S1).** The BCP 14 boilerplate, the three roles (producer,
  consumer, relay), a sentence mapping the words rules use ("publishers", "clients", "implementations")
  to roles, and what conformance means. A SHOULD may be departed from only for a documented reason.
  A service consumer is any consumer that is not interactive.
- **Query legs (F19, F20, F21).** DQ-1 now says an event-type `t` value satisfies the fabric-tag
  requirement at the relay and that a consumer still verifies TAG-1 on every result. DQ-4 requires a
  traversal query to select the event-type value. DQ-5 forbids combining `scrutiny-fabric` with any
  other SCRUTINY `t` value. DQ-6 writes the chain-root → patches filter, requires keeping only results
  whose `e root` names the root, and requires paging past relay limits. DQ-7 writes the by-id fetch.
  DQ-8 and §8.2 add the successors leg. The §8.1 and §4.3 examples now carry a typed or fabric filter.
- **Supersession (F22).** New §4.7, SUP-1..4. A `supersedes` marker links an event to an observed,
  V-valid, same-type event by the same pubkey; a deleted but retained event still counts. Events so
  linked form a succession whose final member is the current version. Two non-deleted successors fork
  it and the fork is surfaced, never resolved by `created_at`; a deleted final member retracts the
  succession. Successions are computed over all valid events and trust is applied to the result, so a
  link confers no admission. Bindings, patches and overlays are not transferred. §11's patch-redo
  entry is renamed so one name no longer carries two designs.
- **Spelling and counts (F23).** IR-5: an `i` value is a spelling, and a service consumer that widens a
  count across spellings discloses them.
- **Legacy version tag (F24).** No rule change. Vector `tags/legacy-three-digit-version-tag` pins
  `scrutiny-v059` as invalid; the reference library still accepts it until its own fix lands.
- **TAG-4 (F25, #36).** TAG-4 moves from V to D and is scoped to the `t` values this specification
  defines; TAG-5 governs every other tag. Vector `tags/inherited-tag-is-ignored` pins NIP-23
  `published_at` and `title` tags as valid. §6.0 states why producer obligations stay in A and D,
  which closes the V-layer note.
- **Unobserved targets (F26).** §7.6 opens with one paragraph naming the four places the condition
  shows (pending Binding, held Patch, held `supersedes` marker, late deletion). No rule changes.
- **Self-fork resolution (SF-5, §7.2).** A deletion must target a sibling, meaning a patch that
  replies directly to the shared parent. Deleting a patch below a sibling removes only that patch and
  leaves the fork in place; deleting the shared parent or an ancestor removes both siblings. The
  existing vector deletes a sibling and the reference library already cascades per DEL-2, so both
  agree with the corrected text; an implementation of the old wording, which resolved a fork by
  deleting any patch in an arm, must change. Two vectors pin the boundary. SF-1 names the patches
  *siblings* and the word "branch" is retired from rule text. (The vector field `branchIds` keeps
  its name.)
- **Vocabulary.** "Admitted" belongs to the trust gate only (BD-5, PT-11 and VER-2 now say rejected or
  processed; BD-6 and PT-6 reworded; §6.0 is "Rule layers"). "Patched content" is canonical bytes.
  "UI" and "non-UI" consumers are interactive and service consumers. "Topology cascade" is the kind 5
  cascade. "Annotation" no longer means a foreign patch; it remains the diagnostic attached to an
  outcome (H2, RL-3, OV-9). Appendix C gains sibling, succession and the two consumer classes.
- **Inherited semantics.** §3.2 marks three SCRUTINY-specific departures: markup in `kind:1` content
  and the `link` and `supersedes` markers (NIP-10), and keeping the original of a deleted event
  (NIP-09). Its preamble now excepts them. IM-3 names `fallback` entries (NIP-94) for alternate
  sources, ignores additional `url` entries, and NIP-94 joins the references. E1 and BD-2 list NIP-10
  as an inheritance. CA-1 and §4 cite NIP-11's `created_at` limits, §3.1 notes that NIP-03 is marked
  `unrecommended` upstream, and both deletion examples carry a `k` tag.
- **Implementer-test gaps (G1–G14).** A fresh implementation written from the rule text alone passed
  every vector only after guessing at fourteen points; each is now stated. C6: the `@@` counts bound a
  hunk, the line numbers stay advisory, while counts are unmet an empty line is context and a `\` line
  is attached, an early `@@` or section header or the payload's end is malformed (HALT), and after the
  counts only empty lines and `\` markers may precede the next hunk. C1: only a wrong path token is
  V-invalid (P2's forbidden lines are the other V case); every other grammar failure HALTs, or makes a
  foreign patch's overlay `conflict`. The grammar's trailing data allows a tab or a CR, and `lineno`
  and `count` are defined. C5: a `\` line says the preceding line has no
  terminator, and a line with one differs from the same line without. T1: overlapping occurrences
  count. T2: `-L,0` is the position after line L, the carry-forward counts only hunks whose header
  range ends at or before L, and an insertion after an unterminated final line HALTs. RC-5: the tip is
  the last event of the applied chain, the last applied patch under a HALT, and undefined where a fork
  or a ceiling is the earlier freeze point. New OV-10: with no tip no overlay is `clean`, a defined,
  applying target is `stale` and a failing one `conflict`; OV-3 and the §7.3 table cover targets at or
  beyond a HALT or a ceiling stop. UR-4: holds are transitive among root-author patches.
  PT-7: a foreign patch awaiting its reply target is `pending`; PT-6 and PT-7 say "of the same root"
  and cover a reply to any other event. PT-3 no longer contradicts PT-4 and E6. IR-1: an `i` value
  with no colon breaks it. G.2 gains a Reporting paragraph and the vocabulary of `expect`, and
  `chain/root-only`'s `why` is corrected.
- **Corpus.** `vectors/validity.json` gains eight cases (19 → 27) and `vectors/application.json` four
  (48 → 52); digests and G.1 are re-pinned. Vectors for SUP-1..3 and DQ-5..8 are not yet published
  (G.3: the corpus is incomplete by design). The `specVersion` field stays at `0.6.1`.
- Version tag `scrutiny-v0.8.1` → `scrutiny-v0.9.0`. §3's forward-compatibility example moved from
  `scrutiny-v0.9.0` to `scrutiny-v0.9.1`.

## v0.8.1

- **E3 clarified (F18, [issue #37](https://github.com/crocs-muni/scrutiny-fabric/issues/37)).** "Closing fence ≥ opening-fence length" could be read as
  requiring a closing fence to exist — stricter than the CommonMark §4.5 model, where an unclosed
  block runs to end of document and is still a code block. E3 constrains the closing fence's
  length only when one exists; an unclosed block's payload runs to the end of `content`. See E3,
  E5, PB-2, §5.2.
- **RL-2 amended (F12, [issue #30](https://github.com/crocs-muni/scrutiny-fabric/issues/30)).** "Bytes compared" was itself a unit an adversary optimises
  against: T1's uniqueness scan costs `|content| × |pattern|` element comparisons regardless of
  the bytes those elements carry, so a hunk whose match pattern is empty lines ran a full-length
  scan at zero billed bytes. The total-work ceiling now charges a per-line floor — no less than
  one unit per line of the hunk's match pattern (T1). See RL-2, §5.4, DECISIONS.md S9.
- Version tag `scrutiny-v0.8.0` → `scrutiny-v0.8.1`. §3's forward-compatibility example moved
  from `scrutiny-v0.8.1` to `scrutiny-v0.8.2`. The §4 mini-examples and Appendix D worked events
  now carry the template form `scrutiny-v<MAJOR>.<MINOR>.<PATCH>` — the concrete literal survives
  only in the title, **Version:** field, §3's examples, and the §4 preamble, and
  `tools/verify-corpus.mjs` now asserts those agree (DECISIONS.md S9).

## v0.8.0

- **Why 0.8.0 and not 0.7.2.** UR-4 changes normative chain semantics: a root-author patch whose
  `e reply` parent is unobserved had no named disposition, and an optimistic consumer could count
  it as a chain candidate (the reference implementation did, in an untested filter branch). It
  MUST now be held out of the canonical chain and self-fork detection until the parent arrives,
  so a currently-optimistic interim state becomes non-conformant — a breaking behavioral rule,
  MINOR under the D45/S7 pre-1.0 convention. The two clarifications this session also landed
  shipped separately as v0.7.1 rather than riding inside the breaking release. See DECISIONS.md S8.
- **New UR-4 (§7.6).** The third dangling-reference shape: a Patch's own `e reply` target
  unobserved while its root is observed. PT-6 is unevaluable on it (the parent's authorship class
  is unknown); SF-1 cannot read a shared pending parent as a fork; CHN-1's walk has no position
  for the patch; an overlay targeting a held patch is orphaned (OV-3). The patch is retained and
  re-evaluated on the target's arrival — UR-2's shape one tag over. See UR-4, PT-6, CHN-1, SF-1,
  OV-3, §5.3 step 1, §7.6.
- **New vector** `chain/root-author-patches-sharing-an-unobserved-reply-parent-are-held`
  (`vectors/application.json` 47 → 48), digest updated in Appendix G.
- **`scrutiny-fabric-tools`'s vendored copies are stale.** The Appendix G corpus digest changed in
  v0.7.1 and again in this release; the checksum-pinned vendored copies match neither — see
  DECISIONS.md S8.
- Version tag `scrutiny-v0.7.1` → `scrutiny-v0.8.0`. §3's forward-compatibility example moved from
  `scrutiny-v0.7.2` to `scrutiny-v0.8.1`.

## v0.7.1

- **VER-1 amended (F15).** §3 defined the ordering "as numbers" two paragraphs after removing the
  digit-count ceiling — unimplementable past 2^53 on an IEEE-754-double host (distinct fields
  collapsed to equal, overflow produced `NaN` and broke the comparator entirely). Each field now
  compares as a decimal digit string: leading zeros ignored, greater length, then lexicographic —
  the same total order VER-1 already declared, host-independent. See VER-1, §3.
- **T2 amended (F17).** An out-of-range pure-insertion `@@` coordinate had no defined disposition,
  and C6's context-match remedy cannot reach a contextless hunk — clamp, clamp-elsewhere, or HALT
  were all defensible. The implied position now clamps to the content's line range, and the line
  count is the content's own lines: a final newline terminates the last line and is not one. See T2.
- **New vector** `t2/out-of-range-insert-clamps-to-content-end` (`vectors/application.json` 46 → 47),
  digest updated in Appendix G.
- Version tag `scrutiny-v0.7.0` → `scrutiny-v0.7.1`. §3's forward-compatibility example moved from
  `scrutiny-v0.7.1` to `scrutiny-v0.7.2`.

## v0.7.0

- **Why 0.7.0 and not 0.6.3.** F14 retires the fixed-width `scrutiny-vMMP` version-tag form outright —
  every event's wire format changes, no dual-path acceptance. Pre-1.0 semver treats a breaking change
  as the MINOR slot (MAJOR stays 0), the same convention D45 applied when the ceiling first forced
  v0.5.9→v0.6.0. See DECISIONS.md S7.
- **TAG-2 and VER-1 rewritten.** The version tag stays a `t` tag — `["t", "scrutiny-v<MAJOR>.<MINOR>.
  <PATCH>"]` — but its value is now unpadded decimal integers with no digit-count ceiling in any field,
  instead of the old fixed 3-digit form. Ordering is now an explicit per-field numeric tuple
  comparison, never lexicographic — the old "zero-padded" claim held only under the one-digit-per-field
  ceiling this removes. See TAG-2, VER-1, §3.
- **No new tag introduced.** An earlier draft of this amendment proposed a dedicated single-letter `v`
  tag; reworked before release to widen the existing `t`-tag value instead, since the new-tag design
  claimed a NIP-unbacked letter for no corresponding benefit (`{"#t": [...]}` already gives the same
  relay-side filtering). See DECISIONS.md S7.
- **Downstream sweep.** Every mini-example in §4.1–§4.4 and Appendix D's worked example moved from
  `["t", "scrutiny-v0NN"]` to `["t", "scrutiny-v<MAJOR>.<MINOR>.<PATCH>"]`. Appendix G's own vectors
  (`vectors/application.json`, `vectors/validity.json`) regenerated under the new form; digests in the
  Appendix G table updated accordingly. `scrutiny-fabric-tools`'s checksum-pinned vendored copies are
  stale as of this release — see DECISIONS.md S7.

## v0.6.2

- **New PT-10, PT-11.** §4.4's `e root` reference had a typing rule only for the pending case (§7.6
  UR-2); no rule rejected an *observed* wrong-typed root — the identical gap BD-3/BD-5 close for
  Binding endpoints. A Patch whose observed `e root` is not a `scrutiny-product` or
  `scrutiny-metadata` event is now invalid and MUST NOT be admitted. UR-2/UR-3 needed no change; the
  rejection partitions the same way BD-6/BD-7 already do. See PT-10, PT-11.
- Version tag `scrutiny-v061` → `scrutiny-v062`. §3's forward-compatibility example moved from
  `scrutiny-v062` to `scrutiny-v063`.

## v0.6.1

- **Appendix G "Conformance vectors."** New `vectors/application.json` (46 cases) and
  `vectors/validity.json` (19 cases), digest-pinned. §11's "Test vectors" bullet struck; Appendix E
  points at the corpus. Blocked three phases of the reference implementation before this release.
- **P1, E4, P3 re-tagged V → A** as producer obligations (context-line minimum, fence length,
  payload encoding/line endings). See P1, E4, P3.
- **C7 retained as V**, reclassified as a Validity *inclusion* rule rather than an anomaly; C2–C4
  reworded to match. §6.0 now distinguishes exclusion rules from inclusion rules, and states that
  Appendix F's Layer column — not the §6.0 manifests — is authoritative for layer membership. See
  §6.0, C2, C3, C4, C7.
- **§6.0's Validity manifest no longer cites §5.1** (PB-1/PB-2 are Application rules, not Validity).
  See §6.0.
- **New RC-5**: the tip is the last chain *event*, not the last patch — a root with no patches is
  its own tip. Fixes a `stale` misclassification on never-patched roots. Found while authoring the
  Appendix G corpus. See RC-5, §7.1, §7.3.
- **New SF-7**: bounds the self-fork/HALT precedence to a stated freeze point (earlier in chain
  order wins), replacing an unconditional rule that could require applying patches past a HALT. See
  SF-7, §5.3 step 5, §7.2.
- **New OV-9, RL-5**: a §5.4 resource ceiling now has its own disposition — `unclassified` for
  overlays, *aborted under a ceiling* for chains — distinct from both a classification and a HALT.
  See OV-9, RL-5, §7.3, §7.4.
- **New C8**: the grammar admits multiple file sections (`1*file-section`); a `---` at hunk-line
  position starts a new section rather than being read as a removal line. See C8, §5.2.
- **Grammar corrected**: `line-content` replaces ABNF `VCHAR` in `hunk-line`/`trailing` (`VCHAR`
  excluded spaces and non-ASCII, rejecting the spec's own example); a bare empty hunk line is now
  admitted; `index-preamble`'s `Index:` line is now optional relative to the `===…` separator
  (matches jsdiff's `structuredPatch` + `formatPatch` output). See §5.2.
- **C5 rekeyed on the `\` prefix**, not the (locale-dependent) English marker text.
- **P2's remedy corrected**: `--no-index` does not suppress the `index` line; strip it post-hoc
  instead. The rule itself was already sound.
- Version tag `scrutiny-v060` → `scrutiny-v061`. §3's forward-compatibility example moved from
  `scrutiny-v061` to `scrutiny-v062`.

## v0.6.0

- **Why 0.6.0 and not 0.5.10.** The version tag is fixed at three digits encoding
  MAJOR/MINOR/PATCH (`^scrutiny-v\d{3}$`, VER-1), so each MINOR line admits exactly ten PATCH
  revisions — `scrutiny-v050` through `scrutiny-v059`. v0.5.9 was already patch 9; there is no
  `scrutiny-v0510`, and staying in 0.5.x would mean changing the tag scheme itself and breaking
  TAG-2, VER-1, and every published event.
- **PR-4 and MD-4 re-tagged V → D; MUST → SHOULD.** A missing or incomplete `k` collection no
  longer invalidates an event. The `k` value is pure redundancy — derivable from the `i` value by
  splitting on the first colon — so discarding an advisory over it is disproportionate, and the
  previous text contradicted §9, which already said such an event was valid but less discoverable.
  Consumers MAY derive the kind from the `i` prefix. §9's prose now defers to PR-4/MD-4 rather than
  restating the requirement.
- **New §7.6 "Unresolved references." UR-1, UR-2, UR-3.** Bindings (BD-6) and deletions (DEL-8)
  already had hold-and-re-evaluate semantics; patches did not. A Patch whose `e root` is unobserved
  cannot be classified at all, because the root-author versus foreign distinction requires the
  root's `pubkey`; it MUST be retained and re-evaluated on the root's arrival. Generalised as a
  standing requirement: **ingestion is confluent** — state depends only on the set of events
  observed, never on arrival order. A classification MAY be cached as permanent only when no
  further observation could change it.
- **Binding deletion revokes the admission it conferred.** DEL-5 amended; TR-4, TR-5, §6.4 and §10
  aligned. Previously §10 said only that a retracted Binding was "hidden from default views" while
  TR-4 admitted endpoints unconditionally — two rules with opposite readings. Admission MUST NOT
  outlive the assertion that produced it: otherwise a compromised key could permanently insert
  events into a user's view by publishing a Binding and then deleting it, defeating §6.3. Endpoints
  remain V-valid and are never cascade-deleted. DQ-2 and §8.2 extended to poll for Binding
  deletions, without which the rule is unimplementable.
- **New §5.4 "Resource limits." RL-1..RL-4.** The spec previously bounded only `i` and `k` tag
  counts. Recommended producer bounds now reflect limits deployed relays enforce, and consumers
  SHOULD bound the *total work* of patch application in bytes compared, since an adversary
  optimises against whichever unit is counted. Exceeding a local ceiling aborts application and is
  surfaced as a distinct **resource-limit exceeded** annotation — never as HALT, and never as
  invalidity.
- **New SIG-1 (§3).** A signature commits to the `id`, so a signature-only check passes for an
  event whose `content` or `tags` were altered while retaining the original `id` and `sig`. Both the
  signature *and* the `id`-equals-SHA-256 check MUST be performed, on **every event consumed** —
  including kind 5 deletions and kind 1040 attestations, not only events carrying a
  `scrutiny-fabric` tag. An unverified deletion is indistinguishable from a forged one. §3.2's
  NIP-01 row amended so inherited-semantics deference cannot be read as putting SIG-1 out of scope.
- **§5.2 consumer grammar corrected; new C7.** The grammar required at least one hunk block
  (`[ hunk-block ]+`), contradicting N2, which accepts a header-only no-op — and postfix `+` is
  regex, not ABNF. Now `header-block *hunk-block`. The grammar's "a conforming consumer MUST accept"
  obligation is registered as C7.
- **New TR-7.** §6.2 said untrusted events were "filtered out before any other processing." Taken
  literally that conceals root self-forks and HALT conditions in the chain of a root admitted via a
  trusted Binding, because such a root's own patches may be authored by a pubkey the user does not
  trust directly — the chain then renders linear and complete when it is neither. Filtering is now
  explicitly a **presentation-time** operation applied to the results of chain and overlay
  computation. §7.4 step 5 and §7.5 aligned.
- **New CA-1 (§4 preamble).** `created_at` is the time the *event* was created, not the time of the
  fact it describes. Deployed relays commonly reject events whose `created_at` falls outside a
  bounded window, so backdated events are **silently refused** — nothing stored, no error.
  Publishers mapping historical records SHOULD NOT backdate; historical dates belong in `content`.
- §6.0's Validity manifest now cites `E1–E6` rather than `E*` (which swept in E7, an Application
  rule) and includes C7; its Discovery bullet cites `TR-2..TR-7`. Appendix B no longer describes
  merges as planned for `v060`.
- Version tag `scrutiny-v059` → `scrutiny-v060`.

## v0.5.9

- **Admission layers reframed: V / A / D instead of L1 / L2.** The two-bucket layering introduced
  in v0.5.8 (L1 = validity, L2 = interpretation) conflated "rule strength" (MUST vs SHOULD) with
  "rule subject." It mis-tagged ~30 rules. §6.0 now defines three layers that match what the spec
  actually does: **V (Validity)** — is the event well-formed and admissible (tags, schema, payload
  envelope format); **A (Application)** — given an admitted event, does applying it to chain state
  succeed (patch determinism, HALT, chain construction, kind 5 cascade, overlay classification,
  deletion semantics); **D (Discovery)** — how do consumers find, gate visibility, and resolve
  events across the relay mesh (indexer discipline, queries, trust admission, rendering visibility,
  relay-hint fallback). Every rule's Layer column is retagged accordingly. No normative changes to
  the rules themselves; only the layering metadata changes.
- **Restored missing MUST in BD-8.** v0.5.8 silently dropped the "Implementations MUST fall back to
  their full relay set if the event is not found on the hinted relay" clause from §4.3 prose during
  rule-table extraction. Restored to both prose and BD-8.
- **New DQ-3.** Section 8.1 step 3 (NIP-50 search fallback) contained an un-tagged normative MUST:
  "Client MUST verify returned events carry valid `scrutiny-fabric` tags and match the user's
  intent." Now a registered rule.
- **New DQ-4.** Section 4.3 binding traversal note contained an un-tagged normative MUST: results
  of `{"#e":[<metadata-id>]}` MUST be filtered for `scrutiny-binding` `t` tags and `e` tag markers
  inspected to determine endpoint role. Now a registered rule.
- **New DEL-10, DEL-11.** Section 10 contained two un-tagged normative directives: clients SHOULD
  offer a "show deleted events" toggle (DEL-10); SCRUTINY-aware relays SHOULD inspect kind 5 `e` tag
  targets and store deletions alongside originals (DEL-11). Both now registered.
- **De-duplicated OV-1 ↔ PT-7.** Both rules normatively stated "a foreign patch's `e reply` MUST
  point at the root event or a root-author patch; overlay-to-overlay reply is invalid." The
  constraint is structurally a Patch-event shape rule, so PT-7 (§4.4) remains the single normative
  source. OV-1 in §7.3 is now a reserved cross-reference pointing at PT-7; the ID is retained for
  citation stability.
- Version tag `scrutiny-v058` → `scrutiny-v059`.

## v0.5.8

- **Rule registry.** Every normative MUST / MUST NOT / SHOULD / SHOULD NOT / MAY in the spec is now
  tagged with a stable mnemonic ID (`E4`, `T1`, `BD-3`, `DEL-2`, …). Each rule carries a Layer
  column (L1 / L2, since reframed to V / A / D in v0.5.9) and, where applicable, an "Inherits from"
  column linking to the base-layer source (NIP-01 / NIP-09 / NIP-10 / NIP-73 / CommonMark §4.5). No
  normative changes — IDs are an indexing overlay on existing rules.
- **New Appendix F.** Flat sortable registry of every rule ID, its layer, its section, its
  inheritance source, and a one-line summary. This is the index implementers and conformance tests
  dereference; the prose sections remain the authoritative definitions.
- Version tag `scrutiny-v057` → `scrutiny-v058`.

## v0.5.7

- **New §3.2** "Relationship to base layers — inherited semantics." Consolidates which behaviours
  are inherited from NIP-01 / NIP-09 / NIP-10 / NIP-73 / CommonMark §4.5; SCRUTINY does not
  override them.
- **New §6.0** "Admission layers." Splits event evaluation into Layer 1 (protocol validity,
  MUST/MUST NOT) and Layer 2 (interpretation, SHOULD/MAY). Surplus tags, lineage-invalid
  placements, and similar are now explicitly admitted-but-ignored rather than rejected.
- **§5.1 / §5.2 rewrite.** Patch payload envelope anchored on CommonMark §4.5 fenced code blocks.
  Variable-length fence rule (`max(3, longest_backtick_run + 1)`) lets patches operate on content
  that itself contains backtick fences (e.g., Metadata events with embedded PoC code blocks).
- **§4.3 pending-endpoint lifecycle.** Bindings whose endpoints are not yet observable are held
  pending; admitted on endpoint arrival if typing check passes; permanently invalid (cached)
  otherwise.
- **§7.1 recomputation requirement.** Non-UI consumers (indexers, HTTP APIs,
  vulnerability scanners) MUST recompute canonical bytes and overlay states when their observed
  event set changes. UIs SHOULD.
- **§4.1 / §4.2 / §9 k-tag rule.** Set semantics: at minimum one `k` per distinct prefix kind in the
  event; producers MAY emit one `k` per `i`. Aligns with NIP-73.
- **§3 carve-outs.** Exactly one `["t","scrutiny-fabric"]` tag. Version-tag regex
  `^scrutiny-v\d{3}$`. Forward-compat clarified: higher-version events admitted opaquely only if
  v0.5.7 Layer-1 invariants still hold.
- **§5.3 carve-outs.** Insertion hunks (no context / no `-` lines) bypass the exactly-once
  uniqueness check. Multi-hunk patches: each hunk's uniqueness check is evaluated against the
  content as produced after prior hunks in the same patch.
- **§7.3 overlay clarifications.** Overlays whose `e reply` target is unapplied (downstream of HALT
  or inside an unresolved self-fork) are orphaned, not classified. Stale-vs-conflict-vs-clean
  wording rewritten for clarity.
- **§7.2 self-fork resolution.** Wording updated: delete any patch in the unwanted branch; topology
  cascade removes its descendants.
- **§8.2 deletion query.** Added query example for fetching kind 5 deletions affecting an event.
- **§4.6 imeta tightening.** `size` mismatch SHOULD be treated as a verification failure; multiple
  `url` mirrors permitted per NIP-92.
- **§3.1 OTS clarification.** Consumers MUST NOT use OTS timestamps in canonical-chain or overlay
  decisions.
- **New Appendix E.** Non-normative reference to the empirical interop study in
  `scrutiny-fabric-tools/investigations/diff-parity/`.
- Version tag `scrutiny-v056` → `scrutiny-v057`.
