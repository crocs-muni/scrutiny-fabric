# SCRUTINY Fabric — Threat Model v0.5.3 Gap Analysis

**Date:** 2026-05-16
**Reference:** `docs/SCRUTINY_threat_model_v0_5_3.md` vs `docs/protocol-spec.md` v0.5.3
**Scope:** Full cross-reference audit of every threat entry against the current protocol spec

---

## Executive Summary

The threat model (1043 lines, 34 threats, 11 adversary archetypes) was written against an intermediate state of the protocol spec. The v0.5.3 spec underwent structural changes that invalidated several section references and rendered three threat entries functionally obsolete. Another four entries need substantive revision. Six new threat vectors introduced by v0.5.3 changes have no corresponding entry in the threat model. The deferred recommendations (R1–R5) from Review Pass 1 need reevaluation under the new spec structure.

**Critical finding:** The threat model was NOT updated after the v0.5.3 spec changes. This document is a field guide to every divergence.

---

## Part 1 — Obsolete Threats (Remove or Retire)

These threats describe mechanisms that no longer exist in v0.5.3. They should be removed from the active threat model or moved to a "Retired" appendix.

### T-DC-03 — Identifier Mirror Infidelity

| Field | Value |
|---|---|
| **Current risk** | Medium |
| **Recommendation** | **REMOVE** — mechanism gone |

**Why it's obsolete.** v0.5.3 §4.5 states: *"`i` tags and `k` tags on root events (Products and Metadata) are immutable — patches only modify `content` (§4.4). To add or change indexers after publication, publish a new root event."* Patches cannot introduce new `i` tags via diffs because patches don't act on the `i` tag surface. The entire concept of "identifier mirror infidelity" — where a patch adds an identifier via a diff but omits the corresponding `i` tag — describes a mechanism that does not exist. A patch's unified diff acts on the `content` field only (§5.1). There is no `i`-surface diff, no identifier mirroring, and therefore no mirror infidelity.

**Related stale reference.** The threat references §4.4.1 ("mirroring"), which was part of the v0.5.2 identifier discipline section and does not exist in v0.5.3.

### T-DC-04 — Patch-to-Root Resolution Gap

| Field | Value |
|---|---|
| **Current risk** | Medium |
| **Recommendation** | **REMOVE** — mechanism gone |

**Why it's obsolete.** This threat describes a scenario where `#i` queries return patch events (because identifiers were mirrored per §4.4.1), requiring expensive canonical-view computation to confirm identifier currency. In v0.5.3, patches do NOT carry mirrored `i` tags because patches cannot modify `i` tags — the `i` surface is immutable per §4.5. Patches carry only the required `t` tags (`scrutiny-fabric`, `scrutiny-v053`, `scrutiny-patch`) plus `e` tags for chain topology. A `#i` query will never match a patch event. This threat's entire scenario is based on a mechanism that no longer exists.

**Related stale reference.** Same as T-DC-03 — references §4.4.1 which does not exist.

### T-PI-04 — Snapshot Pin Staleness

| Field | Value |
|---|---|
| **Current risk** | Medium |
| **Recommendation** | **REMOVE** — move to §11 (Future work) reference |

**Why it's obsolete.** Snapshot pins (`root:rev` / `link:rev` markers on bindings) do not exist in v0.5.3 §4.3. The binding tag schema is only: `e root` (1, MUST), `e link` (1, MUST). Snapshot pins are listed in §11 Future Work: *"Snapshot pins. State anchoring for bindings (`root:rev` / `link:rev` markers pointing to specific patch event IDs)."* Since this is a planned feature that hasn't been spec'd, the threat model should not contain an active threat about it. If this is reintroduced in a future version, the threat can be resurrected.

---

## Part 2 — Threats Requiring Substantive Revision

These threats reference mechanisms that changed significantly between versions.

### T-DI-04 — Binding Relationship Ambiguity

| Field | Value |
|---|---|
| **Current risk** | Low–Medium |
| **Recommendation** | **REWRITE** — mechanism changed, risk may increase |

**What changed.** In v0.5.2, bindings carried NIP-32 labels (`L`/`l` tags) for relationship semantics (e.g., `["l", "vulnerability", "scrutiny:binding:relationship"]`), with the understanding that `t` tags could provide advisory hints. In v0.5.3, ALL structured relationship labeling was removed. Bindings carry only: required `t` tags + `e root` + `e link`. The `content` field is the sole vehicle for relationship semantics.

**Impact on risk assessment.** This is a **discoverability regression**, not just an ambiguity concern. The old system allowed `#t` queries to filter bindings by relationship type (e.g., find all vulnerability bindings for a product). In v0.5.3, binding discovery is purely structural: you can find all bindings referencing a product via `#e`, but you cannot filter by relationship type without parsing `content` prose. The only discoverability path for "show me vulnerability bindings" is now NIP-50 free-text search, which is relay-optional and tokenizer-dependent.

**What the threat should now say.** The threat should be elevated to include both (a) ambiguity between `content` prose and any publisher-side intent and (b) the structural loss of relationship-type queries as a discovery vector. The risk may shift from Low–Medium to Medium because the query-loss affects every consumer regardless of whether the publisher was being ambiguous.

### T-DI-06 — Attached Content Integrity (Diff-in-Transit + Blossom Split-World)

| Field | Value |
|---|---|
| **Current risk** | Medium |
| **Recommendation** | **MODIFY** — section references stale; logic still valid |

**What changed.** The threat references "§5.2 lookup, §4.5 imeta." In v0.5.3, §4.5 is "Indexer discipline" and imeta is §4.6. The lookup order in §5.2 was also refined: the primary path is now exclusively inline diffs (within fenced code blocks); externally-hosted files are not used as patch diffs. The spec states: *"Externally-hosted files are not used as patch diffs."* This means the "diff-in-transit" concern for Blossom-attached diffs is structurally moot — there IS no Blossom-attached diff path for patches. The split-world concern for general imeta artifacts (SBOMs, CSAF reports) remains valid.

**Fix needed.** Update spec references (§5.2, §4.6). Narrow the diff-in-transit concern to acknowledge the spec's explicit exclusion of external diff hosting. Keep the split-world concern for non-diff artifacts as-is.

### T-ID-05 — Author Hint Forgery on `e` Tags

| Field | Value |
|---|---|
| **Current risk** | Low |
| **Recommendation** | **MINOR UPDATE** — mechanism unchanged but broader attack surface |

**What changed.** The threat is structurally still valid: `e` tags carry author hints, hints can lie, pre-fetch optimism is a UI problem. However, v0.5.3 expanded the use of `e` tags with author hints: bindings now use TWO `e` tags (root + link) instead of one `e` + one `q`. Every binding carries two author-hint surfaces rather than one. Additionally, patch events carry `e root` and `e reply` hints. The attack surface for author-hint forgery is wider — more places to lie — but the mitigation (hint doesn't gate admission) applies uniformly.

**Fix needed.** Acknowledge the expanded hint surface. Risk remains Low. The pre-fetch optimism window is the same problem, just on more tags.

### T-AV-04 — Artifact Hosting Fragility

| Field | Value |
|---|---|
| **Current risk** | Medium |
| **Recommendation** | **MODIFY** — remove stale diff-attachment language |

**What changed.** The threat discusses "patches whose diff is imeta-attached" as a secondary concern. In v0.5.3, this path was explicitly removed: *"Externally-hosted files are not used as patch diffs"* (§5.2). All patch diffs are inline and signature-protected. The threat's §5.3 HALT discussion should be revised accordingly — HALT applies to inline diffs that fail pre-validation, not to missing external diffs.

**Fix needed.** Remove the "attached diff" language for patches. Keep the artifact rot/takedown/split-world concerns for general imeta artifacts. The "inline diffs immune" mitigation is now absolute rather than just primary.

---

## Part 3 — Stale Section References (Cosmetic but Structural)

These threats are logically sound but reference spec sections that have been renumbered, renamed, or removed.

| Threat | Stale Reference | Correct v0.5.3 Reference |
|---|---|---|
| T-DI-06 | §4.5 imeta | §4.6 Payload attachments |
| T-ID-03 | §4.4.2 discipline | Does not exist — correct reference is §4.5 Indexer discipline |
| T-AV-03 | §4.5 imeta recommendation | §4.6 Payload attachments |
| T-AV-04 | §4.5, §5.2 attached diffs | §4.6, §5.2 (with external diff path removed) |
| T-DC-03 | §4.4.1 mirroring, §8.3 | N/A — threat is obsolete |
| T-DC-04 | §8.3 client resolution MUST, §4.4.1 | N/A — threat is obsolete |
| T-PI-04 | §4.3 snapshot tags | N/A — feature is in §11 Future Work |
| T-EC-04 | §2 principle 4 | §2 principle 4 is "Cheap relay queries for the common case"; the cited principle about deep semantics is now principle 2? Actually, all 6 principles are: 1. Stay Nostr-native, 2. Render gracefully, 3. Deep semantics require protocol-aware processing, 4. Cheap relay queries, 5. Don't fight established formats, 6. Minimal protocol surface. The reference should be principle 3. |
| T-AV-02 | §6.4 binding traversal, §7.4 chain computation | Still valid references |
| T-AV-05 | §4.4 prose-only definition | Still valid |
| T-DI-02 | §7.2, §7.4 | Still valid |
| T-PI-02 | §10, §7.3 orphaned disputes | Still valid |

---

## Part 4 — New Threats Not Modeled

These are attack surfaces introduced or amplified by v0.5.3 changes that have no corresponding entry in the threat model.

### N-THREAT-01 — Immutable i-Tag Fragmentation (Discovery)

| Adversary | Structural effect, exacerbated by Compromised Publisher |
|---|---|
| **Affected assets** | A1 Product events, A8 Canonical identifiers, A9 Binding topology |
| **Spec section** | §4.5 Indexer discipline |

**Problem.** v0.5.3 makes `i` tags immutable on root events (§4.5). To add or change indexers after publication, the root author must publish a new root event. This fragments product identity across multiple root events over time. Example: Infineon publishes Product `aaa111` with `cpe:m7794a12` and `cc:BSI-DSZ-CC-0814-2012`. Later, a new CVE affecting the chip is discovered. The vendor cannot patch the existing product to add `cve:CVE-20XX-XXXX` — they must publish `aaa222`, a new Product root with updated indexers. Now `aaa111`'s bindings (to old metadata, old CVEs) are on a different root than `aaa222`'s bindings. A user querying `#i:cpe:m7794a12` gets two product roots and must reconcile them. There is no protocol-level mechanism to declare `aaa222` as the successor to `aaa111` — no "supersedes," "replaces," or "next version" tag. The fragmentation is structural and grows with product age.

**Current mitigation.** The spec mentions this briefly (§4.5: "To add or change indexers after publication, publish a new root event") but provides no mechanism for linking roots across versions. Publishers can bind the new root to the old root, creating a chain of product versions. Multi-root discovery may be addressed by NIP-51 list events (listed in §11 Future Work).

**Gap.** No successor/predecessor linking mechanism exists in v0.5.3. Reliance on publisher discipline to create version bindings between product roots. Users searching by identifier may receive multiple product roots with no indication of which is current. A malicious publisher can fragment intentionally to hide unfavorable metadata (publish a "clean" new root and hope users find it instead of the original with vulnerability bindings).

**Residual risk: Medium.** Structural consequence of immutable i-tags. Bounded by publisher discipline and eventual NIP-51 list events (future). Discovery completeness depends on users searching broadly enough to find all roots.

---

### N-THREAT-02 — Loss of Structured Binding Semantics (Discovery)

| Adversary | Structural, exploited by Occasionally Lying Publisher |
|---|---|
| **Affected assets** | A3 Binding events, A9 Binding topology |
| **Spec section** | §4.3 Binding |

**Problem.** v0.5.3 removed ALL structured relationship labeling from bindings. The v0.5.2 model supported NIP-32 `L`/`l` labels with a defined vocabulary (`vulnerability`, `test`, `certification`, `audit`, `depends_on`, etc.) and allowed `t` tag hints for filtering. In v0.5.3, the binding tag schema is: `e root` + `e link`. The `content` field carries relationship semantics as free-form prose. This means:

1. **No relay-side relationship filtering.** You cannot query `#t:vulnerability` on `scrutiny-binding` events to find all vulnerability bindings for a product. The only query is `#e:<product-id>` which returns ALL bindings regardless of relationship type.
2. **No machine-parseable relationship vocabulary.** Automated tooling must parse `content` prose to classify relationship types. This is fragile, language-dependent, and publisher-dependent.
3. **Discovery degradation for specific relationship types.** "Show me certification bindings for this product" now requires fetching all bindings and parsing content or falling back to NIP-50 search.

**Current mitigation.** None at protocol level. The binding's `content` prose is the relationship descriptor. Implementations MAY parse content locally. The `#e` query returns all bindings for traversal.

**Gap.** The removal of structured semantics is a deliberate design choice to minimize protocol surface (principle 6), but it eliminates an entire class of cheap relay-side queries. The loss is structural and permanent unless structured hints are reintroduced. The gap between "minimalist design" and "usable discovery" widens as more binding types emerge.

**Residual risk: Medium.** Discoverability degradation for filtered binding queries. Not an integrity concern — bindings remain signed and attributable. The risk is that useful binding types are buried in content prose where relay-side filtering cannot reach them.

---

### N-THREAT-03 — e-Tag Dual-Endpoint Query Ambiguity (Discovery)

| Adversary | Structural |
|---|---|
| **Affected assets** | A3 Binding events, A9 Binding topology |
| **Spec section** | §4.3 Binding, §8.2 Traversal Flow |

**Problem.** In v0.5.3, both binding endpoints use `e` tags (markers `root` and `link`). The v0.5.2 model used `e` for the anchor and `q` for the linked endpoint, giving disjunct tag types for disjunct roles. Now a single `#e:<event-id>` query returns ALL bindings that reference that event, in any role. The client MUST:
- Filter results for `scrutiny-binding` `t` tags (non-SCRUTINY events also match `#e`)
- Inspect `e` tag markers to determine whether the matched event is root or link endpoint
- Handle the case where the same binding matches twice (if the queried event ID appears as both root and link, which shouldn't happen but isn't prevented by the protocol)

The spec notes this in §4.3: *"Results MUST be filtered for `scrutiny-binding` `t` tags, and the `e` tag markers (`root` vs `link`) inspected."* However, this adds per-result processing cost that scales with binding volume. A popular product with 500 bindings requires inspecting 500 events' tag markers to build metadata-to-product traversals.

**Current mitigation.** The spec explicitly documents the filtering requirement. NIP-01 compliant relays support `#e` queries. Client-side marker inspection is straightforward.

**Gap.** No relay-side mechanism to filter by marker type (no `#e_root` vs `#e_link` distinction). The per-result processing cost is unbounded. A client without proper marker inspection may misinterpret binding direction. Non-SCRUTINY-aware implementations querying `#e` will receive SCRUTINY binding results alongside general Nostr events and may misinterpret them.

**Residual risk: Low.** Processing cost and ambiguity are bounded by client-side filtering. The spec explicitly documents the requirement. The risk is implementation error in non-compliant clients, not a structural bypass.

---

### N-THREAT-04 — k-Tag Inconsistency (Data Integrity)

| Adversary | Compromised Publisher, Occasionally Lying Publisher |
|---|---|
| **Affected assets** | A8 Canonical identifiers |
| **Spec section** | §9 Canonical indexer registry |

**Problem.** v0.5.3 introduces the `k` tag as accompaniment to `i` tags, specifying the prefix kind (e.g., `["i", "cve:CVE-2024-X"]` paired with `["k", "cve"]`). The spec says: *"Each `i` tag SHOULD be accompanied by a `k` tag whose value matches the `i` prefix."* Since "SHOULD" is not "MUST," implementations must handle:
- Missing `k` tags (no prefix classification for an `i` tag)
- Mismatched `k` tags (e.g., `["i", "cve:CVE-2024-X"]` with `["k", "cwe"]`)
- Extraneous `k` tags with no matching `i` tag
- Multiple `k` tags with the same value (one per prefix kind — but nothing enforces this)

A naive implementation using `k` tags for classification without verifying the prefix match could misclassify identifiers. The mismatched `k` attack is cheap: the publisher constructs syntactically valid tags with no cryptographic violation.

**Current mitigation.** The `k` tag is informational. The `i` tag's prefix (everything before the first `:`) is trivially extractable: `iValue.split(':')[0]`. Implementations SHOULD extract the prefix from the `i` value directly rather than trusting the `k` tag. The `k` tag exists for relay-side convenience (avoiding prefix parsing in filter logic) but is not authoritative.

**Gap.** No MUST-level requirement for `k`-`i` consistency. No guidance on which is authoritative when they conflict (the `i` prefix or the `k` tag). Implementations that shortcut to `k`-based classification inherit publisher-controlled semantics.

**Residual risk: Low.** The `i` prefix is inherently extractable and SHOULD be used as the authoritative source. The `k` tag is a hint. Implementation error is the primary exposure.

---

### N-THREAT-05 — HALT Divergence Across Implementations (Data Integrity)

| Adversary | N/A (structural cross-implementation concern) |
|---|---|
| **Affected assets** | A6 Canonical chains, A7 Canonical views |
| **Spec section** | §5.3 Application |

**Problem.** §5.3's HALT-on-pre-validation-failure behavior is explicitly implementation-sensitive. The spec permits any unified-diff applier — git, jsdiff, Python difflib, Go diff libraries. These implementations may disagree on:
- Unicode normalization of diff content
- Tolerance for whitespace variations in context lines
- Handling of non-standard hunk formats
- Fuzzy matching behavior (some diff appliers are more permissive than others)

If implementation A applies patch P successfully (pre-validation passes) and implementation B rejects it (pre-validation fails), the two implementations compute different canonical views. Implementation A's patched content includes P's changes + all subsequent patches. Implementation B's patched content stops at the last successful patch before P. This is a stronger form of T-DI-02 (which deals with relay-divergent patch visibility). Here, both implementations see the same patch set but apply them differently.

**Current mitigation.** §5.3 specifies exact canonical-form requirements for diffs (headers, hunk format, context lines). §5.1 specifies exact normalization rules (LF line endings, UTF-8 without BOM, trailing newline). These reduce but do not eliminate cross-implementation divergence.

**Gap.** No reference implementation of the diff applier is specified as canonical. No conformance test suite for diff application exists (test vectors for this are in §11 Future Work). No mechanism for implementations to detect that their canonical view diverges from others'. The divergence is silent and self-consistent within each implementation.

**Residual risk: Medium.** Integrity of individual events is protected by signatures, but the computed canonical view — the entire point of the chain computation — can diverge across implementations. Risk increases with protocol adoption (more implementations, more edge cases). Bounded by diff-format specification rigor.

---

### N-THREAT-06 — Root Event Migration Race (Discovery/Topology)

| Adversary | Compromised Publisher, structural |
|---|---|
| **Affected assets** | A1 Product events, A3 Binding events, A9 Binding topology |
| **Spec section** | §4.5 Indexer discipline, §10 Kind 5 deletion |

**Problem.** When a root author publishes a new Product root (to add/change i-tags, per §4.5), there is a race condition between the publication of the new root and the community's binding activity. Specifically:
1. Vendor publishes `aaa111` (Product, old i-tags). Researcher publishes bindings to `aaa111`.
2. Vendor publishes `aaa222` (Product, updated i-tags). Vendor cannot migrate bindings — bindings are immutable and keyed to `aaa111`.
3. Researcher continues publishing bindings to `aaa111` because they discovered it first or their tooling caches it.
4. Vendor kind-5 deletes `aaa111` (per §10). All bindings to `aaa111` become orphaned. The knowledge graph for this product is now split across the orphaned `aaa111` bindings and the new `aaa222` root.

The vendor can attempt to publish a binding from `aaa222` to `aaa111` (or vice versa) to signal the relationship, but there is no protocol-level convention for "migration" or "supersedes" relationships. The community coordination problem — getting all binding authors to repoint to the new root — is entirely social.

**Current mitigation.** Bindings are preserved as orphaned annotations when the root is kind-5 deleted (§10). Historical audit state remains accessible. Multi-root discovery (future NIP-51) may address this. The spec acknowledges the migration path implicitly (§4.5: "publish a new root event") but provides no migration mechanism.

**Gap.** No successor/predecessor convention between product roots. No mechanism for automated binding migration. No deprecation marker for old roots beyond kind-5 deletion (which orphans bindings). The protocol's append-only nature plus immutable i-tags creates an inherent tension: evolution fragments identity. A vendor maintaining a product for 10 years with periodic i-tag updates could accumulate dozens of product roots, each with its own set of bindings, none linked to each other.

**Residual risk: Medium.** Structural consequence of immutable i-tags + immutable bindings. The product identity fragmentation grows with product age. Mitigated only by publisher discipline (binding old roots to new roots) and community behavior (following the publisher's lead).

---

## Part 5 — Deferred Recommendations (R1–R5) Reevaluation

Review Pass 1 (v0.5.2 → v0.5.3) listed 5 deferred recommendations. Here's how v0.5.3 changes affect their urgency.

### R1: Define concrete graceful degradation behaviors (§8.0)

| Before v0.5.3 | After v0.5.3 | Verdict |
|---|---|---|
| Medium urgency | **Higher urgency** | **Escalate** |

**Reasoning.** v0.5.3 removed structured binding labels and the NIP-32 label system. With fewer structured tags to rely on, the fallback path (NIP-50 free-text search, content parsing) is more important than before. When a relay doesn't support `#i`, the degradation path is now: fall through to NIP-50 search or full scan. Without concrete degradation behaviors, implementations will invent their own — leading to inconsistent discovery across clients. Recommended: define a standard degradation cascade with explicit behaviors per capability gap.

### R2: Add NIP-11 to dependency table as OPTIONAL

| Before v0.5.3 | After v0.5.3 | Verdict |
|---|---|---|
| Medium urgency | Unchanged | **Maintain** |

NIP-11 is referenced only in the PoW paragraph and the discovery degradation flow (checking relay NIP support). v0.5.3 didn't change NIP-11's role. The recommendation stands.

### R3: Add imeta key-ordering normalization (§5.1)

| Before v0.5.3 | After v0.5.3 | Verdict |
|---|---|---|
| Medium urgency | **Lower urgency** | **De-escalate** |

**Reasoning.** In v0.5.2, patches could modify the imeta surface via diffs, making imeta key ordering a cross-implementation concern during patch application. In v0.5.3, patches only modify `content`. The imeta surface is immutable after root publication (§4.5). This means imeta key ordering matters only for event creation (one-time), not for chain computation (repeated across implementations). The cross-implementation HALT divergence risk from imeta normalization is eliminated. Still relevant for event validation consistency, but less urgent.

### R4: Add i surface deduplication rule (§5.1)

| Before v0.5.3 | After v0.5.3 | Verdict |
|---|---|---|
| Medium urgency | **Lower urgency** | **De-escalate** |

**Reasoning.** In v0.5.2, patches could introduce new `i` tags via diffs, and multiple patches could introduce the same identifier, creating duplicates. In v0.5.3, i-tags are immutable on root events (§4.5). Duplicate i-tags can only come from the root event's original publication — a publisher error, not a chain-computation artifact. The deduplication concern is now a root-event validation concern (one-time) rather than a chain-computation concern (repeated). Still useful as a validation rule, but no longer affects canonical view computation.

### R5: MUST-level hash verification with bandwidth exception (§4.6)

| Before v0.5.3 | After v0.5.3 | Verdict |
|---|---|---|
| Medium urgency | Unchanged | **Maintain** |

v0.5.3 added a Security Note requiring MUST-level warnings for unverified artifacts. The core trade-off (MUST verification vs bandwidth) is unchanged. The recommendation stands.

---

## Part 6 — Additional Observations

### Trust model §7.5 language about patches modifying surfaces

The threat model's T-DI-02 description says *"Patches do not carry structured identifier or imeta tags"* which is now more true than ever — patches carry NO `i` or `imeta` tags (only `t` and `e`). But this wasn't updated from the old text. The sentence is accidentally correct but should be verified.

### Binding immutability clarification introduced no new threats

v0.5.3 added explicit immutability language to §4.3 ("Bindings have no patch-based update mechanism"). This is a clarification of existing semantics, not a new mechanism. No new threat introduced.

### DVM integration in future work

The threat model's T-EC-04 mentions that "deep semantics require protocol-aware processing" (now principle 3). The DVM (Data Vending Machine) integration in §11 Future Work — *"NIP-90 job requests for SCRUTINY-derived computations"* — would create new attack surfaces when implemented (rogue DVM providers returning fabricated summaries, job-request privacy leakage). Since DVM is future work, this is noted for the next threat model revision.

### Kind 1 namespace coupling (T-EC-03) worsened

v0.5.3 expanded the set of optional signals that operate on kind 1 events (NIP-18 reposts, NIP-25 reactions, NIP-57 zaps). These all share the kind 1 namespace with SCRUTINY events. A relay applying aggressive kind 1 rate-limiting now throttles not just SCRUTINY publication but also all signal events. The risk is slightly elevated from the v0.5.2 baseline. T-EC-03 should note this expansion.

---

## Part 7 — Recommended Actions

### Immediate (before v0.5.4 threat model revision)

| # | Action | Threat(s) |
|---|---|---|
| 1 | **Remove** T-DC-03, T-DC-04, and T-PI-04 from active threat model | Obsolete threats |
| 2 | **Rewrite** T-DI-04 to reflect loss of structured binding semantics | Current threat is stale |
| 3 | **Fix** section references in T-DI-06, T-ID-03, T-AV-03, T-AV-04, T-EC-04 | Stale references |
| 4 | **Add** N-THREAT-01 (i-tag fragmentation), N-THREAT-02 (loss of binding semantics), N-THREAT-05 (HALT divergence) | New high/medium risks |
| 5 | **Elevate** R1 urgency (graceful degradation) | v0.5.3 increased dependence on fallback paths |

### v0.5.4 threat model revision

| # | Action | Threat(s) |
|---|---|---|
| 6 | **Add** N-THREAT-03 (e-tag ambiguity), N-THREAT-04 (k-tag inconsistency), N-THREAT-06 (root migration race) | New low/medium risks |
| 7 | **Update** T-EC-03 to acknowledge broader kind 1 signal coupling | Minor escalation |
| 8 | **Update** T-AV-04 to remove obsolete attached-diff language | Stale language |
| 9 | **Reevaluate** all risk ratings against v0.5.3 changed mechanisms | Some may shift (T-DI-04: Low–Medium → Medium) |
| 10 | **Add** DVM and merge placeholder threats for §11 future work items | Forward-looking |

---

## Appendix A — Complete Section Reference Map

| Threat Model Reference | v0.5.3 Location | Status |
|---|---|---|
| §4.3 (`t` tags for relationship semantics) | §4.3 — no relationship t tags exist | ❌ STALE |
| §4.4.2 discipline | Does not exist | ❌ REMOVED |
| §4.4.1 mirroring | Does not exist | ❌ REMOVED |
| §4.5 imeta | §4.6 Payload attachments | ❌ RENUMBERED |
| §4.5 imeta recommendation | §4.6 Payload attachments | ❌ RENUMBERED |
| §4.3 snapshot tags | Does not exist (moved to §11) | ❌ REMOVED |
| §2 principle 4 (T-EC-04) | §2 principle 3 | ❌ RENUMBERED |
| §5.2 lookup | §5.2 Encoding | ✓ VALID |
| §4.4 prose-only definition | §4.4 Patch | ✓ VALID |
| §7.2 fork resolution | §7.2 Forks | ✓ VALID |
| §7.4 chain computation | §7.4 Computing patched content | ✓ VALID |
| §10 kind 5 deletion | §10 Kind 5 deletion | ✓ VALID |
| §7.5 trust model | §7.5 Trust model & assumptions | ✓ VALID |
| §6.1, §6.3–6.4 admission rules | §6.1, §6.3, §6.4 | ✓ VALID |
| §8.0 relay queries | §8.0 Assumptions | ✓ VALID |
| §8.3 | §8.3 Unsupported Query Types | ✓ VALID |
| §3.1 NIP dependencies | §3.1 Nostr NIP dependencies | ✓ VALID |