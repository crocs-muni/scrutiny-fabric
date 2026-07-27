# Pass 1 — Critical Protocol Review: SCRUTINY Fabric v0.5.3

**Date:** 2026-05-11  
**Review scope:** `docs/protocol-spec.md` (875 lines, post-fix)  
**Reference baseline:** `docs/SCRUTINY_threat_model_v0_5_1.md`  
**NIPs reviewed:** 01, 03, 09, 10, 13, 18, 25, 57, 73, 92 (fetched from `nostr-protocol/nips` master)  
**Spec versions compared:** v0.5.2 → v0.5.3  

---

## A. Critical Issues (Fixed)

Protocol-level bugs, contradictions, or undefined behavior that materially affect correctness. All items in this section were identified during review and fixed before this document was finalized.

---

### A1. §2 Principle 1 — NIP-34 referenced but not in dependency table (FIXED)

**Description:** Principle 1 cited *"NIP-34 git-style precedent"* as a Nostr-native mapping, but NIP-34 was absent from the §3.1 NIP dependency table. A reader looking for the full dependency surface would miss it.

**Fix applied:** Removed the NIP number from Principle 1. Principle 1 now reads *"git-style precedent"* without the NIP reference. NIP-34 is not a SCRUTINY dependency; git semantics are an implementation pattern, not a protocol dependency.

**Verification:** `rg NIP-34 docs/protocol-spec.md` returns zero matches.

---

### A2. §6.4 / §7.3 — Contradiction on dispute visibility (FIXED)

**Description:** §6.4 stated *"The user does NOT see disputes from third parties unless they separately trust those parties,"* which contradicted §7.3 and §7.4, both of which state that foreign patches (disputes) from trusted pubkeys render as overlay annotations. The user DOES see disputes — just not in the canonical view.

**Fix applied:** Rewrote §6.4 final sentence: *"The user does NOT see disputes in the canonical view; disputes from trusted third parties render as overlay annotations per §7.3."*

**Verification:** The paragraph now correctly distinguishes canonical-chain visibility from overlay-annotation visibility.

---

### A3. §10 — Relay policy for kind-5 deletion targets is underspecified (FIXED)

**Description:** §10 stated *"SCRUTINY relays SHOULD store deletion events alongside the originals."* But kind-5 events are `kind: 5`, not `kind: 1`, and do not carry `scrutiny-fabric` tags. A relay cannot distinguish a SCRUTINY-targeting kind-5 from a generic Nostr kind-5 without inspecting the `e` tag target.

**Fix applied:** Rewrote the relay policy paragraph: *"SCRUTINY-aware relays SHOULD inspect the `e` tag target of a kind-5 event; if the target event carries a `scrutiny-fabric` `t` tag, the relay SHOULD store the deletion alongside the original."*

**Verification:** The fix specifies the inspection heuristic (`scrutiny-fabric` on the target) that makes a relay "SCRUTINY-aware."

---

## B. Exploitable Gaps (Addressed)

Security-relevant gaps that are not outright bugs but create attack surface. All items addressed with spec text.

---

### B1. §4.5 — Imeta hash verification is SHOULD, not MUST (ADDRESSED)

**Description:** §4.5 said *"Implementations SHOULD verify the `x` hash."* Given that artifact substitution by a compromised Blossom host is a real attack (T-AV-04 in v0.5.1 threat model), SHOULD is too weak. A client that skips verification is trivially exploitable.

**Fix applied:** Added a **Security note** paragraph: *"Skipping hash verification removes the integrity guarantee entirely. Implementations MUST warn before displaying or processing unverified artifacts."*

**Rationale for not promoting to MUST:** Streaming hash verification may be bandwidth-prohibitive on mobile or low-bandwidth clients. The MUST-level warning preserves user agency while ensuring informed consent.

**Verification:** Security note is present at §4.5, line 303.

---

### B2. §7.5 — Key compromise paragraph omits chain/patch attack vector (ADDRESSED)

**Description:** The key-compromise paragraph focused on bindings: *"Bindings authored by pre-compromise keys remain signed by the legitimate author."* But post-compromise, the attacker can also publish **patches** on existing chains, kind-5-delete legitimate history, and manipulate canonical views — all far more damaging than fake bindings.

**Fix applied:** Expanded the paragraph to explicitly include: *"they can publish false patches on existing chains, kind-5-delete legitimate history, manipulate fork resolution via backdated timestamps, create bindings indistinguishable from genuine ones, and forge timestamp rankings."*

**Verification:** Paragraph now comprehensively covers all post-compromise attack vectors.

---

### B3. §4 — Event type tables omit universally required `t` tags (ADDRESSED)

**Description:** The §4.1–4.4 tables showed only event-type-specific tags (`content`, `i`, `k`, `imeta`, `e`). They omitted the three required `t` tags (`scrutiny-fabric`, `scrutiny-v053`, and the event-type tag) defined in §3. A naive implementer reading only the tables would produce invalid events.

**Fix applied:** Added a preamble to §4: *"All events in this section additionally carry the required `t` tags per §3 (`scrutiny-fabric`, `scrutiny-v053`, and exactly one event-type tag). The tables below show event-type-specific tags only."*

**Verification:** Preamble is present at §4, line 97.

---

## C. Observations & Notes

Items noted during review that do not require immediate action but are documented for future reference.

---

### C1. §8.0 "degrade gracefully" is undefined

**Observation:** §8.0 states *"Operations depending on optional capabilities MUST degrade gracefully"* but never defines what graceful degradation means for each optional capability (e.g., relay lacking `#i` support, relay lacking `#t` filtering, relay rejecting events >30KB).

**Assessment:** The user confirmed this is intentionally underspecified — the protocol has no power over generic Nostr relays. Graceful degradation is an implementation concern, not a protocol norm. No fix applied.

**Note for implementers:** A companion implementation guide should define concrete degradation behaviors (client-side filtering for unsupported relay filters, imeta fallback for oversized events, etc.).

---

### C2. `kind: 1` text-note foundation creates relay policy ambiguity

**Observation:** Because SCRUTINY events are `kind: 1`, general-purpose relays may apply rate-limiting or spam-filtering heuristics to SCRUTINY traffic without recognizing its semantic value. The spec correctly does not address whether relays SHOULD treat `scrutiny-fabric`-tagged `kind: 1` events differently.

**Assessment:** Out of scope for the protocol. Relay policies are operator decisions. The `scrutiny-fabric` `t` tag provides a voluntary signal relays MAY use.

---

### C3. Prose-only patches have no semantic enforcement

**Observation:** A patch with no inline diff is valid but carries no machine-verifiable payload. A malicious root author could publish a "prose-only" patch that claims to be an administrative note but contains misinformation. Since it's in the canonical chain, it affects chain history without changing surfaces.

**Assessment:** This is correct per the spec's design — interpretation of `content` is the consumer's job. The trust model (§6.3) filters by author trust, which is the intended defense.

---

### C4. `k` tag cardinality can be less than `i` tag cardinality

**Observation:** The tables state `k` is `0..64`, same as `i`. But if two `i` tags share the same prefix (e.g., two CVEs), there should be only one `k` tag per prefix kind. So `k` cardinality is ≤ `i` cardinality, not necessarily equal.

**Assessment:** Minor imprecision. The `0..64` upper bound is correct. The description *"One `k` tag per `i` prefix kind"* (line 115, 158) clarifies the semantics. No fix applied.

---

## D. Version Delta: v0.5.2 → v0.5.3

Structural and messaging changes between v0.5.2 and v0.5.3.

| Change | Section | v0.5.2 | v0.5.3 |
|---|---|---|---|
| **Trust model relocated** | §2.1 → §7.5 | Trust model was early in §2 | Moved to after chains (§7.5) |
| **Payload attachments moved** | §9.2 → §4.5 | External format strategy | Integrated under Event types |
| **Identifier discipline moved** | §9.3 → §4.4.2 | External format strategy | Integrated under Patch |
| **Prefix registry promoted** | §9.4 → §9 | Subsection of external format | Standalone registry section |
| **Free-form content deleted** | §9.1 | Redundant with §4 | Removed entirely |
| **Relay fallback table deleted** | §8.0 | Capability table + fallback advice | Single scoping paragraph |
| **Optional signals added** | §3.1 | NIP-13 only | NIP-13, NIP-18, NIP-25, NIP-57 |
| **Binding immutability clarified** | §4.3 | Brief immutability note | Added M:N clarification + dispute rationale |
| **DVM added** | §11 | Not present | Future work bullet |
| **AI/agent language purged** | Throughout | ~25 AI/agent references | Zero |
| **Client language minimized** | Throughout | ~60 client references | 2 intentional references |
| **Review fixes applied** | §2, §4, §4.5, §6.4, §7.4, §7.5, §10, Appendix B | Various issues | 10 fixes (see §A and §B) |

---

## E. Recommendations for Next Version

Items deferred to v0.5.4 or later.

| # | Item | Section | Rationale |
|---|---|---|---|
| R1 | Define concrete graceful degradation behaviors | §8.0 | Implementers need guidance; protocol should not mandate but should recommend |
| R2 | Add NIP-11 to dependency table as OPTIONAL | §3.1 | Referenced in PoW paragraph but absent from table |
| R3 | Add `imeta` key-ordering normalization to prevent HALT divergence | §5.1 | Cross-implementation risk on imeta patches |
| R4 | Add `i` surface deduplication rule | §5.1 | Prevents duplicate identifiers in canonical views |
| R5 | Consider MUST-level hash verification with bandwidth exception | §4.5 | Security vs. usability trade-off |

---

## F. Fixes Applied Log

| # | File | Line(s) | Change |
|---|---|---|---|
| F1 | protocol-spec.md | 24 | Removed NIP-34 reference from Principle 1 |
| F2 | protocol-spec.md | 446 | Fixed §6.4 dispute visibility contradiction |
| F3 | protocol-spec.md | 631 | Fixed §10 relay policy for kind-5 SCRUTINY targets |
| F4 | protocol-spec.md | 303 | Added security note on imeta hash verification |
| F5 | protocol-spec.md | 511 | Expanded §7.5 key-compromise attack vectors |
| F6 | protocol-spec.md | 97–100 | Added §4 preamble on required `t` tags |
| F7 | protocol-spec.md | 688 | "Clients render" → "Implementations render" (Appendix B) |
| F8 | protocol-spec.md | 83 | Rephrased NIP-11 reference in PoW paragraph |
| F9 | protocol-spec.md | 486 | Rephrased §7.4 CLI wording (non-normative) |
| F10 | protocol-spec.md | 629 | Expanded §10 kind-5-of-kind-5 note |

---

## G. Verification Checklist

- [x] Full spec read end-to-end (875 lines)
- [x] All cross-references validated (33 `§X.Y` references, all resolve)
- [x] All NIP dependencies verified against upstream specs
- [x] No broken section references (no `§2.1`, `§9.1–§9.4` remain)
- [x] No AI/agent language remains
- [x] Version tag consistency: `v0.5.3`, `scrutiny-v053`
- [x] All 10 review fixes applied and verified
- [x] No old version artifacts (`v0.5.2`, `v052`, `v0.5.1`, `v051`) in spec
- [x] Section structure validated (§1–§11 + Appendices A–D)

---

## H. Sign-off

**Review status:** Complete  
**Critical issues found:** 3 (all fixed)  
**Exploitable gaps found:** 3 (all addressed)  
**Fixes applied:** 10  
**Remaining open items:** 5 recommendations for v0.5.4+  
**Spec ready for test vectors:** Yes  
