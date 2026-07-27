# Prompt: SCRUTINY Fabric v0.5.1 Threat Model

## What you're doing

Write a complete, production-grade threat model for SCRUTINY Fabric protocol v0.5.1. Output to `docs/SCRUTINY_threat_model_v0_5_1.md`.

This document will be sent to CYBERNETICA AS (Estonian security consultancy) for professional review. They are not writing it — they are auditing yours. They wrote X-Road's security architecture, co-authored ETSI TS 102 165-1 (TVRA methodology), and use capability-based adversary modeling. They expect rigour.

---

## Source documents

You will receive three files:

1. **`protocol-spec.md`** — v0.5.1 spec. Your sole ground truth. Read it thoroughly.
2. **`SCRUTINY_threat_model_v2_1.md`** — The v0.4 threat model. Use only for depth calibration and structural inspiration. Everything in it assumes different protocol mechanics.
3. **This prompt.**

---

## Document structure — what sections to produce

### §1 · Scope

Define the system under analysis. Protocol version, in-scope components (the four event types, diff application, chain resolution, binding graph traversal, canonical view computation, trust admission rules, all seven NIP dependencies), out-of-scope boundaries (client implementations, relay internals, key storage, AI payload interpretation). State explicitly: no backwards compatibility with v0.4.

### §2 · Security goals

Table: Property → Description. Derive from the protocol's design principles (§2 of spec). Cover at minimum: integrity, authenticity, censorship resistance, trust separation, discoverability, auditability, portability.

### §3 · Assumptions & trust model

Align with the protocol spec's §2.1 trust model (added after this prompt — read it first). That section already declares the three actor archetypes, their capabilities and limits, Sybil resistance at WoT radius, honest-but-curious relay baseline, and key compromise consequences. Your §3 should expand on those statements with ETSI TVRA framing, not re-invent them.

### §3b · Asset inventory

One row per protocol-layer asset. Columns: Asset name, description, C / I / A / Au / NR flags. Cover at minimum: event signatures, event content, canonical identifiers (`i`), imeta attachments, binding edges, patch chains, chain topology, trust list state, canonical view, relay query results, OTS attestations, PoW nonces, deletion markers.

### §4 · Adversary archetypes

Carry forward the format from v0.4: named archetype → Capabilities column → Cannot Do column → Relevant Threats column. Re-evaluate every "can do" and "cannot do" against v0.5.1 mechanics — some vectors changed when structured labels, RetractionEvents, and dedicated kinds were removed.

Archetypes to cover: Malicious Relay Operator, Compromised Publisher, Network-Level Attacker, Hostile Vendor, Occasionally Lying Publisher, Misbehaving LLM, Compromised Developer, Infrastructure Impersonator, Product Impostor, Defaming Consumer, Spam/DoS Attacker.

### §5 · Risk scoring methodology

Qualitative: Risk = Impact × Likelihood. Four levels (Critical / High / Medium / Low), with range ratings where implementation-dependent. Define each level.

### §6 · Threats by category

This is everything. Write from scratch — do not copy from v0.4. Verify every claim directly against `protocol-spec.md`.

Use the existing per-threat format:
- **T<n> — <Name>**
- **Problem**
- **Mitigation in the design**
- **Not solved by the protocol**
- **Residual risk** (rating + rationale)

Organize threats into categories you determine. Reasonable starting points:

- **Data integrity** — timestamp forgery without OTS, fork resolution edge cases, retraction propagation gaps, imeta hash verification being optional, diff ordering ambiguities.
- **Identity & impersonation** — key compromise with no Nostr revocation, Sybil amplification through web-of-trust expansion, self-asserted identifier squatting, fake vendor identity with no in-protocol attestation.
- **Availability & DoS** — spam flooding, graph traversal amplification, event size approaching relay limits.
- **Discovery & indexing** — inconsistent relay NIP support (reference §8.0 of the spec for the documented fallback strategies), WoT bootstrap trap, relay censorship of specific events.
- **Censorship** — relay-level event suppression, eclipse attacks on relay sets, economic/legal coercion of operators.
- **Surveillance** — plaintext REQ filters revealing query interests, aggregate patterns exposing organizational tech stacks.
- **Ecosystem & operational** — client/indexer re-centralization due to graph computation cost, supply chain attacks on default trust lists, kind:1 namespace friction with social relays, stale data persistence in append-only chains.
- **Protocol interactions** — legal pressure vectors, NIP-09 cascade semantics vs audit trail preservation, cryptographic agility (secp256k1 + SHA-256 hardcoded).

**New v0.5.1-specific threats.** These have no precedent because v0.4 didn't have diffs, identifier mirroring, prose-only patches, snapshot pins, Blossom, or cherry-pick:

- Diff integrity in transit — an imeta-hosted diff that differs from what the publisher intended silently diverges the canonical view even with valid signatures.
- Identifier mirror desynchronization — mirrored `i` tags on patch events (§4.4.1) can omit or fabricate identifiers that don't match the actual diff content, misleading discovery queries.
- Prose-only patch abuse — valid empty patches consume chain topology and traversal budget without contributing state. An attacker who controls the root author key floods their own chain.
- Snapshot pin staleness — bindings pinned to now-retracted or since-evolved patch states carry no freshness guarantee beyond a client-side warning.
- Blossom split-world attack — hosting servers can serve different files to different requestors; SHA-256 catches it only if clients actually compute and compare.
- Cherry-pick attribution laundering — a root author can adopt a foreign dispute's diff as their own cherry-pick (§7.4), republishing disputed corrections under the root signature without acknowledging dissent.

### §7 · Residual risks & structural limitations

Enumerate trade-offs honestly. This is where CYBERNETICA judges whether you understand your own protocol. Every item should explain *why* it's unsolved — structural consequence of which design choice, inherited Nostr limitation, ecosystem maturity requirement — and what would need to change to solve it.

### §8 · Protocol/ecosystem boundary matrix

Table: Concern → Protocol responsibility → Ecosystem/client responsibility. Clarify where guarantees end and developer/user behaviour begins.

### §9 · Summary table

ID → Name → Problem → Mitigation → Gap → Residual Risk. Concise cross-reference to §6.

### §10 · Version delta from v0.4

Map old threat IDs to new fates: carried forward (modified), removed (eliminated by simplification), added (new to v0.5.1). A few obvious ones: RetractionEvent → kind:5 deletion (different authority model, different cascade), structured labels → free-form content (different injection vectors), many-NIPs → seven-NIPs (reduced dependency surface).

### §11 · Recommendation traceability matrix

Empty placeholder table (Rec #, Recommendation, Addressed Threats, Proposed Countermeasure, Priority). Include a note that this is populated after Cybernetica review. Add any pre-review recommendations you identify as a second row.

### §12 · Sources

Reference links to protocol-spec.md and all seven referenced NIPs plus any external standards you cite.

---

## How to approach this

The v0.4 document is roughly 740 lines and 32K words. Match or exceed that depth — shorter is not better when the reviewer audits for completeness.

For every threat you describe, ask yourself: could CYBERNETICA, reading just this entry, determine whether the risk rating is defensible? If the answer is no, add the rationale.

---

## Traps to avoid

1. **Do not propagate v0.4 assumptions.** Old traps you already know: RetractionEvents vs kind:5, structured labels vs free-form content, many-NIPs vs seven. New traps after recent spec edits: the spec now has explicit relay requirements (§8.0) and trust model (§2.1). Threats about relay behaviour should reference §8.0. Trust assumptions should align with §2.1's actor declarations.

2. **Distinguish MUST from MAY mitigations.** NIP-03 (OpenTimestamps) and NIP-13 (PoW) are MAY-level. A mitigation gated on voluntary adoption does not carry the same weight as a REQUIRED one. Residual risk ratings must reflect this.

3. **The `content` field is deliberately free-form.** Content injection and XSS are client-side concerns, not protocol gaps. Don't list them as protocol oversights — list them as boundary violations where client responsibility is required.

4. **All events are kind:1.** SCRUTINY shares relay namespace with every Nostr social post. Rate limiting, deprioritization, and storage policies affect all SCRUTINY events uniformly. Analyse this coupling honestly — it is the intentional trade-off for maximal relay compatibility.

5. **Every "not solved" must be actionable.** Don't say "unsolved." Say why — and what would need to change.

6. **Risk ratings must withstand cross-examination.** Erring toward over-rating is safer than under-rating, but don't inflate to avoid scrutiny. CYBERNETICA will spot both.

7. **Output clean markdown.** No preamble, no meta-commentary, no "here is the document." Just the document.