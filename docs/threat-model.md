# SCRUTINY Fabric — Threat Model

**Protocol version:** 0.5.3  
**Document status:** Draft  
**Methodology:** Qualitative risk assessment aligned with ETSI TS 102 165-1 (TVRA) capability-based adversary modeling

---

## §1 — Scope

This document provides a complete threat model for the SCRUTINY Fabric protocol v0.5.3. It identifies adversaries, enumerates threats against protocol-defined security goals, assesses residual risk, and distinguishes protocol-level mitigations from ecosystem responsibilities.

**In scope:**

- The four SCRUTINY event types (Product, Metadata, Binding, Patch) and their tag schemas (§4).
- The diff format, canonical-view computation, chain topology, fork resolution, and dispute overlay (§5, §7).
- Trust admission rules and graph traversal semantics (§6).
- Identifier mirroring, canonical identifier discipline, and discovery patterns (§4.4.1, §8, §9).
- Kind 5 deletion, topology cascade, and orphaned-state handling (§10).
- Attached payloads via imeta + Blossom (§4.5).
- Inherited Nostr protocol properties affecting SCRUTINY integrity, availability, and privacy.

**Out of scope:**

- Specific client implementations and UI rendering.
- Relay software internals beyond observable behavior per §8.0.
- Key generation, storage, and management practices.
- Transport-layer security (TLS downgrade, certificate validation, DNS poisoning).
- Legal and regulatory compliance (noted only where it intersects with protocol design in §§6.5, 6.8).
- Economic and social signal ranking algorithms (zaps, reposts, reactions) — client-layer interpretation.
- AI agent interpretation of payloads (delegated to client implementations; protocol is designed to be machine-processable).

---

## §2 — Security Goals

| # | Property | Description |
|---|---|---|
| **G1** | Integrity | Events are tamper-evident. Content, identifiers, and attachments are cryptographically bound to their signing pubkey. Patch chains produce deterministic canonical views; unauthorized modification invalidates signatures. |
| **G2** | Authenticity | Every event is attributable to a specific Nostr pubkey. Authorship is provable and non-repudiable. Attestations about products, metadata, and bindings are forensically traceable. |
| **G3** | Censorship Resistance | No single relay, vendor, or authority can suppress publication of valid events or prevent discovery of existing events. The protocol's multi-relay design and portable event format ensure that suppression at one point does not eliminate data from the network. |
| **G4** | Trust Separation | Each user selects their own trusted pubkey set. No global authority dictates which attestations are valid. Untrusted events are filtered before any processing occurs. A user's view of the graph is a function of their trust decisions alone. |
| **G5** | Discoverability | Given a canonical identifier (`cve:`, `cpe:`, `purl:`), a client can query relays and traverse bindings to find all affiliated security metadata visible within the user's trust perimeter. Identifier-based discovery is the protocol's primary value proposition. |
| **G6** | Auditability | Historical state remains recoverable. Canonical chain history is preserved through kind 5 retention policies. All mutations (patches, deletions) are signed and attributable. Snapshot pins provide verifiable historical references. |
| **G7** | Portability | Events are self-contained, replicable across any compliant Nostr relay, and transportable to external archives. No relay-specific state taints the event format. Artifact integrity is independently verifiable via SHA-256 hash. |

---

## §3 — Trust Model

SCRUTINY Fabric operates on top of public Nostr. Its trust model is declared in spec §7.5 and governs every admission rule, chain resolution procedure, and discovery pattern in the protocol. This section formalizes those declarations.

### 3.1 Actor Model

Three actor types participate in the protocol:

**Publishers** sign every event with their Nostr key. Cryptography guarantees: no other party can produce a valid signature for a publisher's pubkey; no party can modify a signed event without invalidating its signature; no party can delete another publisher's event (NIP-09 pubkey check). Publishers MAY lie about `created_at` — signing proves identity, not time. Root authors are sovereign over their product/metadata chains; they control the canonical history and can attempt backdating. Disputers cannot overwrite canonical state. Any pubkey can create Bindings — trust controls visibility, not existence.

**Relays** store and serve events, apply filters (`#t`, `#e`, `#i`), and propagate publications among peers. The baseline assumption is **honest but curious**: a well-behaved relay returns matching events and propagates publications. Relays MAY be malicious — they can omit results, serve stale data, drop filter support, or degrade into total non-response. The protocol's defense is multiplicity: query multiple relays, cache locally, cross-reference. No single relay is trusted with completeness.

**Query clients** maintain a trusted-pubkey set — an allowlist of Nostr identities whose attestations the user accepts. The trust mechanism is out of scope, but its existence is a hard protocol requirement: untrusted events are filtered before any processing (§6). Clients SHOULD query multiple relays and cross-reference results.

### 3.2 Derived Trust Properties

The following derive directly from spec §7.5:

- **Sybil resistance** is delegated to the user's web-of-trust. An attacker generating thousands of keys can flood the network with syntactically valid events. These enter a user's view only if the attacker's keys fall within the user's trust radius (direct trust or N-hop expansion). Wider expansion weakens resistance proportionally; a tightly curated allowlist strengthens it. Clients SHOULD warn when trust-radius expansion would admit a large number of previously unseen pubkeys.
- **Relay-level censorship** is mitigated by publishing to multiple relays and by Blossom-hosted payloads surviving relay takedowns. A hostile vendor can pressure relays to drop specific events; clients querying only pressured relays see a censored graph. No cryptographic mechanism prevents this — the defense is operational.
- **Key compromise** has no protocol-level remedy. If a root author's nsec leaks, the attacker inherits sovereignty over all chains originating from that pubkey. Bindings authored pre-compromise remain signed by the legitimate author; post-compromise bindings are indistinguishable. Recovery is social (announce, rotate key, rebuild trust).
- **Permissionless identity** means any pubkey can claim any real-world identity. The protocol delegates identity verification to out-of-band trust establishment. This is a design choice, not a defect — it enables permissionless participation at the cost of shifting verification burden to users.
- **Machine-processable design.** The protocol is designed to be machine-processable: events carry sufficient structure for automated agents (including AI agents) to discover, parse, and act on them without human intervention. This is an intentional design property, not a vulnerability.

### 3.3 Assumptions Underpinning the Threat Model

1. Cryptographic primitives (secp256k1 signatures, SHA-256 hashing) are computationally sound against non-quantum adversaries.
2. Clients correctly implement signature verification, trust filtering, and canonical-view computation per §5.3 and §7.4.
3. At least one honest relay exists in each user's configured relay set during normal operation.
4. Publishers control their own private keys; key hygiene is assumed absent explicit compromise.
5. The Nostr protocol ecosystem (NIP-01, NIP-09, NIP-10, NIP-13, NIP-18, NIP-25, NIP-57, NIP-73, NIP-92) remains stable within the evaluation horizon.

---

## §3b — Asset Inventory

The following assets represent what SCRUTINY Fabric protects. Columns: **C**onfidentiality, **I**ntegrity, **A**vailability, **Au**thenticity, **NR** = Non-Repudiation.

| # | Asset | Description | C | I | A | Au | NR |
|---|---|---|---|---|---|---|---|
| A1 | Product events | Signed root events identifying security-relevant targets | — | ● | ● | ● | ● |
| A2 | Metadata events | Signed root events carrying observations, findings, certifications | — | ● | ● | ● | ● |
| A3 | Binding events | Immutable directed edges connecting two events | — | ● | ● | ● | ● |
| A4 | Patch events | Diff-carrying replies forming canonical chains | — | ● | ● | ● | ● |
| A5 | Kind 5 deletion events | NIP-09 deletions triggering topology cascade or edge retraction | — | ● | ◐ | ● | ● |
| A6 | Canonical chains | Ordered sequences of root-author patches defining evolving state | — | ● | ● | ● | ● |
| A7 | Canonical views | Computed state (content, i-surfaces, imeta-surfaces) at chain tip | — | ● | ◐ | — | — |
| A8 | Canonical identifiers (`i` tags) | NIP-73 indexed values enabling relay-side discovery queries | — | ◐ | ● | — | — |
| A9 | Binding topology / relationship graph | Directed edges linking products to metadata | — | ● | ● | ● | — |
| A10 | Attached artifacts (imeta + Blossom) | External payloads referenced by SHA-256 hash | ◐ | ● | ◐ | — | — |
| A11 | Trust lists / WoT configuration | User-curated pubkey allowlists governing event admission | ○ | ● | ◐ | — | — |
| A12 | Pubkey-to-reputation mappings | Implicit associations between pubkeys and user-perceived trustworthiness | ○ | ● | ◐ | ● | — |
| A13 | Timestamp ordering claims | `created_at` fields, OTS proofs, fork-resolution rankings | — | ◐ | — | — | — |

**Legend:** ● = asset requires this property be maintained. ◐ = partial or situational requirement. ○ = confidentiality of trust lists may be desirable (operational security) but is not a protocol-level goal. — = not applicable.

---

## §4 — Adversary Archetypes

Each archetype describes a capability class. Archetypes are not mutually exclusive; a real-world entity may combine several. Every threat in §6 references one or more archetypes from this section.

### A1 — Malicious Relay Operator

| Capabilities | Cannot Do |
|---|---|
| Controls relay storage, serving logic, and filter implementation | Forge or modify signed events |
| Can censor, delay, reorder, or selectively serve events | Break TLS connections from other relays |
| Can observe all subscription filters, connection metadata, and query patterns | Prevent clients from querying alternative relays |
| Can drop NIP-specific filter support silently (e.g., `#i`) | Force clients to accept forged results (signatures protect integrity) |
| May operate under legal or economic pressure from third parties | Delete events permanently from relays they do not control |

### A2 — Compromised Publisher

| Capabilities | Cannot Do |
|---|---|
| Holds a valid Nostr private key (own or stolen) | Modify or forge events signed by other pubkeys |
| Can publish, patch, and kind 5-delete events authoritative to that key | Force relays to serve or suppress specific events |
| Can craft arbitrary `created_at` values | Bypass trust filtering on clients where the key is not trusted |
| Can create arbitrarily many keypairs for Sybil operations | Override the canonical chain of a product owned by a different pubkey |
| Inherits full sovereignty over all chains rooted at the compromised pubkey | Undo the cryptographic attribution of pre-existing events |

### A3 — Network-Level Attacker

| Capabilities | Cannot Do |
|---|---|
| Can intercept, drop, or redirect WebSocket connections | Break TLS without a compromised CA |
| Can isolate a client to a controlled relay set (eclipse) | Forge Nostr event signatures |
| Can perform traffic analysis on connection timing and volume | Read TLS-encrypted payloads |
| May control network infrastructure (ISP, corporate firewall, state-level) | Modify events in transit (TLS integrity protection). Prevent out-of-band relay discovery or cached-event verification |

### A4 — Hostile Vendor

| Capabilities | Cannot Do |
|---|---|
| Commercial entity whose product has unfavorable findings | Forge or modify signed events |
| Can exert economic pressure on relay operators (contracts, payments) | Prevent re-broadcast from relays outside legal jurisdiction |
| Can exert legal pressure (DMCA, cease-and-desist, trade secret claims) | Distinguish voluntary retraction from coerced retraction at protocol level |
| Can initiate lawsuits against individual publishers | Suppress events stored on Blossom hosts beyond legal reach |
| Has financial resources for sustained multi-jurisdictional campaigns | Prevent archival publication through jurisdiction-diverse relay sets |

### A5 — Occasionally Lying Publisher

| Capabilities | Cannot Do |
|---|---|
| Holds a trusted key with established track record of accurate contributions | Override trust filtering on clients not trusting the key |
| Maintains reputation deliberately to maximize impact of intermittent false publications | Prevent post-hoc forensic attribution to the signing key |
| Can inject subtly misleading patches (downgraded severity, fabricated test results) | Manipulate events signed by other pubkeys |
| Can time false publications to coincide with high-impact disclosure windows | Prevent other trusted parties from publishing contradicting findings |
| False entries are mixed with genuine work, making detection difficult | Control whether other publishers corroborate or dispute their claims |

### A6 — Sybil Amplifier

| Capabilities | Cannot Do |
|---|---|
| Generates thousands of Nostr keypairs at near-zero cost | Control who follows or trusts the generated keys |
| Engineers WoT placement through social manipulation, follow-back exchanges | Bypass trust filtering on clients with tightly curated allowlists |
| Publishes Products, Metadata, Bindings, and disputes from Sybil keys | Guarantee expansion into a specific user's trust radius |
| Floods discovery queries (`#i`, `#t`) with Sybil-authored events | Prevent users from warning-on-expansion per spec §7.5 SHOULD |
| Combines with T-ID-02 mechanics for compound amplification | Make Sybil keys indistinguishable from legitimate keys under forensic audit |

### A7 — Spam/DoS Attacker

| Capabilities | Cannot Do |
|---|---|
| Generates large volumes of syntactically valid SCRUTINY events | Bypass trust filtering on clients with curated allowlists |
| Constructs pathological graph topologies (deep chains, extreme fan-out) | Force relay acceptance beyond relay storage/rate-limit policies |
| Uploads large artifacts to Blossom hosts consuming quotas | Impersonate trusted publishers through forged signatures |
| Targets specific products with focused flooding campaigns | Make spam events indistinguishable from trusted events under signature verification |
| Operates at low per-event cost using automated tooling | Guarantee event retention if relays enforce PoW requirements |

### A8 — Identifier Squatter

| Capabilities | Cannot Do |
|---|---|
| Publishes events claiming well-known canonical identifiers | Validate those claims against authoritative registries |
| Backdates `created_at` for first-mover advantage (amplified by T-DI-01) | Prevent the real authority from publishing competing events |
| Builds thin trust footprint through Sybil-assisted WoT placement | Make squatting events indistinguishable from authoritative ones under trust filtering |
| Claims CVE, CPE, PURL, CC certificates without authorization | Control which pubkeys users choose to trust for given identifiers |
| Pre-positions before actual vendors enter the ecosystem | Prevent long-term forensic attribution or reputation damage |

### A9 — Infrastructure Impersonator

| Capabilities | Cannot Do |
|---|---|
| Creates web services, relays, or clients mimicking official SCRUTINY infrastructure | Forge Nostr event signatures from legitimate project keys |
| Distributes tampered default trust lists, relay recommendations, client binaries | Prevent users from verifying event signatures independently |
| Registers similar domain names using project branding and documentation | Affect users obtaining software from legitimate distribution channels |
| Targets new users during bootstrap when brand recognition is weakest | Prevent community detection and exposure of the impersonation |
| Combines with compromised-distribution techniques | Make an impostor relay produce events it never received |

### A10 — Defaming Consumer

| Capabilities | Cannot Do |
|---|---|
| Publishes fabricated negative findings as Metadata events | Bypass trust filtering on clients not trusting the key |
| Creates doctored test results, forged reports, AI-generated evidence | Remove permanent cryptographic attribution to the defamer's pubkey |
| Binds fabricated findings to target products | Prevent competing trusted parties from publishing contradictory findings |
| May build minimal trust over time before launching attack | Forge signatures from the targeted vendor's key |
| Exploits asymmetric burden: vendor must investigate each false claim individually | Prove a negative cryptographically (that a vulnerability does not exist) |

### A11 — Artifact-Targeting Attacker

| Capabilities | Cannot Do |
|---|---|
| Compromises or operates artifact hosts (Blossom servers, CDN endpoints) | Forge events referencing the artifacts (signatures protect event integrity) |
| Replaces artifact bytes after publication despite SHA-256 hash commitments | Make a correctly hash-verified artifact appear corrupted |
| Issues takedown notices against legitimate artifact hosts | Prevent artifact retrieval from mirrors, archives, or IPFS |
| Embeds tracking URLs in imeta references for surveillance correlation | Hide the tracking behavior from clients inspecting imeta URL patterns |
| Exploits single-source hosting fragility | Prevent multi-host distribution by community or ecosystem actors |

---

## §5 — Risk Methodology

Residual risk is assessed qualitatively as **Risk = Impact × Likelihood**, informed by the capability bounds of §4 archetypes.

### Impact Scale

| Level | Definition |
|---|---|
| **Critical** | Permanently breaks ≥1 core security goal (Integrity, Authenticity, Trust Separation) with no protocol-level recovery path. Damage is systemic and self-propagating once achieved. |
| **High** | Causes significant, measurable degradation of a core security goal under realistic conditions. Partial mitigations exist but leave material gaps. |
| **Medium** | Partially degrades a security goal; impact bounded by client implementation quality, ecosystem maturity, or attacker sustainment cost. Active effort required; payoff is conditional. |
| **Low** | Minor or operational impact under unlikely configurations; narrow attack surface; consequence is self-limiting or easily detected. |

### Likelihood Factors

- Number of preconditions required for exploitation.
- Whether the vulnerability is a passive structural property of the design or requires active, sustained attack effort.
- Attacker capability class from §4 — higher-capability archetypes increase likelihood.
- Whether defenses are mandatory (MUST), recommended (SHOULD), optional (MAY), or absent.

### Range Ratings

Range ratings (Low–Medium, Low–High) indicate residual risk varies substantially by implementation quality or deployment context. The lower bound assumes a well-implemented, security-conscious client following all SHOULD recommendations. The upper bound assumes a naive client ignoring non-MUST guidance.

---

## §6 — Threats

| Prefix | Category | Count | Focus |
|---|---|---|---|
| DI | Data Integrity | 6 | Content, diffs, chains, attribution |
| ID | Identity | 5 | Pubkeys, trust, impersonation |
| AV | Availability | 5 | Spam, exhaustion, artifacts |
| DC | Discovery | 4 | Relay capability gaps, identifier findability |
| CE | Censorship | 3 | Suppression, eclipse, coercion |
| SV | Surveillance | 3 | Query privacy, host tracking |
| EC | Ecosystem | 5 | Adoption-scale risks |
| PI | Protocol Interactions | 4 | Cross-mechanism semantic tensions |

### §6.1 — Data Integrity

#### T-DI-01 — Timestamp Manipulation via Forged `created_at`

| Field | Value |
|---|---|
| Adversary | Compromised Publisher, Identifier Squatter |
| Assets | A13 Timestamp ordering claims, A6 Canonical chains, A7 Canonical views |
| Spec | §7.2, §3.1 OTS |

**1. Problem.** The `created_at` field in Nostr events is self-reported by the publisher with no relay-side verification. A Compromised Publisher backdates patches to claim earlier authorship than truth, or post-dates forks to manipulate default-head selection per §7.2. Fork resolution uses `created_at` as the primary sort key and falls back to event ID hash only on tie — meaning a crafted timestamp deterministically selects the attacker's preferred tip as the default head. In the absence of OpenTimestamps proofs, there is no mechanism to detect or reject implausible timestamps. Root authors are sovereign over their chains; a malicious root author can rewrite their canonical history at will by publishing post-dated forks retroactively.

**2. Mitigation.** NIP-03 OpenTimestamps (MAY) provides Bitcoin-confirmed temporal attestation. When an OTS proof exists for competing patches during tip selection, clients SHOULD prefer the Bitcoin timestamp over self-reported `created_at` (§7.2). Fork resolution includes a tie-break on event ID hash that prevents purely deterministic exploitation when two tips share the same `created_at`. Root authors MAY publish kind 5 deletions targeting unwanted tips to explicitly abandon them. Disputers MAY flag suspected backdating via foreign patches as informational annotations.

**3. Gap.** OTS adoption is voluntary (MAY) and ecosystem-level uptake is currently low. In its absence, `created_at` ranking trusts the root author's claimed clock. No relay-side rejection of anomalous timestamps is specified. No client-side policy mandates flagging or discarding events with implausible timestamps. The protocol's sovereignty model — root authors control their chains — makes timestamp honesty a matter of publisher integrity rather than protocol enforcement.

**4. Residual risk: High.** Fork resolution is structurally vulnerable to crafted timestamps. OTS mitigates but is gated on voluntary adoption. Until OTS is widely deployed, canonical history depends on publisher honesty for temporal ordering.

---

#### T-DI-02 — Fork Resolution Determinism Across Implementations

| Field | Value |
|---|---|
| Adversary | N/A (structural) |
| Assets | A6 Canonical chains, A7 Canonical views |
| Spec | §7.2, §7.4 |

**1. Problem.** Fork resolution (§7.2) specifies "latest `created_at` wins, tie-break by lowest event ID hash." While this algorithm is deterministic given a static set of patches, the set itself depends on relay completeness — a client connected to different relays may see different subsets of patches. Two independent implementations computing the canonical view from non-identical input sets produce divergent canonical views. This is not a cryptographic integrity failure (each event is individually signed), but creates inconsistent state across the ecosystem when relay coverage gaps interact with fork resolution.

**2. Mitigation.** The specification explicitly acknowledges fork existence and requires clients to surface multiple tips when present rather than silently selecting a winner. Canonical view computation (§7.4) applies kind 5 cascade before tip selection, so root-author deletions prune unwanted tips deterministically. Multi-relay querying (§8.0) reduces the probability of divergent patch sets.

**3. Gap.** No protocol-level guarantee that all clients see identical patch sets. Relay omission of a tip event changes the fork-resolution outcome silently. No cross-client consistency verification mechanism exists. The determinism property holds only within the boundary of patches visible to a single client.

**4. Residual risk: Medium.** Integrity of individual events is protected by signatures; the risk is inconsistency of computed views across clients, not corruption of signed data. Bounded by multi-relay query discipline.

---

#### T-DI-03 — Retraction Propagation Gaps

| Field | Value |
|---|---|
| Adversary | Malicious Relay Operator |
| Assets | A5 Kind 5 deletion events, A7 Canonical views, A9 Binding topology |
| Spec | §10, §7.4 cascade |

**1. Problem.** Kind 5 deletion events trigger topology cascade (§10): when a root-author patch is deleted, all descendants in the canonical chain are invalidated. However, cascading requires that clients see the kind 5 event. A Malicious Relay Operator withholding a kind 5 deletion causes clients relying on that relay to compute a stale canonical view where the deleted patch (and its descendants) remain applied. Conversely, a relay that stores kind 5 events but not the original continues to surface the deletion without context. The split is not detectable by clients querying a single relay — both views appear internally consistent.

**2. Mitigation.** Spec §8.0 mandates that clients cache locally received kind 5 events and apply them during chain construction even if the relay omits them from filter results. Multi-relay querying increases the probability of receiving kind 5 events from at least one honest relay. The relay policy (§10) recommends storing deletion events alongside originals, preserving the audit trail for clients that specifically request it.

**3. Gap.** NIP-09 honoring is optional at the relay layer. No mechanism ensures kind 5 events propagate to all relays holding the target event. No relay-side requirement to co-serve deletions alongside the events they target. No client-side requirement to actively verify deletion status before accepting a patch as valid.

**4. Residual risk: Medium.** Exploits the structural gap between "deletion published" and "deletion universally visible." Risk increases if the practical relay set is small. Multi-relay querying (SHOULD) bounds but does not eliminate the gap.

---

#### T-DI-04 — Binding Relationship Ambiguity

| Field | Value |
|---|---|
| Adversary | Compromised Publisher, Occasionally Lying Publisher |
| Assets | A3 Binding events, A9 Binding topology, A8 Canonical identifiers |
| Spec | §4.3 (`t` tags for relationship semantics) |

**1. Problem.** Binding relationship semantics are expressed as free-form prose in `content`, optionally hinted via `t` tags (e.g., `["t", "vulnerability"]`) alongside `scrutiny-binding` (§4.3). There is no closed vocabulary — any string is a valid relationship value. A publisher can assert a binding with `t: vulnerability` while the prose describes a benign compatibility note, or vice versa. Because bindings are immutable (no patch mechanism applies to them), correction requires a full kind 5 delete-and-republish cycle. The `t` tag hint is explicitly advisory; the `content` field is authoritative. But automated tooling and relay filters consume `t` tag hints, creating a structural divergence between machine-processed relationships and human-interpreted semantics.

**2. Mitigation.** The spec declares `content` as the authoritative statement of relationship semantics (§4.3). Clients MAY flag bindings where `t` tag hints contradict prose description. Bindings are signed and attributable — mislabeling is forensically traceable to the publisher. Kind 5 deletion enables removal; replacement publishes a fresh binding with corrected semantics. Trust filtering limits visibility of bindings from untrusted publishers.

**3. Gap.** No schema validation of relationship tags against event content. No protocol-level enumeration of valid relationships. The retract-and-republish correction path is not atomic — deleted and replacement bindings propagate to relays at different speeds. Automated discovery tools that key on `t` tag hints rather than parsing `content` inherit whatever ambiguity the publisher created.

**4. Residual risk: Low–Medium.** Low for human-mediated consumption where content is read. Medium for automated toolchains relying solely on relationship hints for classification. Bounded by publisher accountability (attribution persists).

---

#### T-DI-05 — Cherry-Pick Attribution Laundering

| Field | Value |
|---|---|
| Adversary | Compromised Publisher, Occasionally Lying Publisher |
| Assets | A4 Patch events, A6 Canonical chains, A7 Canonical views |
| Spec | §11 (future work) |

**1. Problem.** Cherry-pick semantics (§11) make `cherry-pick` references informational attribution only — appliers do NOT fetch or consult the source patch. A malicious root author adopts a foreign disputer's diff, applies it to their canonical chain as a root-author patch, and either omits the `cherry-pick` reference entirely or references a different (benign) source. The resulting canonical view incorporates the third party's contribution without crediting them. Because canonical history is root-author sovereign, the omission is indistinguishable from original authorship. If the true source is later retracted (kind 5), the cherry-picked patch's diff continues to apply normally (§7.4) — the laundering survives source invalidation.

**2. Mitigation.** Cherry-pick references are informational and do not gate diff application. The root author is always accountable for the state of their canonical chain — adopting another's diff without attribution carries reputational risk discoverable through forensic comparison of event timelines. Disputers retain their own signed patches as evidence of original authorship. Independent observers can correlate diff content across chains to detect unattributed borrowing.

**3. Gap.** No protocol-level enforcement of attribution accuracy. No relay-verifiable link between a cherry-picked diff and its claimed source. A root author can silently absorb foreign contributions. Detection requires out-of-band diff-comparison tooling that the protocol does not specify. The design intentionally avoids making attribution normative — but the gap between "informational" and "reliable" grows as cherry-picking becomes common practice.

**4. Residual risk: Medium.** Integrity of the diff itself is not compromised (it applies correctly to the chain). The risk is attribution integrity — who gets credit for the change. Bounded by ecosystem-level audit tooling and community norms around attribution practices.

---

#### T-DI-06 — Attached Content Integrity (Diff-in-Transit + Blossom Split-World)

| Field | Value |
|---|---|
| Adversary | Artifact-Targeting Attacker, Malicious Relay Operator |
| Assets | A4 Patch events, A10 Attached artifacts, A7 Canonical views |
| Spec | §5.2 lookup, §4.5 imeta |

**1. Problem.** Patch diffs may be inline (in the event's `content`) or attached via imeta + Blossom (§5.2). Two distinct integrity concerns arise. First, the **diff-in-transit** concern: an inline diff travels inside the Nostr event and is protected by the event signature — relay-side tampering invalidates the signature. However, Blossom-attached diffs are fetched from external URLs after the event is verified. An Artifact-Targeting Attacker who compromises the Blossom host can replace the diff bytes with a different diff whose SHA-256 matches the event's `x` hash (preimage attack) or, more practically, replace the diff at the URL after the `x` hash was published but before the client fetches (a window between publication and consumption). Second, the **split-world** concern: a Malicious Relay Operator serves different clients different imeta URLs — some clients receive the legitimate Blossom URL, others receive a malicious mirror containing a doctored diff. Both clients verify the `x` hash against their respective fetches; both see internally consistent views. Without cross-client comparison, neither detects the split.

**2. Mitigation.** SHA-256 hash verification (`imeta` `x`) MUST be performed by clients before trusting fetched artifacts (§4.5). The protocol's separation of event from artifact supports multi-source retrieval — the hash is the identity, not the URL. Spec §5.2 recommends inline diffs as the primary lookup path; attached diffs are a fallback for large payloads. Multi-relay querying reduces the probability that all clients contact the same compromised host.

**3. Gap.** Hash verification catches content substitution but not split-world attacks (both versions match their respective hashes because the attacker controls the URL-to-content mapping). No protocol-level requirement for artifact mirroring or content-addressed retrieval. No standardized fallback URL set for imeta references. The window between event publication and artifact fetch leaves a temporal gap where undetected substitution is possible if the host is compromised post-publication. Clients have no mechanism to distinguish "host temporarily unavailable" from "host serving substituted content."

**4. Residual risk: Medium.** Inline diffs (the primary path) are signature-protected. Attached-diff integrity depends on hash verification and host trustworthiness. Split-world attacks require sustained host compromise. Risk is highest for patches relying exclusively on imeta-attached diffs with single-source hosting.

---

### §6.2 — Identity

#### T-ID-01 — Key Compromise — No Nostr Revocation

| Field | Value |
|---|---|
| Adversary | Compromised Publisher |
| Assets | A1 Product events, A2 Metadata events, A3 Binding events, A4 Patch events, A6 Canonical chains, A12 Pubkey-to-reputation mappings |
| Spec | §7.5 trust model |

**1. Problem.** If a publisher's nsec leaks, the attacker inherits full sovereignty over all chains rooted at that pubkey. Post-compromise patches are indistinguishable from legitimate ones — they are signed by the correct key. The attacker can publish false metadata, alter canonical views, kind 5-delete legitimate history, forge timestamp rankings, and publish malicious bindings that inherit the key's accumulated trust weight. Bindings authored pre-compromise remain signed by the legitimate author, providing no signal of compromise timing. Nostr has no native key revocation mechanism — once compromised, a key retains authority indefinitely.

**2. Mitigation.** The spec acknowledges this as a structural limitation (§7.5). Pre-compromise events remain verifiably attributable to the key at the time they were signed, providing a forensic boundary. The remedy is social: announce compromise out-of-band, rotate to a new key, encourage the community to migrate trust to the new key. Multiple independent trust sources reduce reliance on any single pubkey.

**3. Gap.** No protocol-level key revocation, rotation, or emergency broadcast mechanism exists in Nostr or SCRUTINY. No distinction between pre- and post-compromise events is possible at the signature layer. A compromised high-authority key (major vendor, certification body, prolific researcher) can corrupt the canonical view for every user who trusts that key, with no protocol-level recovery path. The social remedy requires reaching every trusting party — no guarantee of completeness.

**4. Residual risk: Critical.** Direct, catastrophic break of Integrity, Authenticity, and Trust Separation with zero protocol-level recovery. Inherited from Nostr's key architecture. This is the single most severe threat in the model.

---

#### T-ID-02 — Sybil Amplification Through WoT Expansion

| Field | Value |
|---|---|
| Adversary | Sybil Amplifier |
| Assets | A11 Trust lists, A1–A4 All event types, A8 Canonical identifiers, A9 Binding topology |
| Spec | §7.5, §6.1, §6.3–6.4 |

**1. Problem.** Sybil resistance is delegated to the user's web-of-trust (§7.5). A direct allowlist is highly resistant: only explicitly trusted pubkeys gain admission. The moment trust-radius expansion activates — N-hop traversal of NIP-02 follow lists — resistance weakens proportionally to expansion depth. A Sybil Amplifier generates thousands of keypairs and engineers their placement within follow lists of seed pubkeys via social manipulation, follow-back exchanges, or compromise of a minor follower. At N=1 expansion, every direct follow of every seed becomes admitted through transitive trust. At N=2, every follow-of-a-follow enters the user's view. The amplified keys then publish events across all SCRUTINY types, polluting the user's view with attacker-controlled data. Bindings authored by Sybil keys within trust radius pull untrusted endpoints into the reachable graph via §6.4, compounding the injection.

**2. Mitigation.** Trust filtering is the primary defense: only admitted pubkeys are processed. The spec explicitly addresses the Sybil-vs-expansion trade-off and mandates a SHOULD-level warning when expansion would admit a large number of previously unseen pubkeys (§7.5). Binding admission rules (§6.3) require direct trust on the binding's author — trust does not flow transitively through binding endpoints. Attribution is permanently preserved: all Sybil events are signed by identifiable keys.

**3. Gap.** No protocol-level Sybil resistance mechanism (proof-of-personhood, stake, social-graph stamping). WoT scoring algorithms (depth weighting, decay, reputation aggregation) are explicitly out of scope. The "warn on large expansion" SHOULD is non-normative and may be ignored. N-hop expansion without depth weighting treats a directly trusted key's follow identically to the user's own trust decision — a structural flattening of trust distance.

**4. Residual risk: Medium.** Bounded entirely by user trust-list discipline and client implementation of expansion warnings. Higher for users relying on automated WoT expansion without curation. The protocol cannot eliminate this risk without abandoning the permissionless trust model.

---

#### T-ID-03 — Canonical Identifier Squatting

| Field | Value |
|---|---|
| Adversary | Identifier Squatter, Compromised Publisher |
| Assets | A8 Canonical identifiers, A1 Product events, A2 Metadata events |
| Spec | §9, §4.4.2 discipline |

**1. Problem.** `i` tag values are self-asserted with no validation against authoritative registries. A publisher claiming `cve:CVE-2024-X` has not been validated against MITRE; a publisher claiming `cpe:2.3:h:some-vendor:...` has not been checked against the NIST CPE dictionary. Spec §9 states the convention ("Value is the source authority's canonical form, preserved verbatim") but provides no enforcement. An Identifier Squatter publishes events claiming widely known identifiers. Combined with backdated `created_at` (T-DI-01), the squatter achieves first-mover advantage — appearing in `#i` queries before the legitimate authority publishes. With thin trust amplification (T-ID-02), the squatter's events become visible alongside authoritative ones. Users must discriminate by pubkey trust, but the squatter's pre-positioned chain of patches and bindings can appear established by the time legitimate publishers enter.

**2. Mitigation.** Trust filtering: squatter events do not enter a curated user's view unless the squatter's pubkey is trusted or reachable via trusted Binding. Multiple competing events for the same identifier are expected by design — the user's trust list determines what they see. Canonical identifier clustering allows side-by-side comparison. Real publishers can publish their own events, and trusted bindings naturally outweigh untrusted ones.

**3. Gap.** No cross-reference with authoritative registries. No conflict-detection mechanism for multiple events claiming the same identifier. No priority for the actual vendor's or registry authority's key — the protocol does not know who the real authority is. The asymmetry favors squatters during ecosystem bootstrap when legitimate publishers have not yet entered and trust lists are sparse.

**4. Residual risk: Medium.** Bounded by trust-list curation. The asymmetry — squatters publish cheaply; authorities must defend — is structural to the permissionless design. Risk decreases as the ecosystem matures and authoritative keys gain widespread trust.

---

#### T-ID-04 — Unverifiable Identity Claims

| Field | Value |
|---|---|
| Adversary | Compromised Publisher, Identifier Squatter |
| Assets | A1 Product events, A2 Metadata events, A12 Pubkey-to-reputation mappings |
| Spec | §7.5, §6.1 |

**1. Problem.** Anyone can generate a Nostr keypair and claim, in `content` prose, to be any real-world entity. The protocol provides no identity attestation mechanism — no DNS-binding (NIP-05 is not a dependency in v0.5.3), no domain-proofing, no organizational certification. A user encountering an event signed by pubkey `0xabcd...` claiming to be Infineon must establish out-of-band that Infineon controls that key. The protocol delegates this entirely to trust-list curation: if the user has placed `0xabcd...` in their trust list, that key is treated as Infineon for that user. A Compromised Publisher creating a fake-vendor Product event with accurate canonical identifiers (exploiting T-ID-03 squatting) and convincing prose can pass for legitimate to users with permissive trust lists or compromised default trust lists (T-EC-02). The combined product-impostor scenario merges fake vendor identity with accurate identifier claims — the impostor's Product looks structurally identical to the real vendor's to any client that has not independently verified the pubkey-to-entity mapping.

**2. Mitigation.** Permissionless identity is a design choice, not a defect — the spec explicitly intends no central identity authority (§7.5). The cryptographic permanence of signatures provides forensic attribution: even if the user does not recognize the impostor at consumption time, every false claim is permanently traceable to the pubkey that signed it. Trust lists curated against organization-claimed pubkeys obtained through verified channels provide immunity for disciplined users.

**3. Gap.** No in-protocol identity binding mechanism. No safe-harbor convention for vendors to canonically claim their own pubkey within the protocol. The fake-identity concern is delegated entirely to ecosystem-level identity infrastructure (organization websites listing pubkeys, third-party registries, community verification). New users without established trust lists have no basis for discriminating legitimate from impostor claims.

**4. Residual risk: Low–Medium.** Low for users with trust lists curated against verified pubkey-to-entity mappings. Medium for new users in the bootstrap phase or users relying on unverified default trust lists (T-EC-02).

---

#### T-ID-05 — Author Hint Forgery on `e` Tags

| Field | Value |
|---|---|
| Adversary | Compromised Publisher |
| Assets | A3 Binding events, A4 Patch events |
| Spec | §4.3 e tag semantics |

**1. Problem.** Spec §4.3 specifies `e` tags with an `<author_pk>` field described as an "advisory optimization hint." The hint tells clients the expected pubkey of the referenced event without requiring a fetch. A Compromised Publisher crafting a binding can populate the author hint with a trusted pubkey (e.g., a reputable vendor) while the actual referenced event, when fetched, belongs to an attacker-controlled key. During the pre-fetch window — before the client retrieves and verifies the referenced event — the UI may display misleading attribution based on the hint alone. A client that uses the hint for trust pre-filtering (bypassing the actual pubkey check) is exposed to outright admission bypass, though this is explicitly forbidden by the spec.

**2. Mitigation.** The spec mandates that the hint MUST NOT gate admission; the actual fetched pubkey is authoritative. Discrepancy is explicitly handled: when the fetched pubkey differs from the hint, clients flag both the binding and the referenced event with a discrepancy warning. Trust admission uses verified pubkeys exclusively, not hints. Verification behavior is documented in the §4.3 table: unverified → annotate as such; mismatch → flag discrepancy and use actual pubkey.

**3. Gap.** Pre-fetch UI may display the hint optimistically before the referenced event is available. Users may make trust decisions based on hint values during this window. The "flag with discrepancy warning" mandate is implemented at the client level; non-compliant clients may silently accept the hint. The author-hint mechanism is structurally a hint that may diverge from truth — the design accepts this and depends on client discipline to handle divergence cleanly.

**4. Residual risk: Low.** The protocol's explicit non-gating rule contains the impact. The threat is user-deception via UI optimism, not protocol bypass. Bounded by client compliance with the discrepancy-flagging mandate.

---

### §6.3 — Availability

#### T-AV-01 — Spam and Graph Pollution

| Field | Value |
|---|---|
| Adversary | Spam/DoS Attacker |
| Assets | A1–A4 All event types, A8 Canonical identifiers, A9 Binding topology |
| Spec | §3.1 PoW (MAY), §8.0 relays |

**1. Problem.** A Spam/DoS Attacker generates large volumes of syntactically valid SCRUTINY events — well-formed tags, valid signatures — that cannot be rejected by relays on syntactic grounds. The attacker floods `#t:scrutiny-fabric` queries with bogus events, consumes relay storage and bandwidth, and pollutes discovery queries for canonical identifiers. For users with permissive trust lists or active WoT expansion (T-ID-02), these events enter the visible graph. Unlike generic Nostr spam, SCRUTINY-spam carries the structural weight of protocol compliance — relays cannot distinguish automated garbage from legitimate publications by format alone. All SCRUTINY events share `kind:1` relay namespace with social posts, meaning relay-level rate-limiting and storage policies apply uniformly to both.

**2. Mitigation.** Trust filtering is the structural defense: untrusted-pubkey events are invisible to curated clients regardless of volume. NIP-13 Proof-of-Work (MAY) imposes per-event computational cost — the recommended baseline is 16 leading zero bits (~65K hashes). SCRUTINY-specific `t` tags enable relay-side filtering to isolate SCRUTINY traffic from broader Nostr noise. Relays MAY advertise PoW requirements via NIP-11 `min_pow_difficulty`; clients SHOULD inspect relay info documents before publishing.

**3. Gap.** PoW is MAY-level; relays are not required to enforce it. No per-author rate limit is specified. No anti-spam scoring or reputation mechanism exists at protocol level. Kind 1 namespace sharing means relays may apply aggressive rate-limiting to all kind 1 events, throttling legitimate SCRUTINY traffic alongside spam. The asymmetry — attacker cost is near-zero without PoW enforcement — persists until relay operators adopt PoW requirements broadly.

**4. Residual risk: Medium.** Bounded by trust filtering for curated users. Higher in scenarios where relays accept all SCRUTINY-tagged events without rate limits, PoW is unenforced, and clients do not trust-filter strictly. Ecosystem-level: relay operators bear uncompensated storage cost.

---

#### T-AV-02 — Graph Traversal Amplification

| Field | Value |
|---|---|
| Adversary | Spam/DoS Attacker |
| Assets | A3 Binding events, A9 Binding topology, A4 Patch events, A6 Canonical chains |
| Spec | §6.4 binding traversal, §7.4 chain computation |

**1. Problem.** Discovery proceeds by graph traversal: Product → Bindings → Metadata → recursively deeper. An attacker constructs pathological topologies designed to amplify client resource consumption. Three amplification vectors exist: deep canonical chains (hundreds of patches prolonging canonical-view computation), extreme binding fan-out (thousands of fabricated Metadata bound to one Product via Sybil-amplified keys), and recursive binding graphs (A → B → C → A inducing cycles). A naive client traversing without depth or fan-out budgets exhausts memory, stalls on network round-trips, or enters infinite loops during canonical-view computation. Chain computation (§7.4) already mandates cycle detection, but binding traversal (§6.4) does not.

**2. Mitigation.** Trust filtering limits which bindings cause endpoint admission: only bindings whose authors are trusted trigger traversal per §6.4. Canonical-view computation (§7.4) explicitly requires cycle detection — implementations MUST break cycles by excluding the patch with the higher event ID hash from further traversal. Foreign patches are not transitively admitted via root admission (§6.4); they require independent trust, which bounds dispute-driven amplification.

**3. Gap.** No depth or fan-out limit is specified for binding graph traversal. No pagination budget is mandated. No timeout or resource cap is defined for canonical-view computation beyond cycle detection. A permissive-trust user (wide WoT expansion) is structurally exposed to fan-out amplification. Chain computation for deep canonical chains is CPU-bound by repeated diff application with no ceiling.

**4. Residual risk: High.** A real exposure for clients without explicit resource budgets. The protocol's structural defense is trust filtering; the implementation defense (budgets, limits) is not required.

---

#### T-AV-03 — Event Size Exceeding Relay Limits

| Field | Value |
|---|---|
| Adversary | Spam/DoS Attacker, Compromised Publisher |
| Assets | A1–A4 All event types, A10 Attached artifacts |
| Spec | §4.5 imeta recommendation |

**1. Problem.** Nostr relays enforce per-event size limits (typically tens to hundreds of kilobytes, relay-dependent and not standardized). SCRUTINY events with large inline diffs — especially three-surface patches modifying lengthy `content` fields — embedded payloads, or numerous `imeta` tags can approach or exceed these limits. An event exceeding a relay's limit is rejected silently; rejection is per-relay, so a multi-relay publication may succeed on some relays and fail on others. An attacker can craft borderline-sized patches to maximize rejection variance, creating gaps in chain completeness across relays — a patch missing on relay A but present on relay B produces divergent canonical views for clients pinned to single relays.

**2. Mitigation.** Spec §4.5 recommends moving payloads larger than ~30 KB to imeta + Blossom. The diff format is text-efficient (unified diff with three lines of context). PoW (MAY) makes oversized publications more expensive to attempt repeatedly. Patch producers SHOULD verify application against the default head before publishing (§5.3); a rejected event is immediately visible to the publisher.

**3. Gap.** No normative size recommendation for SCRUTINY events. No client-side advisory warning when a constructed patch approaches likely relay limits. Relay-specific limits are unknown without per-relay probing (NIP-11 `limitation` field, inconsistently supported). Size rejection is silent — the publisher receives no ACK/NACK from the relay confirming storage.

**4. Residual risk: Low.** Operational concern with no direct security-goal compromise. Self-limiting: the publisher knows when publication fails. Rejection variance across relays is bounded by the multi-relay publication strategy.

---

#### T-AV-04 — Artifact Hosting Fragility

| Field | Value |
|---|---|
| Adversary | Artifact-Targeting Attacker, Hostile Vendor |
| Assets | A10 Attached artifacts, A7 Canonical views, A4 Patch events |
| Spec | §4.5, §5.2 attached diffs |

**1. Problem.** Imeta-attached artifacts (diffs, SBOMs, certifications, reports) live at external URLs. Three failure modes converge: **URL rot** (domains expire, hosting accounts lapse, servers decommission), **takedown propagation** (Hostile Vendor issues legal demands to Blossom hosts, which comply), and **split-world** (an attacker-controlled host serves different artifact bytes to different clients, each verifying its own SHA-256). For patches whose diff is imeta-attached (the §5.2 fallback path), unavailability is more consequential than for general artifacts: the canonical view cannot be computed past the missing diff. Spec §5.3's HALT behavior does not directly apply here — HALT handles pre-validation failures against a known diff, not missing diffs — but the operational effect is equivalent: the chain cannot proceed beyond the unavailable patch. Clients must surface this as a distinct error annotation.

**2. Mitigation.** SHA-256 in `imeta` `x` makes the artifact verifiable from any source — mirrors, archives, IPFS, personal caches. The protocol's separation of event from artifact implicitly supports multi-source retrieval. Inline diffs (§5.2 primary lookup path) avoid the attachment fragility problem entirely; attached diffs are a fallback. Multi-relay querying provides event-layer redundancy even when artifact-layer hosting fails.

**3. Gap.** No requirement for artifact mirroring, content pinning, or content-addressed storage. No guidance on how clients should handle unreachable artifacts (display warning? hide patch? surface as prose-only?). No expiry or liveness-check mechanism. No standardized fallback URL set to accompany a single `imeta` reference. No multi-host attestation for artifact availability. Artifact durability depends entirely on ecosystem practices (voluntary mirroring, archive services).

**4. Residual risk: Medium.** Structural weakness of any system referencing external mutable hosting. Inline diffs (primary path) are immune. Attached-diff fragility affects the secondary path. Risk increases monotonically with time as URLs rot. Split-world attacks require sustained, targeted host compromise.

---

#### T-AV-05 — Prose-Only Patch Abuse

| Field | Value |
|---|---|
| Adversary | Spam/DoS Attacker, Compromised Publisher |
| Assets | A4 Patch events, A6 Canonical chains, A7 Canonical views |
| Spec | §4.4 prose-only definition |

**1. Problem.** Prose-only patches — those with neither inline diffs nor imeta-attached diffs (§4.4) — participate fully in tip selection, chain topology, and kind 5 cascade. They form valid NIP-10 reply targets, extend canonical chains, and can become the default head of a fork. A Spam/DoS Attacker publishing prose-only patches at high volume extends a target product's canonical chain indefinitely: each patch adds a step to canonical-view computation, multiplies fork-resolution complexity, and dilutes the semantic value of the chain with non-mutating entries. Legitimate patches get buried under administrative-noise patches. A Compromised Publisher (malicious root author) can abuse prose-only patches to fabricate activity history — a long chain of "updates pending," "administrative revision," or "version statement" patches that look like active maintenance while contributing zero surface changes.

**2. Mitigation.** Prose-only patches contribute no changes to canonical surfaces, so they do not corrupt the computed view's content, identifiers, or attachments. They are semantically inert at the surface level; their only effect is topological. Chain computation (§7.4) processes them as valid steps that produce empty state transitions. Root authors control their own chains; a root author padding their chain is expressing sovereignty inefficiency, not breaking integrity.

**3. Gap.** No distinction between mutating and non-mutating patches in chain-length measurement or tip selection. No recommendation that clients visually compress consecutive prose-only patches in UI rendering. No rate-limit or volume guidance for prose-only publication. Chain-length overhead accumulates linearly with each prose-only patch, imposing computation cost without semantic benefit.

**4. Residual risk: Low.** Prose-only patches cannot corrupt canonical surfaces. Their only impact is chain-length amplification, which is a performance concern, not a data-integrity violation. The structural defense is that roots authors control their own chain length — but a malicious root author is already trusted with their chain's content.

---

### §6.4 — Discovery

#### T-DC-01 — Inconsistent Relay NIP Support

| Field | Value |
|---|---|
| Adversary | Malicious Relay Operator |
| Assets | A8 Canonical identifiers, A1–A4 All event types |
| Spec | §8.0 relay queries, §8.3 |

**1. Problem.** Not all relays support every NIP SCRUTINY depends on. Spec §8.0 scopes discovery to relays supporting NIP-01 `#t`, `#e`, and `#i` filters and requires graceful degradation for optional capabilities, but the core ambiguity persists: a relay that does not support `#i` filtering (NIP-73) returns `[]` for `#i` queries — observationally identical to a relay that supports `#i` but has no matching events. The client cannot distinguish "no matches anywhere" from "relay did not implement the filter." A Malicious Relay Operator exploits this by silently dropping NIP-73 support and returning empty results for all `#i` queries. Users pinned to that relay conclude no events reference their identifier of interest — effectively a discovery blackout. The empty-result ambiguity extends to NIP-09 support: a relay lacking kind 5 storage returns no deletions, producing stale canonical views indistinguishable from genuinely non-deleted chains. NIP-11 server info documents advertise NIP support, but are honor-system — a malicious relay lies about capabilities.

**2. Mitigation.** Spec §8.0 mandates cross-relay checking: clients MUST cross-check `#i` queries against at least one other relay or local cache. The recommended baseline is ≥3 geographically diverse relays. For critical discovery, clients query all configured relays and union results. Kind 5 fallback: clients cache locally received deletions and apply them during chain construction even if the relay omits them. NIP-11 server info SHOULD be inspected before publishing or querying.

**3. Gap.** No wire-protocol-level capability negotiation that returns a definitive "unsupported filter" vs. "empty result" signal. NIP-11 advertised support is unverifiable without out-of-band relay testing. Cross-relay checking imposes round-trip cost and is a SHOULD, not MUST, for non-critical queries. A relay that lies about NIP-73 support and additionally eclipses the client's other relays (T-CE-02) creates a compound discovery failure.

**4. Residual risk: Medium.** Mitigated by multi-relay cross-checking per §8.0. Higher for single-relay configurations or narrow relay sets where eclipse (T-CE-02) compounds the ambiguity.

---

#### T-DC-02 — WoT Bootstrap Trap

| Field | Value |
|---|---|
| Adversary | N/A (structural) |
| Assets | A11 Trust lists, A1–A4 All event types, A12 Pubkey-to-reputation mappings |
| Spec | §6.1, §7.5 Sybil section |

**1. Problem.** New users arrive with empty trust lists. With no trusted pubkeys, the trust filter excludes everything — the user sees nothing. The user must populate their trust list out-of-band: from documentation, community recommendation, default client list, or follow-chain origination at a known seed pubkey. Each bootstrap vector is an attack surface. Default trust lists are a supply-chain target (T-EC-02). Community recommendations from compromised forums enable injection. Misleading documentation on impostor sites (A9 Infrastructure Impersonator) seeds incorrect trust. The user is maximally vulnerable at the exact moment they have the least information for discrimination — they cannot evaluate a trust source without already having a trust framework.

**2. Mitigation.** Permissionless trust-list curation gives users full agency over their trust decisions. Multiple bootstrap paths exist (documentation, community, defaults, follow chains), so no single compromise is universally effective. The protocol's correctness does not depend on any particular trust source — it works identically regardless of how the trust list was populated. As users accumulate experience with the ecosystem, they can refine and diversify their trust sources.

**3. Gap.** No protocol-level definition of who creates, signs, distributes, updates, or revokes default trust lists. No ceremony for bootstrap. No progressive-trust or graduated-admission mechanism for new users. The trust bootstrap is the phase of maximum vulnerability with minimum protocol-level protection. A poisoned bootstrap trust list (T-EC-02) admits attacker events before the user has any basis for detecting the poison.

**4. Residual risk: High.** Genuine ecosystem-level gap. The protocol's correctness cannot be exercised by a user whose trust list was compromised at bootstrap. No amount of subsequent protocol rigor compensates for a corrupted initial trust state.

---

#### T-DC-03 — Identifier Mirror Infidelity

| Field | Value |
|---|---|
| Adversary | Compromised Publisher, Occasionally Lying Publisher |
| Assets | A4 Patch events, A8 Canonical identifiers |
| Spec | §4.4.1 mirroring, §8.3 |

**1. Problem.** Patch events modify the `i` surface through embedded unified diffs (§5.1). Nostr relays index `#i` filters against explicit `i` tags — they do not parse `content`. To make patch-introduced identifiers discoverable, publishers SHOULD mirror changed identifiers as `i` tags on the patch event (§4.4.1). This creates a dual failure mode. **Malicious omission:** a root author compelled to add an unfavorable identifier (e.g., a CVE from a foreign dispute they cherry-picked) constructs the diff correctly but omits the CVE from mirrored `i` tags — the patch applies to the canonical chain, but `#i:cve:...` queries never return it, suppressing discoverability. **Accidental forgetfulness:** a well-intentioned publisher simply forgets to mirror, creating an accidental discoverability gap. Both produce the same outcome: the identifier exists in the canonical view but is invisible to relay-side discovery.

**2. Mitigation.** Spec §4.4.1 specifies the publisher's mirroring responsibility and the soft cap of 64 mirrored identifiers. Client responsibility is also specified: when a `#i` query returns a patch, the client MUST follow the NIP-10 `e root` chain to the root event, compute the canonical view, and verify whether the identifier is currently present in the resolved `i` surface. This catches stale references (identifiers added then later removed) but does not catch never-mirrored introductions.

**3. Gap.** No relay-side enforcement of the mirroring contract. No protocol-level mechanism to detect whether a patch's mirrored `i` tags accurately reflect its diff's `i` surface changes. Client-side reconciliation — fetching all root-and-chain events and computing effective `i` surfaces — is bandwidth-prohibitive at scale and contradicts the protocol's design goal of cheap relay-side discovery. A publisher who consistently omits mirrors for sensitive identifiers creates a persistent, undetectable discoverability gap.

**4. Residual risk: Medium.** Discoverability degradation, not integrity loss (the identifier is present in the canonical view). Bounded by ecosystem-level audit tooling and well-implemented clients performing spot-checks. Malicious omission is intentional subversion; accidental omission is a publisher-quality concern.

---

#### T-DC-04 — Patch-to-Root Resolution Gap

| Field | Value |
|---|---|
| Adversary | N/A (structural) |
| Assets | A8 Canonical identifiers, A4 Patch events |
| Spec | §8.3 client resolution MUST, §4.4.1 |

**1. Problem.** When a `#i` query returns a patch event (because the identifier was mirrored per §4.4.1), the client MUST resolve the patch to its root event and verify the identifier's current presence in the canonical view (§8.3). This resolution step is mandatory but non-trivial: it requires fetching the `e root` chain, computing the full canonical view to the default head, and checking the resolved `i` surface. A naive client that stops at "patch returned by `#i`" and displays the identifier as "active" is presenting stale or misleading information. The identifier might have been removed by a later patch, the introducing patch might have been kind 5-deleted, or the root event itself might be retracted — in all cases, the identifier is not present in the current canonical view despite the patch appearing in query results.

**2. Mitigation.** Spec §8.3 explicitly mandates the resolution step: follow `e root` chain, compute canonical view, verify identifier presence. The Canonical-view computation (§7.4) handles kind 5 cascade, fork resolution, and HALT behavior — so the resolved state reflects all deletion and invalidation effects. The resolution is defined as a MUST, not SHOULD.

**3. Gap.** Full canonical-view computation per `#i` query result is expensive — proportional to chain length and diff-application cost. No lazy-evaluation or caching guidance is provided. A client optimizing for responsiveness may skip the resolution step for non-critical display, falling back to the stale-patch hazard described above. The computational cost of resolution grows with ecosystem maturity (longer chains, more patches per product).

**4. Residual risk: Medium.** Correctness depends on client implementation of the MUST-level resolution. Well-implemented clients resolve reliably; naive clients present stale state. The structural tension between "cheap relay-side discovery" (design goal) and "expensive client-side resolution" (correctness requirement) is inherent.

---

### §6.5 — Censorship

#### T-CE-01 — Relay-Level Event Suppression

| Field | Value |
|---|---|
| Adversary | Malicious Relay Operator |
| Assets | A1–A4 All event types, A9 Binding topology, A8 Canonical identifiers |
| Spec | §7.5 honest-but-curious, §8.0 multi-relay |

**1. Problem.** A Malicious Relay Operator suppresses specific events — by author pubkey, by `#t` tag combination, by `#i` value, or by event ID. The relay returns filtered result sets that silently omit matching events. To clients querying only that relay, the suppressed events functionally do not exist. spec §7.5 names this directly: "A hostile vendor can pressure relays to drop specific events; clients querying only the pressured relays see a censored graph." The suppression is undetectable by the affected client without cross-referencing against other relays — a client cannot distinguish "relay returned fewer results because it suppressed some" from "relay returned fewer results because fewer events match my filter."

**2. Mitigation.** Multi-relay publication and querying is the design intent: no single relay is trusted with completeness. Spec §8.0 recommends ≥3 geographically diverse relays and mandates cross-relay checking for `#i` queries. The event format contains nothing relay-specific — events are portable and replicable. Blossom-hosted payloads survive relay takedowns, providing artifact-level redundancy at a different infrastructure layer.

**3. Gap.** No transparency mechanism for relaying operator behavior — no way to prove "this relay refused to serve event X." No relay reputation system. No mechanism to detect coordinated suppression across a relay pool. Small relay sets (corporate deployments restricted to specific relays, mobile networks with limited connectivity) enable coordinated censorship. The protocol cannot mandate relay behavior.

**4. Residual risk: Low–Medium.** Low for users with broad, diverse relay sets and active cross-referencing. Medium for constrained-relay-set scenarios (enterprise policy, regional network restrictions).

---

#### T-CE-02 — Eclipse Attack on Relay Set

| Field | Value |
|---|---|
| Adversary | Network-Level Attacker |
| Assets | A1–A4 All event types, A9 Binding topology, A7 Canonical views |
| Spec | §7.5, §8.0 ≥3 relays |

**1. Problem.** A Network-Level Attacker isolates a client to a controlled relay set — by dropping connections to honest relays at the network layer, manipulating DNS resolution for relay hostnames, or being the only available network path (state-level operator, captive corporate gateway). All queries route to attacker-controlled relays. The attacker fabricates a graph view by selective omission: the client sees only events the attacker chooses to surface. Cryptographic verification protects against injected forgeries (unsigned events are rejected), but does not protect against omission — the attacker presents a subset of the real graph as if it were complete. Eclipse differs from T-CE-01 in scope: per-relay suppression targets individual events; eclipse replaces the entire relay set.

**2. Mitigation.** Cryptographic event verification prevents the attacker from injecting forged events. Relay diversity bounds the eclipse radius — if at least one configured relay has direct connectivity outside the attacker's control, eclipse is partial. Connection-level diversity (multiple ISPs, Tor, VPN routing) reduces single-network-path vulnerability. Out-of-band relay discovery (community-maintained relay lists, cached relay configurations) complicates sustained eclipse.

**3. Gap.** No view-completeness check — a client cannot know it has seen all relevant events. No cross-relay consistency proof. No mechanism to detect "all my relays return suspiciously narrow, identical result sets." Eclipse against a non-technical user is undetectable from inside the protocol. State-level network operators controlling all exit paths can achieve total eclipse.

**4. Residual risk: Low–High.** Low for users with diverse, audited relay sets and out-of-band sanity checks. High for users in adversarial network environments (state-level firewalls, captive corporate networks, regionally-constrained mobile operators).

---

#### T-CE-03 — Economic/Legal Relay Coercion

| Field | Value |
|---|---|
| Adversary | Hostile Vendor |
| Assets | A1–A4 All event types, A10 Attached artifacts |
| Spec | §7.5 censorship paragraph |

**1. Problem.** A Hostile Vendor exerts economic or legal pressure on relay operators to remove or refuse to serve specific events. Economic pressure takes the form of contractual leverage, direct payments for suppression, or withdrawal of hosting/bandwidth sponsorship. Legal pressure encompasses DMCA notices, cease-and-desist letters, trade-secret claims, and jurisdictional court orders. Because relays are operated by individuals and organizations responsive to legal and financial incentives, a well-resourced vendor can achieve practical suppression across multiple relays simultaneously — especially relays concentrated in the same legal jurisdiction. Unlike T-CE-01 (single-relay suppression), this is a coordinated, multi-relay campaign with sustained pressure.

**2. Mitigation.** Multi-relay replication across jurisdictions provides resilience — relays in different legal regimes face different pressure landscapes. Nostr events are portable and can be re-broadcast from any archive. Blossom-hosted artifacts add a separate infrastructure layer with different takedown dynamics. The decentralized architecture means no single legal demand eliminates an event from the entire network.

**3. Gap.** The protocol cannot prevent legal coercion. No mechanism detects coordinated suppression campaigns. No relay reputation or transparency system to identify operators who comply with coercive requests. If the effective relay set serving a particular `#t:scrutiny-fabric` namespace concentrates in a single jurisdiction or under a small number of operators, coordinated coercion becomes feasible. The defense is jurisdictional diversity — an ecosystem property the protocol cannot guarantee.

**4. Residual risk: Medium.** The decentralized design provides structural resilience, but effectiveness depends on relay operator diversity and jurisdictional distribution. Chilling effects on relay operators considering SCRUTINY hosting are real and unmeasured.

---

### §6.6 — Surveillance

#### T-SV-01 — Plaintext REQ Filter Leakage

| Field | Value |
|---|---|
| Adversary | Malicious Relay Operator |
| Assets | A8 Canonical identifiers, A1–A4 All event types |
| Spec | NIP-01 (inherited), §7.5 honest-but-curious |

**1. Problem.** Nostr REQ subscriptions transmit filter parameters in plaintext over TLS to the relay. The relay sees every queried `#i` identifier, every `#e` event ID, every author pubkey filter, and every time-range bound. For a security researcher, a query for `#i:cve:CVE-2024-X` declares interest in that vulnerability — potentially before public disclosure. Aggregated over time, queries reveal research focus, technology stack, customer base, and advisory pipeline. This is inherent to NIP-01's filter model; relays need filter parameters to compute matches. The spec's relay model (§7.5) assumes "honest but curious" — curiosity is permitted by baseline assumption.

**2. Mitigation.** None at the protocol level. The honest-but-curious baseline is a declared assumption, not a defense. Operational mitigations — Tor/VPN routing, randomized relay selection, broad filters with local post-filtering, query batching — are out of the protocol's scope. Multi-relay querying distributes the leakage surface across operators but does not eliminate it.

**3. Gap.** No private-information-retrieval primitive exists in Nostr. No encrypted-filter scheme. No relay-oblivious query mechanism. The plaintext-filter assumption is foundational to NIP-01's subscription model; any change would be a hard-fork-equivalent protocol change at the Nostr layer. SCRUTINY inherits this limitation in full.

**4. Residual risk: High.** Structural confidentiality leak with no protocol-level remedy. Severity is elevated in security-research contexts where query interests are intrinsically sensitive. Mitigated only by out-of-scope operational discipline.

---

#### T-SV-02 — Organizational Query Pattern Exposure

| Field | Value |
|---|---|
| Adversary | Malicious Relay Operator |
| Assets | A8 Canonical identifiers, A11 Trust lists |
| Spec | §8 discovery patterns |

**1. Problem.** A specific instance of T-SV-01 with heightened organizational impact. A security team querying SCRUTINY for `#i:cpe:...` identifiers across their internal product inventory leaks that inventory to relay operators. Patterns emerge across time: "queried `cpe:vendor-a:product-1`, then `cpe:vendor-b:product-2`, then `cpe:vendor-c:product-3` from the same client" reveals an organizational technology stack. Query spikes after major CVE announcements map response timelines. Trust-list composition, if observable, reveals which security communities the organization follows. Read-only participation is sufficient for the leak — the user need not publish anything.

**2. Mitigation.** Same as T-SV-01: none at protocol level. Operational defenses include distributed querying across many relays, randomized query batching, superset queries with local filtering. Multi-relay querying fragments the pattern across operators, but a single dominant relay used for all queries consolidates the exposure.

**3. Gap.** No private retrieval primitive. Organizational users face a structural trade-off between ecosystem participation and operational security. The protocol provides no mechanism for anonymous consumption of the graph.

**4. Residual risk: Medium–High.** Lower for individual researchers whose patterns are noise-like within aggregate relay traffic. Higher for organizational deployments where query patterns directly map to vulnerability exposure and technology inventory.

---

#### T-SV-03 — Artifact Host Tracking via `imeta` Fetches

| Field | Value |
|---|---|
| Adversary | Artifact-Targeting Attacker |
| Assets | A10 Attached artifacts |
| Spec | §4.5 imeta + Blossom |

**1. Problem.** External `imeta` fetches go directly from the client to the artifact host over a separate connection from the relay WebSocket. The host sees the requesting IP address, User-Agent header, timing, and the specific URL requested. By embedding unique-per-victim or unique-per-distribution-channel URLs in `imeta` references (functionally equivalent to web beacons), an attacker correlates artifact fetches across the user base: who downloaded which finding, when, and from which network location. Unlike relay-level surveillance (T-SV-01), this channel operates outside the Nostr protocol — it is standard HTTPS with all attendant tracking capabilities. The attacker need not operate the artifact host; publishing events whose `imeta` URLs route through tracking infrastructure is sufficient.

**2. Mitigation.** Hash verification (`imeta` `x`) confirms the bytes match the declared hash — protecting content integrity — but does not protect fetch privacy. Operational defenses: proxy fetching through intermediary services, delayed or batched artifact retrieval, disabling automatic remote content loading, and inspecting `imeta` URLs for tracking patterns before fetching. Multi-source artifact retrieval (mirrors) distributes the tracking surface.

**3. Gap.** No private artifact retrieval model in the protocol. No anti-tracking guidance in the spec. No standardized proxy-fetch convention for clients. No requirement that artifact hosts avoid tracking. The `imeta` tag carries a single URL; clients fetching by URL expose themselves to whatever tracking the host implements.

**4. Residual risk: High.** A direct privacy leak orthogonal to relay-level surveillance. For security investigators downloading artifacts related to active vulnerabilities, the fetch pattern is highly sensitive. Mitigation is entirely ecosystem-operational.

---

### §6.7 — Ecosystem

#### T-EC-01 — Indexer Re-Centralization

| Field | Value |
|---|---|
| Adversary | N/A (structural) |
| Assets | A7 Canonical views, A9 Binding topology, A8 Canonical identifiers |
| Spec | §7.4 canonical view cost |

**1. Problem.** Canonical-view computation (§7.4) involves fetching chains, applying diffs sequentially, resolving forks, handling kind 5 cascade, and materializing surfaces. At modest ecosystem scale this is feasible per-client; at large scale, per-query recomputation becomes prohibitively expensive. This incentivizes centralized indexer services that pre-compute canonical views, maintain identifier indices, and expose query APIs. A dominant indexer becomes a single point of failure (availability), a single point of control (censorship via selective indexing), and a single point of surveillance (query metadata concentration). The protocol's design goal of decentralized, permissionless discovery is undermined by the economic reality that cheap discovery depends on centralized pre-computation.

**2. Mitigation.** The data model is open and portable. Events are self-contained and independently verifiable. No proprietary computation is required — any party can reproduce an indexer's output by replaying the protocol from events alone. Multiple independent indexers are technically feasible. Client-local caching and incremental recomputation reduce reliance on external indexers.

**3. Gap.** No standard query API for indexer interchangeability — users cannot easily substitute one indexer for another without changing client configuration. No mechanism for a client to verify that an indexer is serving a complete, unfiltered view. No protocol-level incentive for indexer diversity. Economic pressure toward centralization is structural and not addressable at the protocol layer.

**4. Residual risk: Medium.** A well-recognized risk in decentralized systems. The open data model provides theoretical escape from any single indexer, but practical switching costs may be high. Risk grows with ecosystem scale.

---

#### T-EC-02 — Default Trust List Compromise

| Field | Value |
|---|---|
| Adversary | Infrastructure Impersonator |
| Assets | A11 Trust lists, A1–A4 All event types, A12 Pubkey-to-reputation mappings |
| Spec | §6.1, §7.5 bootstrap |

**1. Problem.** Default trust lists shipped with client software or distributed as bootstrap artifacts are a high-value supply-chain target. An Infrastructure Impersonator distributing tampered client builds or trust-list files injects attacker-controlled pubkeys into every new installation. These keys gain immediate, unexamined trust from each new user. The compromise is comprehensive: every security goal the protocol offers (Integrity, Authenticity, Censorship Resistance, Trust Separation, Discoverability) is simultaneously nullified for the affected user because attacker events pass trust filtering without scrutiny. The user has no basis for detecting the compromise — by definition, their trust framework was seeded by the attacker.

**2. Mitigation.** Multiple bootstrap paths exist (community recommendations, direct publisher outreach, verified documentation channels) — no single distribution vector is universal. Users can augment and replace default trust lists over time as they develop independent trust judgment. The protocol's correctness does not depend on any specific trust source. Community detection of compromised distributions is possible: users comparing their default trust lists against known-good published lists can identify discrepancies.

**3. Gap.** No protocol-level definition of who creates, signs, distributes, updates, or revokes default trust lists. No signing, versioning, multi-party attestation, or reproducible-build requirement. No mechanism for users to verify the provenance of their default trust list. No ceremony for establishing consensus on the canonical default list.

**4. Residual risk: High.** Compromise of the trust-list distribution channel is a single point of failure for the security of every new user. The protocol's trust model is predicated on user-curated trust — but new users cannot curate what they have no basis to evaluate.

---

#### T-EC-03 — Kind 1 Namespace Coupling with Relay Policy

| Field | Value |
|---|---|
| Adversary | N/A (structural) |
| Assets | A1–A4 All event types |
| Spec | §3 all-events-kind-1 design choice |

**1. Problem.** All SCRUTINY events use `kind:1` (Nostr short text notes), chosen for maximum relay compatibility. However, `kind:1` is also the transport for social posts, microblogging, and general Nostr chatter. Relays applying aggressive anti-spam heuristics to `kind:1` events — rate limiting, content-length caps, frequency throttling — apply those policies uniformly to SCRUTINY events. A relay that imposes "max 100 kind 1 events per pubkey per hour" throttles a bot publishing 200 SCRUTINY patches equally with a spammer posting 200 replies. Relays may also evolve their `kind:1` handling (deprioritization algorithms, storage-tier rebalancing, filter-index restructuring) without awareness of SCRUTINY's dependency. Nostr protocol evolution — NIP deprecations, new relay behavior requirements for `kind:1` — may break SCRUTINY without any SCRUTINY-specific change.

**2. Mitigation.** Version tagging (`scrutiny-v053` `t` tag) allows clients to negotiate protocol versions and detect incompatible changes. SCRUTINY-specific `t` tags (`scrutiny-fabric`, `scrutiny-product`, etc.) allow relay-side filtering to isolate SCRUTINY traffic — relays COULD exempt SCRUTINY-tagged events from general kind 1 rate limits if they choose to distinguish them. The protocol's minimal surface (four event types, standard Nostr primitives) reduces the probability of relay incompatibility.

**3. Gap.** No migration path to a dedicated kind number if kind 1 coupling becomes untenable. No compatibility matrix against relay implementations. No mechanism for a relay to advertise "I treat SCRUTINY events differently from social kind 1 events." The relay's sovereign discretion over kind 1 handling cannot be constrained by the protocol. Rate-limiting that is reasonable for social media may be crippling for high-volume SCRUTINY publication use cases.

**4. Residual risk: Medium.** External dependency on a rapidly evolving protocol ecosystem. The risk is structural and long-term — kind 1 semantics may drift in ways invisible to the SCRUTINY specification. Practical impact depends on specific relay operator policies.

---

#### T-EC-04 — AI-Generated False Metadata at Scale

| Field | Value |
|---|---|
| Adversary | Sybil Amplifier, Compromised Publisher |
| Assets | A2 Metadata events, A1 Product events, A3 Binding events |
| Spec | §2 principle 4 (deep semantics require protocol-aware processing) |

**1. Problem.** The protocol is designed to be machine-processable: events carry sufficient structure for automated agents (including AI agents) to discover, parse, and act on them without human intervention. This creates a symmetry: AI agents that consume protocol data can also produce it. An attacker deploying an LLM pipeline under a trusted key (compromised or socially engineered into trust) produces Metadata events with coherent, technically detailed `content` fields, appropriate canonical identifiers, and plausible attached artifacts (AI-generated PDF reports, fabricated test data). Output is syntactically indistinguishable from human-authored expert analysis. At scale, the volume of plausible output overwhelms community review capacity. The trust model assumes human curation of pubkeys, not human authorship of events — a trusted organization's AI-generated false metadata passes trust filtering with the organization's full credibility weight. The spec's principle 4 positions deep semantics as requiring protocol-aware processing; it does not address AI as a producer.

**2. Mitigation.** Events are attributable to a pubkey — the publishing organization bears reputational accountability regardless of whether the content was human or AI authored. Trust filtering limits propagation to users who trust the publishing key. Independent corroboration from other trusted sources provides a natural signal: AI-generated findings lacking multi-source corroboration stand in isolation, while legitimate findings attract confirmatory bindings and cross-references.

**3. Gap.** No mechanism to distinguish human-authored from AI-generated events within the protocol. No requirement for publishers to disclose AI involvement. No rate-limiting or credibility-weighting that accounts for AI-driven volume. The trust model's binary admission (trusted/untrusted per pubkey) provides no per-event credibility signal. The protocol's machine-processable design admits both human and automated production identically.

**4. Residual risk: Medium.** Bounded by trust-filtering and community corroboration norms. Elevated as LLM-generation capability improves and costs decrease. The structural defense is that trust is anchored to pubkeys, not content plausibility — but this defense weakens when trusted organizations deploy AI publishing pipelines without disclosure.

---

#### T-EC-05 — Economic and Social Signal Manipulation

| Field | Value |
|---|---|
| Adversary | Sybil Amplifier, Spam/DoS Attacker, Occasionally Lying Publisher |
| Assets | A2 Metadata events, A3 Binding events, A12 Pubkey-to-reputation mappings |
| Spec | §3.1 (NIP-18, NIP-25, NIP-57) |

**1. Problem.** The protocol acknowledges NIP-18 (Reposts), NIP-25 (Reactions), and NIP-57 (Lightning Zaps) as optional consumer-side signals (§3.1). These are not required for protocol conformance, but implementations MAY use them for ranking, attention, or importance. This creates attack surfaces:

- **Repost brigading (NIP-18):** A Sybil Amplifier or trusted Occasionally Lying Publisher reposts attacker-controlled Metadata events from trusted keys, giving those events amplified visibility. Because reposts are queryable via `#e` filters, a client using repost counts as a ranking signal may surface attacker content higher.
- **Reaction brigading (NIP-25):** Coordinated negative reactions (`kind: 7`) from Sybil keys suppress legitimate Metadata events in clients that downrank by negative sentiment. Conversely, positive reactions boost attacker content.
- **Zap manipulation (NIP-57):** A rich attacker uses high-value Lightning Zaps to create economic legitimacy signals. A Metadata event with 10,000 sats in zaps appears more credible to clients using zap counts as economic importance signals, regardless of factual accuracy.

All three signals are orthogonal to the protocol's trust model: they operate on consumer behavior, not publisher authority. A client that naively weights these signals without trust-filtering the signalers creates a bypass around §6's admission rules.

**2. Mitigation.** Trust filtering is the primary defense: untrusted pubkeys are invisible regardless of their signal volume. For signal aggregation, implementations SHOULD weight reposts, reactions, and zaps by the signaler's trust status — a repost from a trusted key carries weight; a repost from an untrusted key does not. The protocol does not mandate ranking algorithms, but the trust model's admission rules (§6) naturally constrain signal abuse to the user's trust perimeter.

**3. Gap.** The protocol deliberately does not define ranking algorithms or signal-weighting schemes. This is a client-layer concern. However, naive clients that count raw signals without trust weighting are directly vulnerable. No protocol-level rate-limiting on reactions, reposts, or zaps per target event. No mechanism to detect coordinated signal campaigns from distributed Sybil keys.

**4. Residual risk: Medium.** Bounded by trust filtering for curated users. Higher in scenarios with wide trust-radius expansion (N-hop WoT) where Sybil keys gain signal visibility. Economic signal manipulation (zaps) is constrained by Lightning Network cost but remains viable for well-funded attackers.

---

### §6.8 — Protocol Interactions

#### T-PI-01 — Legal Pressure Vectors

| Field | Value |
|---|---|
| Adversary | Hostile Vendor |
| Assets | A2 Metadata events, A1 Product events, A3 Binding events |
| Spec | §7.5 censorship paragraph |

**1. Problem.** Publishing negative security findings about commercial products triggers multiple legal exposure vectors: DMCA takedown notices (US), trade-secret misappropriation claims, Computer Fraud and Abuse Act (CFAA) allegations, defamation suits, and contractual breach claims. The target may be the publisher (forcing retraction or deterring future publication), the relay operator (forcing event suppression), or the artifact host (forcing payload takedown). Crucially, a coerced kind 5 deletion is indistinguishable from a voluntary one — the protocol has no mechanism for a publisher to signal "I retracted this under duress" without further legal exposure. Other researchers observing litigation against a peer may self-censor, creating a chilling effect that scales beyond the individual case.

**2. Mitigation.** Multi-relay replication makes complete suppression difficult even if the original publisher retracts. Kind 5 events are stored alongside originals per relay policy (§10) — retracted content remains auditable. Multi-jurisdictional relay and artifact-host distribution limits the reach of any single legal regime. The protocol's append-only retraction model preserves the original event for forensic purposes.

**3. Gap.** No protocol-level distinction between voluntary and coerced retraction. No whistleblower protection or collective defense mechanism. No safe-harbor framework for relay operators or publishers. The protocol cannot grant legal immunity, and its architectural defenses (replication, distribution) are jurisdictional, not cryptographic. The chilling effect on legitimate security research is real and well-documented.

**4. Residual risk: Medium.** The protocol's replication model provides resilience, not immunity. Effectiveness depends on jurisdictional diversity of relays and hosts — an ecosystem property. The chilling effect is a sociological phenomenon the protocol cannot prevent.

---

#### T-PI-02 — NIP-09 Semantic Tension (Deletion vs. Audit Trail Preservation)

| Field | Value |
|---|---|
| Adversary | Malicious Relay Operator |
| Assets | A5 Kind 5 deletion events, A6 Canonical chains, A7 Canonical views, A4 Patch events |
| Spec | §10, §7.3 orphaned disputes |

**1. Problem.** SCRUTINY relies on NIP-09 kind 5 deletions as the sole deletion mechanism (§10). However, NIP-09 semantics and SCRUTINY's audit-trail requirements create tension. NIP-09 states that relays MAY delete the target event entirely — physically removing it — while SCRUTINY's relay policy (§10) RECOMMENDS storing deletion events alongside originals, preserving the audit trail. A relay that honors NIP-09 by physically deleting the target destroys SCRUTINY's auditability: the historical state is irrecoverable from that relay. A relay that stores both preserves auditability but violates a strict reading of NIP-09. Additionally, a kind 5 deletion targeting a patch triggers SCRUTINY's topology cascade (§10): the patch and all its canonical-chain descendants are invalidated. This is a SCRUTINY-specific semantic layered atop a generic Nostr primitive — a generic Nostr client unaware of SCRUTINY sees a simple deletion, not a cascade. Foreign patches that referenced the deleted patch become orphaned annotations per §7.3.

**2. Mitigation.** The spec's relay policy (§10) explicitly recommends storing deletion events alongside originals. Topology cascade is deterministic — given the same events, every compliant client computes the same cascade outcome. Kind 5 validation (§10) requires verifying pubkey match before applying deletion — the deletion's `pubkey` must match the target event's `pubkey`. Orphaned-dispute handling (§7.3) preserves foreign opinions that referenced now-deleted canonical state, with appropriate warning annotations.

**3. Gap.** Relay behavior is not uniform: some relays physically delete per strict NIP-09, others retain per SCRUTINY recommendation. A client querying a mix of relays sees different deletion states. Generic Nostr clients consuming SCRUTINY events have no awareness of topology cascade semantics. The protocol layers SCRUTINY-specific deletion semantics on a Nostr primitive with different intended semantics — creating an impedance mismatch that manifests as behavioral inconsistency across relay implementations.

**4. Residual risk: Medium.** Audit-trail preservation depends on relay operator compliance with SCRUTINY's retention recommendation, which contradicts strict NIP-09 interpretation. The tension is inherent to repurposing a Nostr primitive beyond its original semantics. Bounded by the spec's explicit relay-policy guidance and multi-relay diversification.

---

#### T-PI-03 — Cryptographic Agility Gap

| Field | Value |
|---|---|
| Adversary | N/A (structural, long-horizon) |
| Assets | A1–A5 All event types, A10 Attached artifacts |
| Spec | §3.1 NIP dependencies |

**1. Problem.** Nostr hardcodes secp256k1 for event signatures and SHA-256 for event ID computation (NIP-01). SCRUTINY inherits this dependency without abstraction (§3.1). Under quantum-capable adversaries or major cryptanalytic breakthroughs, historical and live event signatures become forgeable, event IDs become subject to collision attacks, and the entire integrity and authenticity foundation unravels. There is no post-quantum cryptographic (PQC) migration path defined in Nostr or SCRUTINY. Any migration would require a new Nostr event format, new kind numbers, or a parallel signing scheme — all breaking changes to both protocol layers.

**2. Mitigation.** None at the protocol level. The cryptographic primitives are inherited from Nostr without abstraction. The threat is acknowledged as long-horizon: no known practical attacks on secp256k1 or SHA-256 exist today. SCRUTINY's dependency on standard Nostr primitives means any Nostr-level cryptographic migration automatically becomes SCRUTINY's migration path.

**3. Gap.** No cryptographic agility layer. No defined migration path for algorithm transition. No hybrid-signature scheme to ease gradual migration. The protocol's tight coupling to Nostr's cryptographic choices means SCRUTINY cannot independently evolve its cryptographic primitives — it is locked to Nostr's migration pace and decisions.

**4. Residual risk: Low (near-term) / High (long-term).** No practical attacks exist today. If the protocol is intended to persist across decades — which security metadata inherently requires for long-lived products — quantum migration becomes a concrete planning concern before it becomes a practical attack.

---

#### T-PI-04 — Snapshot Pin Staleness

| Field | Value |
|---|---|
| Adversary | Compromised Publisher |
| Assets | A3 Binding events, A6 Canonical chains, A7 Canonical views |
| Spec | §4.3 snapshot tags, §10 cascade |

**1. Problem.** Binding events carry optional `root:rev` and `link:rev` snapshot pins — references to specific patch event IDs representing "I evaluated this connection against state X" at binding time (§4.3). If the referenced patch is later kind 5-deleted, retracted, or the chain evolves beyond it, the snapshot pin points to a superseded or withdrawn state. The binding itself remains valid (snapshot pins do not affect binding validity). Clients SHOULD render a warning indicating the referenced state has been withdrawn (§10). However, the binding's relationship assertion was evaluated against a state that no longer exists — a user viewing the binding without seeing the warning or understanding its implications can incorrectly infer that the relationship still holds against the current canonical view. If the referenced patch introduced content that the binding depended upon (e.g., a vulnerability finding linked to a firmware version later removed), the binding becomes semantically stale — its premises dissolved — yet appears structurally intact.

**2. Mitigation.** Spec §10 explicitly addresses snapshot staleness: clients SHOULD render warnings when a snapshot references retracted state. Snapshot pins are informational and not part of a deduplication key (§4.3). The binding author chose the evaluation point; readers can compare the snapshot state against the current canonical view to assess staleness. The protocol does not auto-invalidate bindings whose snapshots become stale — this preserves historical audit context.

**3. Gap.** No automated staleness assessment. No mechanism for a binding author to update snapshot pins without deleting and republishing the entire binding. No protocol-level signaling of "this binding's evaluation premises have changed — re-evaluation recommended." The stale-snapshot binding sits in the graph indefinitely, presenting assertions evaluated against a state the root author has withdrawn. Users unfamiliar with snapshot semantics may miss the warning and treat the binding as current.

**4. Residual risk: Medium.** Semantic staleness, not cryptographic integrity failure. The binding's assertions remain attributable; the staleness is a contextual mismatch between evaluation premises and current state. The client-side warning (SHOULD) bounds the risk for attentive users; inattentive or automated consumption inherits the staleness uncritically.

---

## §7 — Residual Risks

The following limitations are structural consequences of the protocol's design decisions and its inheritance of Nostr's architecture. They cannot be eliminated at the protocol layer and must be addressed by the ecosystem.

### 7.1 Design-Inherent Trade-offs

**Key compromise with no revocation.** No protocol-level recovery from nsec compromise. This is the single most critical architectural gap, inherited from Nostr (no adopted key-revocation NIP). A compromised high-authority key retains full authority indefinitely — there is no mechanism to invalidate it, delegate to a successor, or broadcast revocation that all clients honor. Recovery is social and asynchronous.

**Timestamp trust dependency.** `created_at` is self-reported and consumed by fork resolution — the primary ordering primitive for canonical chains. All ordering-dependent logic (default-head selection, first-publisher visibility) is structurally vulnerable to manipulation. OTS (MAY) mitigates but is gated on voluntary adoption with currently low ecosystem uptake.

**Plaintext query privacy.** Nostr REQ subscriptions leak exact client interests in plaintext to relay operators. No private-information-retrieval primitive exists in Nostr. Organizational participants face a structural trade-off between ecosystem participation and operational security. This is inherited from NIP-01 and cannot be addressed without a fundamental Nostr protocol change.

**Artifact-fetch privacy leakage.** External `imeta` retrieval exposes requester identity and interest to artifact hosts over a separate HTTPS channel from the relay connection. Hash verification protects integrity of fetched bytes; nothing protects privacy of the fetch itself. Tracking-beacon-style URLs exploit this channel for surveillance correlation.

### 7.2 Bootstrap Vulnerabilities

**Trust bootstrap.** The WoT model is sound at maturity but undefined at genesis. Default trust-list creation, signing, distribution, updating, and revocation are all unspecified. The bootstrap phase — when the user has no basis for trust decisions — is the period of maximum vulnerability with minimum protocol-level protection.

**Canonical-view completeness.** The protocol guarantees event integrity (signatures) but not view completeness. A client can never know it has seen all relevant events for a product or identifier. This is inherent to any decentralized, relay-mediated system without a global consensus layer.

**Canonical-view determinism across implementations.** Different clients connected to different relay subsets may compute divergent canonical views from non-identical input patches. Individual event integrity is protected; inter-client state consistency is not guaranteed. This is a consequence of the relay-mediated architecture combined with eventual-consistency publication dynamics.

### 7.3 Excluded Concerns

The following are explicitly excluded from this threat model:

- **Schnorr signature forgery.** Mathematically infeasible under current cryptanalytic knowledge; no known practical attacks on secp256k1 exist.
- **SHA-256 collision attacks.** Astronomically negligible probability; no known practical SHA-256 collision exists.
- **Secp256k1 nonce reuse.** Key-management hygiene concern, not a protocol vulnerability. Properly implemented signing libraries prevent nonce reuse.
- **TLS downgrade and certificate validation.** Transport-layer concerns outside the protocol's scope. SCRUTINY assumes standard TLS for relay connections.
- **DNS poisoning of relay URLs.** DNS infrastructure concern; mitigated by TLS certificate validation and relay pubkey pinning (where supported).
- **Compromised developer supply chain.** A compromised client/bot/build-pipeline breaks every protocol-level security assumption simultaneously. The protocol's portability (multiple independent implementations) provides theoretical resilience, but no certification, conformance-testing, or reproducible-build requirement exists. Noted here as an ecosystem-level residual risk.

### 7.4 Surface Normalization Precision

Line-ending normalization (`\r\n` → `\n`), trailing-newline handling, and locale-dependent sorting edge cases (Unicode collation differences across implementations) may produce bytewise-divergent surface serializations from semantically identical events. Consequence: two clients with different `i` surface sort orders produce conflicting diffs during patch application, causing HALT divergence. Current spec §5.1 canonical-form normalization addresses line endings and UTF-8 encoding but does not fully specify Unicode collation order for `i` surface sorting beyond "sorted lexicographically by the full `<prefix>:<value>` string." Implementations disagreeing on byte-level sort order of non-ASCII identifiers produce mutually incompatible canonical views. Risk is bounded to ecosystems where non-ASCII canonical identifiers are prevalent.

---

## §8 — Boundary Matrix

| Responsibility | Protocol Layer | Ecosystem / Client Layer |
|---|---|---|
| Event integrity (signature verification) | Secp256k1 signatures over SHA-256 event IDs (inherited from NIP-01). Signatures MUST be verified. | — |
| Event availability | Multi-relay design; portable event format; relay hints in `e` tags | Relay operators; archival practices; community mirroring |
| Artifact availability (`imeta` files) | SHA-256 hash for integrity verification only | Hosting providers; content-addressed storage; mirror networks; archive services |
| Trust-list curation | Structure defined (§6.1): pubkey allowlists, WoT expansion rules | Users; client defaults; community governance; default-list signing and distribution |
| Trust bootstrap | Not addressed — structure exists but genesis is undefined | Client distributors; community seed lists; bootstrapping ceremonies |
| Content sanitization | Not addressed — `content` is free-form by design (§4) | Client implementations (XSS prevention, markdown rendering, link handling) |
| Key management and revocation | Not addressed — acknowledged as structural gap (§7.5) | Users; key management tools; social processes for compromise announcement |
| Identity attestation | Not addressed — permissionless by design (§7.5) | Out-of-band verification; organization websites; third-party key registries; community reputation |
| Timestamp verifiability | NIP-03 OTS (MAY); `created_at` for fork resolution (§7.2) | OTS adoption; client timestamp anomaly detection |
| Query privacy | Not addressed — inherited Nostr limitation (plaintext REQ) | Tor/VPN routing; broad filters with local post-filtering; relay selection discipline |
| Artifact-fetch privacy (`imeta`) | Integrity hash only; no anonymity model | Proxy retrieval; artifact mirroring; anti-tracking fetch policies; URL inspection |
| Spam and DoS mitigation | Optional PoW (NIP-13, MAY); SCRUTINY `t` tags for filtering | Relay-side rate limiting; client-side trust filtering; community moderation |
| Kind 5 deletion behavior | Deletion semantics defined (§10) — topology cascade, orphan handling, relay policy | Relay operator compliance with retention recommendation; client implementation of cascade logic |
| Cryptographic agility | Not addressed — inherited primitives from Nostr | Dependent on Nostr protocol evolution; hybrid-scheme proposals |
| Identifier squatting defense | Trust filtering; multiple competing events permitted; no authoritative validation | Community-maintained pubkey-to-authority mappings; registry cross-reference tooling |
| AI-generated content management | Not addressed (§2 principle 4 positions AI as consumer, not producer) | Publisher disclosure norms; community review processes; external verification tools |
| Client correctness | Computation rules defined (§5.3, §7.4); conformance assumed | Conformance testing; code audits; reproducible builds; multiple independent implementations |

---

## §9 — Summary Table

| ID | Name | Problem | Mitigation | Gap | Risk |
|---|---|---|---|---|---|
| T-DI-01 | Timestamp manipulation | Self-reported `created_at` enables backdating and fork hijacking via default-head selection | OTS (MAY); tie-break on event ID hash; root author can kind 5-delete unwanted tips | OTS adoption is voluntary; no relay-side rejection of anomalous timestamps; trust in publisher honesty for ordering | High |
| T-DI-02 | Fork resolution determinism | Different relay subsets produce different visible patch sets, yielding divergent canonical views | Surfacing multiple tips; kind 5 cascade pruning; multi-relay querying | No cross-client consistency verification; determinism holds only within per-client visible patches | Medium |
| T-DI-03 | Retraction propagation gaps | Kind 5 deletions withheld by relays produce stale canonical views where deleted patches remain applied | Local caching of kind 5 events; multi-relay querying; relay retention recommendation (§10) | No mechanism ensuring kind 5 propagation to all relays; NIP-09 honoring is optional at relay layer | Medium |
| T-DI-04 | Binding relationship ambiguity | Free-form relationship semantics with advisory hints create mismatch between machine-processing and human interpretation | `content` authoritative over hints; attributable authorship; kind 5 deletion enables correction | No relationship vocabulary validation; retract-and-republish correction is non-atomic | Low–Medium |
| T-DI-05 | Cherry-pick attribution laundering | Root author adopts foreign diff without crediting source; omitted or falsified `cherry-pick` references | Informational attribution; root author accountable for chain state; forensic diff comparison possible | No enforcement of attribution accuracy; no verifiable link between diff and claimed source | Medium |
| T-DI-06 | Attached content integrity | Imeta-attached diffs vulnerable to host compromise and split-world attacks; inline diffs are signature-protected | SHA-256 hash verification (MUST); inline diffs as primary path; multi-source retrieval via hash | No artifact mirroring requirement; split-world attacks undetectable without cross-client comparison | Medium |
| T-ID-01 | Key compromise — no revocation | Stolen nsec grants full chain sovereignty; post-compromise events indistinguishable from legitimate | Social recovery: announce compromise, rotate key, rebuild trust | No protocol-level revocation, rotation, or emergency broadcast mechanism in Nostr or SCRUTINY | Critical |
| T-ID-02 | Sybil amplification | Thousands of keys placed within WoT expansion radius flood user's view with attacker-controlled events | Trust filtering; SHOULD-level expansion warning; binding admission requires direct author trust | No protocol-level Sybil resistance; no depth weighting; warning is non-normative | Medium |
| T-ID-03 | Identifier squatting | Self-asserted `i` tags claim authoritative identifiers without validation; first-mover advantage via backdating | Trust filtering; multiple competing events permitted; canonical identifier clustering | No cross-reference with authoritative registries; no priority for legitimate authority keys | Medium |
| T-ID-04 | Unverifiable identity claims | Any pubkey can claim any real-world identity; protocol delegates verification to out-of-band trust | Permissionless by design; cryptographic attribution permanent; trust lists curated out-of-band | No in-protocol identity binding; new users lack discrimination basis during bootstrap | Low–Medium |
| T-ID-05 | Author hint forgery | `e` tag author hints may lie about referenced event's pubkey; pre-fetch UI displays misleading attribution | Hint MUST NOT gate admission; actual pubkey used for trust decisions; discrepancy flagged per §4.3 | Pre-fetch optimism window; non-compliant clients may silently accept hints | Low |
| T-AV-01 | Spam and graph pollution | High-volume valid SCRUTINY events consume relay storage and pollute discovery for permissive-trust users | Trust filtering; PoW (MAY); SCRUTINY-specific `t` tags for relay isolation | PoW unenforced by default; no per-author rate limit; kind 1 namespace shared with social posts | Medium |
| T-AV-02 | Graph traversal amplification | Pathological topologies (deep chains, extreme fan-out) exhaust client resources during binding traversal | Trust filtering bounds fan-out; cycle detection in Chain computation (§7.4) | No depth/fan-out limits for binding traversal; no mandated resource budgets | High |
| T-AV-03 | Event size exceeding relay limits | Large patches or embedded payloads rejected by relays with low size caps; per-relay rejection variance | Imeta + Blossom for >30 KB (§4.5); text-efficient diff format; publisher sees immediate rejection | No normative size guidance; relay-specific limits unknown without per-relay probing | Low |
| T-AV-04 | Artifact hosting fragility | URL rot, takedown propagation, and split-world attacks make imeta-attached artifacts unreliable over time | SHA-256 enables multi-source verification; inline diffs immune (#1 lookup path); multi-relay redundancy | No mirroring/pinning requirement; no fallback URL set; single-source hosting is fragile | Medium |
| T-AV-05 | Prose-only patch abuse | Non-mutating patches extend chains indefinitely, amplify computation cost without semantic contribution | Prose-only patches contribute zero surface changes; canonical surfaces unaffected | No distinction between mutating/non-mutating patches; chain-length accumulation unbounded | Low |
| T-DC-01 | Inconsistent relay NIP support | Empty `#i` results indistinguishable from unsupported filter; silent discovery blackout on non-compliant relays | Cross-relay checking mandated for `#i` (§8.0); local caching of deletions; ≥3 relay baseline recommended | No wire-level capability negotiation; NIP-11 advertising is honor-system | Medium |
| T-DC-02 | WoT bootstrap trap | New users have empty trust lists; every bootstrap vector (defaults, community, docs) is an attack surface | Multiple bootstrap paths; user agency over trust decisions; community diversification | No protocol-level bootstrap ceremony; no signing/versioning for default lists; maximum vulnerability at genesis | High |
| T-DC-03 | Identifier mirror infidelity | Patches adding identifiers via diff may omit corresponding `i` tags, making additions invisible to `#i` discovery | Publisher mirroring responsibility (§4.4.1); client MUST resolve patches to roots and verify presence | No relay-side enforcement of mirroring; accidental omission or deliberate suppression undetectable | Medium |
| T-DC-04 | Patch-to-root resolution gap | `#i` matches on patches require expensive canonical-view computation to confirm identifier currency | Client MUST resolve to root and verify (§8.3); canonical-view computation defined in §7.4 | Per-query resolution cost grows with chain length; naive clients may skip resolution | Medium |
| T-CE-01 | Relay-level event suppression | Relays omit events from filter results; clients on single relay see censored graph | Multi-relay querying; ≥3 relay recommendation; event portability; Blossom artifact redundancy | No relay transparency mechanism; small relay sets enable coordinated censorship | Low–Medium |
| T-CE-02 | Eclipse attack | Client isolated to attacker-controlled relay set; graph view fabricated by selective omission | Cryptographic event verification (forgery impossible); relay diversity; out-of-band relay discovery | No view-completeness check; undetectable from inside protocol for non-technical users | Low–High |
| T-CE-03 | Economic/legal relay coercion | Hostile vendor pressures relay operators across jurisdictions to suppress unfavorable findings | Multi-relay replication across jurisdictions; event portability; Blossom separate infrastructure | Cannot prevent legal coercion; jurisdictional concentration enables coordinated pressure | Medium |
| T-SV-01 | Plaintext REQ filter leakage | Relay operators see exact query parameters, building interest profiles for connected clients | None at protocol level; honest-but-curious baseline declared (§7.5) | No private retrieval in Nostr; plaintext filters foundational to NIP-01 | High |
| T-SV-02 | Organizational query pattern exposure | Aggregate `#i:cpe:...` queries reveal technology stack and vulnerability response timeline to relays | Same as T-SV-01: operational defenses only | Organizational exposure structural; read-only participation sufficient for leakage | Medium–High |
| T-SV-03 | Artifact host tracking | Imeta fetches expose requester IP/timing to artifact hosts; tracking URLs enable beacon-style correlation | Hash verification protects content integrity; operational proxy/mirror defenses | No private artifact retrieval; no anti-tracking guidance in spec | High |
| T-EC-01 | Indexer re-centralization | Canonical-view computation cost incentivizes centralized indexers; dominant indexer becomes single point of failure/control | Open, portable data model; independent reproducibility; multiple indexers feasible | No standard query API for interchangeability; no completeness verification | Medium |
| T-EC-02 | Default trust list compromise | Tampered default lists inject attacker keys into every new user's trust set, nullifying all security goals | Multiple bootstrap paths; user can refine over time; community detection possible | No signing/versioning/attestation for default lists; no provenance verification for new users | High |
| T-EC-03 | Kind 1 namespace coupling | Relay rate-limiting and storage policies for kind 1 events affect SCRUTINY uniformly with social posts | Version tagging; SCRUTINY-specific `t` tags for filtering; relays COULD exempt SCRUTINY traffic | No migration path to dedicated kind; relay policy changes affect SCRUTINY without awareness | Medium |
| T-EC-04 | AI-generated false metadata at scale | LLM pipeline under trusted key produces plausible but false findings indistinguishable from human work | Pubkey accountability; endorsement/corroboration from independent sources as signal | No human/AI distinction; no disclosure requirement; trust model not designed for AI-scale volume | Medium |
| T-EC-05 | Economic and social signal manipulation | Repost brigading, reaction brigading, and zap manipulation create false importance/sentiment signals around attacker content | Trust filtering bounds signal visibility to trust perimeter; signalers SHOULD be weighted by trust | No protocol-level rate-limiting on signals; naive clients may count raw signals without trust weighting | Medium |
| T-PI-01 | Legal pressure vectors | DMCA, trade secret, CFAA, defamation claims force retraction or deter publication; coerced deletion indistinguishable from voluntary | Multi-relay/jurisdictional replication; kind 5 retention preserves audit trail | No protocol distinction between voluntary and coerced retraction; no legal immunity | Medium |
| T-PI-02 | NIP-09 semantic tension | Relays may physically delete per strict NIP-09, destroying SCRUTINY audit trail; cascade semantics lost on generic clients | Relay policy recommends retention (§10); cascade deterministic; orphaned disputes handled (§7.3) | Behavioral inconsistency across relay implementations; impedance mismatch with NIP-09 intent | Medium |
| T-PI-03 | Cryptographic agility gap | Hardcoded secp256k1 + SHA-256 with no migration path; quantum/Cryptanalytic break would undermine all integrity | None at protocol level; dependent on Nostr protocol evolution | No agility layer; no hybrid-scheme transition plan; SCRUTINY locked to Nostr's cryptographic pace | Low/High |
| T-PI-04 | Snapshot pin staleness | Bindings referencing retracted or evolved patch states present assertions against withdrawn premises | SHOULD-level staleness warnings (§10); snapshots informational, not in dedup key | No automated staleness assessment; stale bindings persist indefinitely without semantic expiry | Medium |

---

## §10 — Recommendation Matrix

This section is reserved for external security review findings and prioritized remediation recommendations. The matrix structure is provided for completion.

| Priority | Threat(s) | Recommendation | Effort | Impact |
|---|---|---|---|---|
| — | — | — | — | — |
| — | — | — | — | — |
| — | — | — | — | — |

---

## §11 — Sources

1. **SCRUTINY Fabric Protocol Specification v0.5.3** — Primary source; all mechanical claims verified against this document.
2. **NIP-01** — Event structure, signatures, relay protocol (MANDATORY dependency).
3. **NIP-03** — OpenTimestamps attestations (MAY dependency, §7.2 timestamp verifiability).
4. **NIP-09** — Event deletion / kind 5 (MANDATORY dependency, §10 deletion and cascade).
5. **NIP-10** — Text note threading / `e` markers (MANDATORY dependency, chain topology).
6. **NIP-13** — Proof-of-Work / `nonce` tag (MAY dependency, §3.1 spam deterrence).
7. **NIP-73** — External content IDs / `i` tag (MANDATORY dependency, canonical identifiers).
8. **NIP-92** — Media attachments / `imeta` tag (OPTIONAL dependency, artifact hosting).
9. **ETSI TS 102 165-1** — Telecommunications and Internet converged Services and Protocols; Threat, Vulnerability and Risk Analysis (TVRA). Methodological alignment reference for qualitative risk assessment structure.
10. **OpenTimestamps** — Bitcoin-anchored timestamp proofs. https://opentimestamps.org/
11. **Blossom** — Nostr-native content hosting for imeta-referenced artifacts.
12. **Web beacon / tracking pixel mechanisms** — Background reference for T-SV-03 artifact-host tracking analysis. PETS 2018: "Privacy Implications of Email Tracking."