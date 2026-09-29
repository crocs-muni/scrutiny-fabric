# Changelog

Release history for the SCRUTINY Fabric protocol specification (`docs/protocol-spec.md`). Entries
are terse and cite the affected rule IDs (Appendix F); the rationale for why a *specific rule* reads
as it does lives inline in the spec, next to that rule. Cross-cutting rationale not tied to one rule
— licensing, versioning, tooling decisions — lives in [docs/DECISIONS.md](docs/DECISIONS.md).

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
- **§7.1 recomputation requirement.** Non-UI consumers (indexers, HTTP APIs, AI agents,
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
