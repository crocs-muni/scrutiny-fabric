# Pass 1 — Critical Protocol Review: SCRUTINY Fabric v0.5.2

**Date:** 2026-05-09  
**Review scope:** `docs/protocol-spec.md` (888 lines)  
**Reference baseline:** `docs/SCRUTINY_threat_model_v0_5_1.md`  
**NIPs reviewed:** 01, 03, 09, 10, 13, 73, 92 (fetched from `nostr-protocol/nips` master)

---

## A. Critical Issues

Protocol-level bugs, contradictions, or undefined behavior that materially affect correctness.

---

### A1. §3.1 / §9.4 — NIP-73 `k` tag omission (MANDATORY dependency incompleteness)

**Description:** SCRUTINY declares NIP-73 as a MANDATORY dependency and relies on `#i` relay filter indexing. However, NIP-73 specifies that `i` tags are used *with* `k` tags representing the external content ID kind, so that clients can query all events for a specific kind of identifier. SCRUTINY never emits `k` tags on any event type. The spec does not acknowledge this deviation.

While `#i` relay indexing works on `i` tag values alone (per NIP-01's single-letter tag indexing convention), the omission of `k` tags means:
- NIP-73-compliant relays/indexers expecting `k` tags alongside `i` may misinterpret SCRUTINY events.
- Clients cannot filter `#i` results by identifier kind (e.g., "only CVE identifiers") without local post-processing.

**Proposed fix:** Add `k` tags alongside `i` tags, or add an explicit note in §3.1 documenting the intentional deviation and why it's acceptable.

**Impact if not fixed:** Low functional impact (relay indexing works without `k`), but the spec claims NIP-73 as MANDATORY while only partially implementing it — a correctness claim that doesn't hold under audit.

---

### A2. §5.1 — Imeta surface serialization is underspecified (non-determinism risk)

**Description:** The imeta surface serializes each `imeta` tag as "the space-joined inner values of the tag (everything after the `'imeta'` tag name), preserving their original order within the tag." However, NIP-92 does not mandate key ordering within an `imeta` tag. A relay or client may re-serialize the tag array in a different order (e.g., alphabetically sorting keys), producing a different line string for the same semantic imeta entry.

If a patch producer writes a diff against the imeta surface using key order A, and a consumer has re-serialized the same event using key order B, the diff's hunk context won't match — causing HALT. The canonical-form normalization (§5.1) addresses line endings and encoding but does NOT normalize imeta key ordering.

**Proposed fix:** Add an imeta key-ordering normalization rule: keys within each `imeta` entry MUST be sorted alphabetically by key name before serializing to the `imeta` surface.

**Impact if not fixed:** Cross-implementation incompatibility. Two correct implementations can produce divergent imeta surfaces from the same event, leading to HALT divergence on diffs touching the imeta surface.

---

### A3. §5.1 / §5.3 — `i` surface allows duplicates; no deduplication rule

**Description:** The `i` surface is defined as "one identifier per line, sorted by byte-wise comparison." It does NOT specify that lines must be unique. A patch diff that adds an identifier already present in the surface produces a duplicate line. A patch that adds an identifier, then a later patch adds the same identifier again, produces two copies. The spec does not address this.

Consequence: A canonical view can have duplicates in the `i` surface. This:
- Changes the byte representation and sort position of other identifiers (pushing them down a line).
- Makes subsequent patches harder to write (producers must account for variable surface size).
- Has no clear semantic meaning for discovery (duplicate identifiers in the canonical view are noise).

**Proposed fix:** Add a rule: "The `i` surface MUST be deduplicated after each patch application. If a patch diff produces duplicate lines, the first occurrence is retained." Or: prohibit diffs from duplicating identifiers (producer responsibility).

**Impact if not fixed:** Canonical views with duplicate `i` entries are semantically confusing and degrade the discovery value of the `i` surface. Subsequent patches that reference line numbers in the `i` surface may have unexpected behavior.

---

### A4. §5.3 step 5 — HALT creates a permanently frozen chain if root author loses key

**Description:** When `git apply --check` fails on a patch, HALT stops chain computation at the last valid patch. Recovery requires the root author to kind-5-delete the invalid patch (§10). If the root author loses their private key (T-ID-01), the chain is permanently frozen — no further canonical patches can apply, and the root author cannot delete the blocking patch. Foreign disputes can still be published but never enter the canonical chain.

This is a single-point-of-failure tied to the root author's key availability. In a security-metadata protocol where patches convey vulnerability fixes, finding updates, or certification changes, a frozen chain means the canonical view stagnates permanently.

**Proposed fix:** Two options:
1. (Weaker) Document this as a known limitation in §5.3 and reference T-ID-01.
2. (Stronger) Allow clients to skip invalid patches (with a permanent warning annotation) rather than HALT, applying valid patches that follow. This changes the semantics from "git apply --check" to "git apply --check --continue-on-error."

**Impact if not fixed:** A single malformed patch from a root author who later loses their key permanently freezes the canonical view. The spec currently says "HALT is reevaluated whenever the chain topology changes" — but without the root author's key, topology cannot change.

---

### A5. §7.2 — `created_at` fork resolution is unbounded (future timestamps)

**Description:** Fork resolution selects the tip with the latest `created_at`. A publisher can set `created_at` to a far-future value (e.g., year 2200), making their tip the permanent default head — no future patch (even with a correct timestamp) can overtake it. The spec acknowledges `created_at` manipulation in §7.2 and via T-DI-01, but the threat model identifies no defense against future timestamps specifically (OTS only helps with backdating, not post-dating).

OTS (NIP-03) provides Bitcoin-confirmed timestamps that are always ≤ real time, so OTS-protected patches are bounded. But in the absence of OTS, a future-timestamped patch wins forever.

**Proposed fix:** Add a MUST-level rule: clients MUST reject patches whose `created_at` exceeds the client's current wall-clock time by more than a tolerance (e.g., 24 hours). Or: add a "max `created_at`" filter to the canonical view computation that caps timestamps to the current time.

**Impact if not fixed:** Unaddressed. T-DI-01 covers backdating but not post-dating. A single future-timestamped patch can permanently seize default-head status.

---

### A6. §10 — Product identity rotation via root deletion (binding-breaking attack)

**Description:** A vendor publishes Product-P (event ID `aaa111`). A researcher publishes a vulnerability binding connecting CVE-X to `aaa111`. The vendor kind-5-deletes `aaa111` and publishes a new Product event `aaa222` with identical content but a different event ID. All bindings pointing to `aaa111` become orphaned. The vendor has effectively severed all established connections without modifying the binding events.

This is a legitimate attack not covered by T-DI-03 or T-PI-04. The threat model addresses deletion suppression but not *intentional root deletion as a binding-breaking primitive*. The vendor controls root deletion (it requires the vendor's key), and the vendor has incentive to suppress negative findings.

**Proposed fix:** Add a product-identity continuity rule: Product events that are kind-5-deleted and then republished with identical `i` tag sets within a time window SHOULD be flagged by clients as potential identity rotation. Or: require snapshot pins on bindings to include the root event ID, making the historical connection verifiable.

**Impact if not fixed:** A vendor can rotationally delete and republish products to break all negative bindings. This is a structural asymmetry: binding authors invest in creating edges; root authors can unilaterally dissolve them.

---

### A7. §7.5 — Missing explicit signature verification requirement

**Description:** The canonical view computation (§7.5) walks patches and applies diffs. It does not explicitly state that event signatures MUST be verified before any event is processed. While signature verification is implied by Nostr (NIP-01) and the trust model (§2.1), §7.5's chain construction algorithm is the point where corrupted, unsigned, or forged events would enter computation.

A relay serving a patch event whose signature doesn't match (bit-flipped content, truncated fields) would pass through without signature check. The diff pre-validation (§5.3) would catch most corruption, but a carefully crafted event with invalid signature but valid diff structure could slip through.

**Proposed fix:** Add to §5.3 step 3: "Each patch event's Nostr signature MUST be verified against its pubkey before the event is admitted to the canonical chain."

**Impact if not fixed:** Low immediate risk (relays have incentive to serve valid events; corrupted events typically fail diff parsing). But a spec-level gap — signature verification is the foundation of the integrity goal (G1).

---

## B. Attack-Surface Findings

Exploitable gaps organized by attacker model. Threat model references are from `SCRUTINY_threat_model_v0_5_1.md`.

---

### B1. Root Author Attacks

| # | Attack | Current defense | Gap | Severity |
|---|---|---|---|---|
| B1.1 | **Post-dated fork seizure** — publish a fork tip with `created_at` = year 2200, permanently win default-head | OTS (MAY) bounds timestamps; tie-break on event ID | No defense against future timestamps in absence of OTS. A single post-dated patch wins fork resolution forever. | **High** (extends T-DI-01) |
| B1.2 | **Identity rotation** — kind-5-delete root, republish with new event ID, breaking all bindings | None. Bindings become orphaned per §10. | Root authors can unilaterally dissolve all established connections. No protocol-level continuity check. | **Medium** |
| B1.3 | **Chain freezing** — publish a deliberately invalid patch, then lose the key | HALT cascade stops at invalid patch; recovery requires kind-5-delete from root author | No recovery path if root author loses key. Chain permanently frozen. | **Medium** |
| B1.4 | **Mirror suppression** — publish patch with correct diff but omit mirrored `i` tags for unfavorable identifiers | Client must resolve patch to root and verify (§8.3). But this only catches stale references, not never-mirrored introductions. | Identifier exists in canonical view but is invisible to `#i` queries. | **Medium** (T-DC-03) |

---

### B2. Relay Attacks

| # | Attack | Current defense | Gap | Severity |
|---|---|---|---|---|
| B2.1 | **Selective kind-5 suppression** — omit deletion events, leaving deleted patches in chain | Multi-relay querying; local kind-5 caching (§10) | NIP-09 honoring is optional at relay layer. A single-relay user sees a forged canonical view. | **Medium** (T-DI-03) |
| B2.2 | **Event corruption** — flip bits in event content; signature mismatch | None specified in §7.5 (no explicit signature check) | HALT catches most corruption, but crafted corruption with valid diff structure could slip through without explicit signature check. | **Low** |
| B2.3 | **Split-world imeta** — serve different URLs for same `x` hash to different clients | Hash verification confirms content integrity, not URL identity | Two clients fetch different URLs, each verifying against its own fetched content. Both see consistent views but different artifacts. | **Medium** (T-DI-06) |
| B2.4 | **Relay result ordering** — serve patch events in wrong temporal order, causing chain construction to select wrong tip | Chain is reconstructed from `e reply` markers, not relay order | No gap. This is handled correctly by the spec. | **None** |

---

### B3. Binding Author Attacks

| # | Attack | Current defense | Gap | Severity |
|---|---|---|---|---|
| B3.1 | **Bogus bindings** — reference nonexistent event IDs in `e root` or `e link` | Clients query their relay set for referenced events. Unfindable events produce orphaned bindings. | No explicit handling. Orphaned bindings silently degrade discovery. | **Low** |
| B3.2 | **Relationship laundering** — label `relationship:fix` in `i` tag, describe vulnerability in `content` | `content` is authoritative (§9.4). Clients MAY flag discrepancies. | Automated tooling consuming `i:relationship:*` hints inherits the ambiguity. | **Low–Medium** (T-DI-04) |
| B3.3 | **Graph flooding by trusted author** — a TRUSTED binding author creates thousands of noise bindings | Trust filtering doesn't help (author is trusted). §6.3 admits all bindings from trusted authors. | No fan-out limit. No semantic quality gate. Trust is binary — the author either passes or doesn't. | **Medium** (extends T-AV-02) |
| B3.4 | **Snapshot pin staleness** — bindings reference patches long since superseded | Client SHOULD render warnings (§10) | No automated staleness reassessment. Stale bindings persist indefinitely. | **Medium** (T-PI-04) |

---

### B4. Sybil / Amplification Attacks

| # | Attack | Current defense | Gap | Severity |
|---|---|---|---|---|
| B4.1 | **WoT poisoning** — place Sybil keys in follow lists of seed pubkeys | Trust filtering; SHOULD-level expansion warning (§2.1) | No depth weighting; N=1 expansion treats all follows equally. | **Medium** (T-ID-02) |
| B4.2 | **Identifier squatting** — publish events claiming well-known `cve:`, `cpe:` identifiers before legitimate authority | Trust filtering | No cross-reference with authoritative registries; no priority for real authority keys. | **Medium** (T-ID-03) |
| B4.3 | **Default trust list compromise** — tampered client builds seed attacker keys into bootstrap | Multiple bootstrap paths; community detection | No signing/versioning/attestation for default trust lists; maximum vulnerability at genesis. | **High** (T-EC-02) |

---

## C. Simplicity Candidates

Mechanisms that could be removed, merged, or simplified.

---

### C1. §4.4 — Prose-only patches (remove)

**What:** A patch event with neither inline nor attached diff. Participates in chain topology without modifying surfaces.

**Why removable:** The stated purpose (administrative notes, deprecation announcements, version statements) can be achieved by:
- A normal patch with a `content`-only diff that adds a note to the `content` surface.
- A `scrutiny-patch` with an empty/identity diff.

**What's lost:** ~20 lines of spec text. The explicit concept of a "non-mutating patch." Publishers would need to construct identity diffs instead of zero-diff events.

**Recommendation:** **Remove.** Prose-only patches add an edge case to the lookup order (§5.2 step 3) and the application loop (§5.3 step 3). The threat model identifies them as a chain-length amplification vector (T-AV-05). Replacing them with identity diffs eliminates an event type variant without any semantic loss.

---

### C2. §5.1 / §5.3 — Patch mutations of `imeta` surface (remove)

**What:** Patches can modify `imeta` attachments (add, remove, replace) through diffs targeting the `imeta` surface.

**Why removable:** The `imeta` surface is the most fragile of the three surfaces due to key-ordering non-determinism (A2). Attachment management at the patch level adds complexity disproportionate to its value. In nearly all use cases, attachment updates happen at the root event level (a vendor publishes a new SBOM as a new Metadata event, not as a patch to an old one). If attachment mutations are needed, the root author can kind-5-delete the old Metadata event and publish a replacement.

**What's lost:** ~35 lines. The ability to evolve attachments through patches (e.g., replacing an old test report PDF with a new version on the same Metadata event). This use case is rare and can be served by publishing a new Metadata event.

**Recommendation:** **Restrict imeta to root events only (no patch mutations).** Reduces surface count from three to two (`content`, `i`), eliminates the imeta serialization ambiguity (A2), and simplifies diff application (§5.3).

---

### C3. §4.3 — Snapshot pins `root:rev` / `link:rev` (remove)

**What:** Optional binding tags pinning an endpoint to a specific patch event ID, expressing "I evaluated this connection against state X."

**Why removable:** The binding author's `created_at` already timestamps the binding. The canonical chain history can be reconstructed at any point. Clients can compare the binding's timestamp against the chain's state at that time. Snapshot pins add markup complexity, staleness risk (T-PI-04), and edge cases in retraction handling (§10).

**What's lost:** ~25 lines. The explicit "evaluated-against-state-X" attestation. Historical forensic value (knowing exactly which patch was current when the binding was made).

**Recommendation:** **Remove.** The binding's `created_at` is sufficient to correlate with chain state. The `root:rev`/`link:rev` concept adds complexity for a feature whose primary value (forensic correlation) is achievable through timestamp matching.

---

### C4. §7.4 — Cherry-pick attribution (remove from normative spec)

**What:** A patch can include `e` tags with marker `cherry-pick` referencing a source patch. Purely informational — appliers do not consult the source.

**Why removable:** The `cherry-pick` tag provides no normative function (appliers ignore it). A root author can acknowledge the source in `content` prose. The dedicated markup adds ~20 lines of spec text for a non-functional feature.

**What's lost:** Machine-readable attribution of diff sources. Automated credit tracking. The threat model identifies T-DI-05 (cherry-pick attribution laundering) — removing the mechanism removes the attack surface.

**Recommendation:** **Remove.** Move to future work as noted in §11's "Cherry-pick beyond attribution." The informational-only design is honest about the mechanism's limits, but those limits make it a non-feature. A prose acknowledgment in `content` serves the same purpose with zero spec overhead.

---

### C5. §4.3 / §9.4 — `relationship:` prefix on binding `i` tags (consider replacing)

**What:** A SCRUTINY-internal `i` tag prefix (`relationship:vulnerability`, `relationship:certification`, etc.) for relay-level filtering of binding semantics.

**Why reconsider:** The `relationship:` prefix is a SCRUTINY convention, not an external content ID. NIP-73 is designed for "established global content identifiers" (ISBN, DOI, ISAN). Using the `i` tag for internal relationship semantics:
- Blurs the line between external identifiers (NIP-73's purpose) and SCRUTINY's internal graph semantics.
- Creates a `content`-vs-hint mismatch (T-DI-04).
- Could be replaced by a dedicated SCRUTINY tag (e.g., `["rel", "vulnerability"]`).

**What's lost:** Relay-level `#i` filtering by relationship type without parsing `content`. ~10 lines of spec text.

**Recommendation:** **Keep for now but consider a dedicated `rel` tag in v053.** The `#i` relay filtering is genuinely valuable ("show me all vulnerability bindings"). But the mechanism shouldn't overload NIP-73's `i` tag. A dedicated tag (e.g., `["rel", "vulnerability"]`) would require relays to index `#rel`, which is an adoption hurdle. Keep `relationship:` on `i` as a transitional convention and add future work for a dedicated `rel` tag.

---

### C6. §8.0 — Relay capability table (trim)

**What:** A 20-line table mapping relay capabilities to NIPs, required operations, and fallback strategies.

**Why trim:** The table is useful but verbose. The same information exists in prose form in §8.0's surrounding paragraphs. The table could be shortened or merged with the fallback descriptions.

**What's lost:** Quick-reference format. ~10 lines if reduced to a concise list.

**Recommendation:** **Light trim.** Keep the table structure but reduce each row to one line. The information density is high and useful.

---

### C7. Appendix A — CLI (move to separate document)

**What:** ~25 lines describing the `scrutiny-fabric` CLI.

**Why removable:** The CLI is explicitly "not part of the protocol normative surface." Its presence in the spec adds length without normative weight. The CLI deserves its own README.

**Recommendation:** **Move Appendix A to a separate `docs/cli.md` or `README.md`.** Keep a one-sentence reference in the spec.

---

### C8. §4.3 — Relay hints paragraph (trim)

**What:** A 6-line paragraph about relay hints on `e` tags.

**Why trim:** The paragraph says "clients MUST NOT rely on relay hints exclusively" three times in different phrasings, plus a long sentence about fallback strategy. The same rules are repeated in §8.0's fallback table.

**Recommendation:** **Reduce to 2 lines.** "The `<relay>` field in `e` tags is advisory per NIP-10. Clients query their configured relay set; relay hints are supplementary."

---

### Summary: Lines saved

| Candidate | Lines saved | Risk |
|---|---|---|
| Remove prose-only patches | ~20 | None (replaced by identity diffs) |
| Restrict imeta to root-only | ~35 | Low (rare use case) |
| Remove snapshot pins | ~25 | Medium (forensic value lost) |
| Remove cherry-pick | ~20 | None (non-functional) |
| Move CLI to separate doc | ~25 | None (non-normative) |
| Trim relay hints | ~4 | None |
| Trim relay capability table | ~10 | None |
| **Total** | **~139** | **888 → ~749 lines** |

---

## D. NIP Correctness Findings

---

### D1. NIP-73 — `k` tag omission (high)

**NIP:** NIP-73 (External Content IDs)  
**SCRUTINY usage:** `i` tags on all event types for canonical identifiers (`cve:`, `cpe:`, `purl:`, `cc:`, `fips:`, `fcc-id:`, `swid:`, `gtin:`, `relationship:`). Declared MANDATORY dependency.  
**Intended NIP semantics:** NIP-73 defines `i` tags with paired `k` tags representing the external content ID kind (e.g., `["i", "isbn:9780765382030"]` with `["k", "isbn"]`). The `k` tag enables clients to query all events of a specific ID kind.  
**Mismatch:** SCRUTINY never emits `k` tags. It defines its own prefix registry (§9.4) that is separate from NIP-73's predefined types (isbn, doi, geo, iso3166, isan, podcast:guid, etc.).  
**Recommendation:** Either add `k` tags alongside `i` tags (e.g., `["k", "cve"]` alongside `["i", "cve:CVE-2017-15361"]`), or add a §3.1 note documenting the intentional deviation and why omission is acceptable. The `k` tag is optional in NIP-73; its omission is not a protocol violation, but claiming NIP-73 as MANDATORY while not following its conventions is misleading.

---

### D2. NIP-73 — Custom prefix registry (medium)

**NIP:** NIP-73 (External Content IDs)  
**SCRUTINY usage:** Custom prefixes `cve`, `cpe`, `purl`, `cc`, `fips`, `fcc-id`, `swid`, `gtin`, `relationship`  
**Intended NIP semantics:** NIP-73 defines a closed set of supported ID types. It does not provide a mechanism for registering new prefixes.  
**Mismatch:** SCRUTINY extends NIP-73's `i` tag with domain-specific prefixes that are not in NIP-73's registered table. This is a pragmatic extension — NIP-73's ID types (ISBN, DOI, geohash, etc.) are media-oriented and don't serve the security domain. The extension is valid usage of the `i` tag (NIP-01 allows arbitrary tag values), but calling it "NIP-73" is imprecise.  
**Recommendation:** Re-label the dependency: "SCRUTINY uses `i` tags with `#i` relay indexing (enabled by NIP-01's single-letter tag indexing convention). The `i` tag format is modeled on NIP-73's `<prefix>:<value>` convention but defines its own prefix registry."

---

### D3. NIP-92 — `imeta` URL-in-content requirement (low)

**NIP:** NIP-92 (Media Attachments)  
**SCRUTINY usage:** `imeta` tags for attached payloads (SBOMs, advisories, diffs)  
**Intended NIP semantics:** "Each `imeta` tag SHOULD match a URL in the event content." Clients MAY replace imeta URLs with rich previews. The `imeta` tag is for inline media in text notes.  
**Mismatch:** SCRUTINY uses `imeta` for general-purpose file attachments that may not be referenced in `content`. NIP-92 also says "There SHOULD be only one `imeta` tag per URL." SCRUTINY doesn't enforce this.  
**Recommendation:** Minor. The use of `imeta` for file attachments is within the tag's intended scope (NIP-92 says "Media attachments (images, videos, and other files) may be added to events"). Add a note in §9.2 acknowledging the NIP-92 URL convention and explaining that SCRUTINY's `imeta` usage extends it for payload attachment.

---

### D4. NIP-09 — Deletion vs. retention tension (medium; corresponds to T-PI-02)

**NIP:** NIP-09 (Event Deletion Request)  
**SCRUTINY usage:** Kind 5 deletion with topology cascade (§10). Relay policy: "SHOULD store both deletions and originals."  
**Intended NIP semantics:** "Relays SHOULD delete or stop publishing any referenced events that have an identical pubkey as the deletion request." NIP-09 also says "Relays SHOULD continue to publish/share the deletion request events indefinitely."  
**Mismatch:** SCRUTINY's relay policy ("SHOULD store both") contradicts NIP-09's ("SHOULD delete or stop publishing" the target). NIP-09 gives relays the option to physically delete the target; SCRUTINY asks them not to. The spec acknowledges this as a tension ("NIP-09 makes honoring optional at the relay layer").  
**Recommendation:** This is a known and accepted tension (T-PI-02). Add a sentence in §10: "SCRUTINY's recommendation to retain both deletion and target events is an intentional deviation from NIP-09's suggestion that relays 'SHOULD delete' the target. SCRUTINY's auditability goal (G6) requires event retention; generic Nostr clients remain unaffected."

---

### D5. NIP-10 — Threading repurposed as commit lineage (low)

**NIP:** NIP-10 (Text Notes and Threads)  
**SCRUTINY usage:** `e root` = root Product/Metadata; `e reply` = parent in patch chain  
**Intended NIP semantics:** `e root` = root of reply thread; `e reply` = direct parent in discussion thread. For threaded social conversations.  
**Mismatch:** SCRUTINY repurposes threading markers as commit lineage. This is an intentional design choice ("Stay Nostr-native" — principle 1). Generic NIP-10 clients see a reply thread; SCRUTINY clients see a commit chain.  
**Recommendation:** No change needed — this is by design. The SCRUTINY-specific `t` tags (`scrutiny-patch`) disambiguate for SCRUTINY-aware clients. The dual interpretation is a feature (principle 2: "Render informatively in any client").

---

### D6. NIP-01 — Kind 1 namespace sharing (medium; corresponds to T-EC-03)

**NIP:** NIP-01 (Basic Protocol)  
**SCRUTINY usage:** All SCRUTINY events use `kind: 1` (short text note)  
**Intended NIP semantics:** `kind: 1` is for social text notes. NIP-10 defines `kind: 1` as "a simple plaintext note."  
**Mismatch:** SCRUTINY packs structured protocol data (diffs, identifiers, attachment metadata) into `kind: 1` events. This is technically valid (NIP-01 allows arbitrary `content` and `tags`), but relay operators applying `kind: 1`-specific policies (rate limiting, content-length caps, deprioritization) cannot distinguish SCRUTINY traffic from social posts.  
**Recommendation:** Acknowledge as a design trade-off in §3.1. The `t` tags (`scrutiny-fabric`) provide the best available disambiguation. Consider recommending SCRUTINY-aware relays to inspect `scrutiny-fabric` `t` tags before applying `kind: 1` rate limits. This is already partially covered in §8.0.

---

## E. Additional Findings (Edge Cases)

---

### E1. Diff lookup order is vulnerable to inline/attached ambiguity

**§5.2** specifies: scan for inline ```` ```diff ```` blocks first; if none, scan `imeta` for `text/x-diff` attachments; if none, prose-only. But a publisher could include BOTH an inline diff AND an imeta-attached diff. The spec says inline wins (lookup order step 1). But what if they disagree? The inline diff (the winning one) is signature-protected; the attached diff may differ due to host compromise (T-DI-06). The spec correctly handles this by preferring the inline path, but doesn't explicitly warn clients that an imeta-attached diff present alongside an inline diff is ignored and may be stale/malicious.

**Recommendation:** Add a sentence to §5.2: "If both inline and attached diffs are present, the inline diff is authoritative and the attached diff is ignored."

---

### E2. Patch event's `created_at` vs chain ordering

The canonical view applies patches "in chain order from root to default head" (§7.5). Chain order is determined by `e reply` lineage (parent → child), NOT by `created_at` timestamp. This is correct — the reply marker defines the chain, `created_at` is only used for fork resolution. But §4.4 doesn't explicitly state this. A reader might assume patches are applied in `created_at` order. The spec mentions it implicitly in §7.5 but could be clearer.

**Recommendation:** Add to §4.4: "Patch ordering within a chain is determined by NIP-10 `e reply` markers (parent → child lineage), NOT by `created_at` timestamps. `created_at` is used only for fork resolution (§7.2) when multiple tips exist."

---

### E3. Binding `e` tag format doesn't include `root` marker in the conventional sense

§4.3 defines the binding as having `e root` (anchor) and `e link` (linked endpoint). NIP-10 defines `e root` as "the root id of the reply thread." In a binding, `e root` is NOT the root of a thread — it's the anchor endpoint of a directed edge. This is a semantic overload: `root` means "the thing being pointed AT" in SCRUTINY bindings, but "the origin of the thread" in NIP-10.

For patches, the `e root` usage matches NIP-10 (the root Product/Metadata event is the "root of the reply chain"). For bindings, it does NOT match — the anchor endpoint is not a "root" in the threading sense. A binding is not a reply thread.

This is the most significant NIP-10 semantic tension in the spec.

**Recommendation:** Consider renaming the binding's markers. Suggestion: `e anchor` and `e target` instead of `e root` and `e link`. But this loses relay compatibility (relays index `#e` without parsing markers). Keep the current format but add a note in §4.3 acknowledging the repurposing: "Binding `e root` usage repurposes NIP-10's threading marker for graph adjacency. This is intentional: relays index `#e` regardless of marker, enabling cheap discovery from either endpoint ( §8.1–8.2)."

---

## F. Summary of Recommended Actions

### Must-fix (correctness)
1. **A2** — Imeta key-ordering normalization rule
2. **A3** — `i` surface deduplication rule
3. **A5** — Future-timestamp rejection rule
4. **A7** — Explicit signature verification requirement in §7.5

### Should-fix (spec clarity)
5. **A1** — Document NIP-73 `k` tag deviation
6. **A4** — Document HALT/key-loss limitation
7. **E1** — Clarify inline-vs-attached diff precedence
8. **E2** — Clarify chain ordering (reply lineage, not `created_at`)
9. **E3** — Document `e root` semantic repurposing for bindings
10. **D1** — Add `k` tags or deviation note for NIP-73
11. **D3** — Add NIP-92 deviation note for imeta

### Consider for removal
12. **C1** — Remove prose-only patches
13. **C2** — Restrict imeta to root events
14. **C3** — Remove snapshot pins
15. **C4** — Remove cherry-pick from normative spec

### Threat model gaps to acknowledge
16. **B1.1** — Post-dated fork seizure (extend T-DI-01)
17. **A6** — Product identity rotation via root deletion