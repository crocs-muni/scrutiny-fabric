# SCRUTINY Fabric — Threat Model

**Protocol version:** 0.4.0  
**Document status:** Draft  

---

## 1. Scope

**System under analysis:** SCRUTINY Fabric, a decentralized protocol for linking products to security-relevant metadata (vulnerabilities, certifications, audits, test results) over the Nostr network.

**In scope:**
- The SCRUTINY data model: ProductEvents, MetadataEvents, BindingEvents, UpdateEvents, RetractionEvents.
- Trust model, endorsement aggregation, and Web of Trust bootstrap.
- Inherited Nostr protocol properties relevant to SCRUTINY.
- Relay behavior insofar as it affects SCRUTINY availability and integrity.
- The Effective View algorithm (client-side state computation).

**Out of scope:**
- Specific client implementations.
- Relay software internals beyond observable behavior.
- Key generation and storage practices.
- Legal and regulatory compliance (noted where relevant, not modeled).

---

## 2. Security Goals

| Property | Description |
|----------|-------------|
| **Integrity** | Events are tamper-evident. Content is bound to its author via cryptographic signatures. |
| **Authenticity** | Every event is attributable to a specific public key. |
| **Censorship resistance** | No single relay, vendor, or authority can suppress publication or discovery of metadata. |
| **Trust separation** | Users select their own trusted sources. No global authority dictates which metadata is valid. |
| **Discoverability** | Given a product, a client can traverse the binding graph to find all affiliated security metadata. |
| **Auditability** | Historical state remains recoverable. All changes are atributable to the specific pubkey. |
| **Portability** | Events are portable and replicable across multiple generic Nostr relays and external archives. |

---

## 3. Assumptions and Trust Model

**Trusted:**
- The user's own pubkey trust list (set of user chosen trusted public keys).
- Cryptographic primitives (Schnorr signatures over secp256k1, SHA-256).

**Partially trusted:**
- Transitive trust: possible to view events from pubkeys followed by trusted pubkeys.
- Relays: expected to store and serve events honestly, but not guaranteed to do so. Any individual relay may censor, drop, or selectively serve events.
- Default pubkey/relay trust lists shipped with clients: assumed honest at distribution time, but a supply-chain target.

**Untrusted:**
- Arbitrary Nostr public keys. Any key can publish any event.
- Event timestamps (`created_at` is self-reported, not verified).
- Canonical identifiers (`i` tags): self-asserted, not validated by the protocol.
- Artifact URLs in `imeta` tags: external, mutable hosting.

**Key design assumptions:**
- Security depends on users maintaining a curated pubkey trust list.
- Multi-relay replication compensates for individual relay failures or censorship.
- Clients correctly implement the Effective View algorithm, trust filtering, and Nostr signature validation.
- Nostr's `kind: 1` semantics and the NIPs used by SCRUTINY v0.4 (NIP-01, NIP-03, NIP-10, NIP-13, NIP-25, NIP-31, NIP-32, NIP-56, NIP-57, NIP-92) remain stable ([NIP index](https://github.com/nostr-protocol/nips/blob/master/README.md), [SCRUTINY v0.4 spec](https://github.com/crocs-muni/scrutiny-fabric/blob/main/docs/protocol-spec.md)).

---

## 4. Attacker Model

The following adversary archetypes are referenced throughout this document. The first three describe infrastructure-level capability classes inherent to the Nostr network architecture. The remaining describe motivation-specific actors who leverage those capabilities toward particular goals. They are not mutually exclusive; a state-level adversary may combine several, and a single real-world entity (e.g., a vendor with legal resources and a compromised insider) may span multiple archetypes simultaneously.

"Deleted raw metadata" (external artifact unavailability due to hosting failures, domain expiry, or deliberate takedown by the host) is not modeled as an adversary. It is an environmental failure mode addressed in T31.

| Archetype | Capabilities | Cannot Do | Relevant Threats |
|-----------|-------------|-----------|------------------|
| **Malicious Relay Operator** | Controls relay storage and serving logic. Can censor, delay, reorder, or selectively serve events. Can observe all subscription filters and connection metadata (pubkeys, queried products, IP addresses). Can drop RetractionEvents while keeping the original. Can correlate query patterns across connected clients to build interest profiles. | Cannot forge or modify signed events. Cannot observe encrypted relay connections from other relays. Cannot prevent clients from discovering the same events via alternative relays. | T3, T12, T14, T17, T18, T19, T20 |
| **Compromised Publisher** | Holds a valid Nostr private key — their own (dishonest author) or stolen (key compromise). Can publish, update, and retract any event authoritative to that key. Can craft `created_at` timestamps freely. Can create arbitrarily many keypairs for Sybil operations. | Cannot modify events signed by other keys. Cannot force relays to serve or suppress specific events. Cannot bypass trust filtering on clients where the key is not trusted. | T1, T2, T4, T6, T7, T8, T9, T10, T16, T28 |
| **Network-Level Attacker** | Can intercept, drop, or redirect WebSocket connections between clients and relays. Can isolate a client to a controlled relay set (eclipse). Can perform traffic analysis on connection timing and volume. May control network infrastructure (ISP, corporate firewall, state-level network). | Cannot break TLS without a compromised CA. Cannot forge Nostr event signatures. Cannot read encrypted payloads. Cannot modify events in transit (TLS integrity). | T3, T18, T19, T20 |
| **Hostile Vendor** | A commercial entity whose product has unfavorable security findings in the SCRUTINY graph. **Censorship vector:** Can exert economic pressure on relay operators (hosting contracts, direct payments, business relationships) and legal pressure (DMCA notices, cease-and-desist letters, contractual leverage over hosting providers) to suppress specific events across multiple relays simultaneously. **Litigation vector:** Can initiate or threaten lawsuits against individual publishers (trade secret claims, computer fraud statutes, defamation suits) to force retractions or deter future publication. Has financial resources to sustain multi-jurisdictional legal campaigns. Can create chilling effects across the researcher community by making an example of one publisher. | Cannot forge or modify signed events. Cannot prevent re-broadcast of events from external archives or Blossom servers outside their legal reach. Cannot distinguish a voluntary retraction from a coerced one at the protocol level (which cuts both ways — the coercion is invisible to the network). Cannot suppress events stored across relays in jurisdictions beyond their legal authority. | T27, T36, T37 |
| **Occasionally Lying Publisher** | Holds a trusted key with an established track record of accurate, valuable contributions. Maintains this reputation deliberately to maximize the impact of intermittent false publications. Can inject subtly misleading metadata (e.g., downgrading vulnerability severity, fabricating passing test results, attributing a CVE to the wrong product version) that inherits the key's full trust weight. Can time false publications to coincide with high-impact disclosure windows. The false entries are mixed with genuine work, making detection difficult. | Cannot override trust filtering on clients where the key is not trusted. Cannot prevent post-hoc forensic attribution — all false publications are permanently signed by the key. Cannot manipulate events signed by other keys. Cannot prevent other trusted parties from publishing contradicting findings. | T30 |
| **Misbehaving Malicious LLM** | An AI model deployed as an automated metadata generation pipeline — either by an attacker (deliberate) or a legitimate operator (misconfigured, poisoned, or hallucinating). Can generate MetadataEvents with coherent, technically detailed `content` fields, appropriate labels, valid canonical identifiers, and plausible `imeta` artifacts at scale and speed far exceeding human capacity. Output is syntactically indistinguishable from human-authored expert analysis. Can operate under a trusted key if deployed by a trusted organization. | Cannot bypass trust filtering — output is only visible to users who trust the publishing key. Cannot produce events that are cryptographically distinguishable from human-authored events. Cannot independently gain trust — requires either a compromised key (T6) or deployment by an already-trusted organization. Cannot generate findings that will receive independent corroboration from other trusted sources (low endorsement count is a natural signal). | T40 |
| **Compromised Developer** | Has commit access to a SCRUTINY client application, bot, indexer, or library — either as a malicious insider or through a compromised development account or build system. Can introduce backdoors or subtle bugs: silent event suppression (soft censorship), query metadata exfiltration (surveillance), weakened signature verification or trust filtering (enabling other attacks), altered data import logic in bots (integrity corruption at the seeding layer). A build system compromise can inject malicious code into distributed binaries without modifying the source repository. | Cannot corrupt the underlying Nostr events or relay-stored data — only the client's interpretation of them. Cannot prevent detection through source code audits, reproducible builds, or independent client implementations. Cannot affect users who use a different, uncompromised client. | T23, T38 |
| **scrutiny.cloud Impostor** | Creates web services, relays, or client applications mimicking official SCRUTINY infrastructure (e.g., `scrutiny-fabric.io`, `scrutiny.network`). Can distribute tampered default trust lists, recommended relay lists, or pre-built client software. Targets new users during the bootstrap phase when brand recognition is weakest. Can register similar domain names, replicate project branding, and create convincing documentation. May combine with Compromised Developer techniques (distributing backdoored client binaries). | Cannot forge Nostr event signatures from legitimate SCRUTINY project keys. Cannot prevent users from independently verifying event signatures or comparing trust lists against known-good sources. Cannot affect users who obtained their client and trust list from a legitimate distribution channel. | T15, T23, T33 |
| **Product Impostor / Hijacker** | Holds a valid Nostr key (their own, not stolen). Publishes ProductEvents claiming products belonging to other vendors — using accurate canonical identifiers (CPE, PURL), plausible labels, and convincing `content` descriptions. Can backdate events (T1) to claim first-publisher status. Can author UpdateEvents on their impostor ProductEvent, altering product metadata over time. Can publish BindingEvents linking the impostor product to fabricated or misleading metadata. Targets products whose actual vendors have not yet entered the SCRUTINY ecosystem. | Cannot publish UpdateEvents or RetractionEvents targeting ProductEvents signed by the real vendor's key. Cannot bypass trust filtering on clients where the impostor's key is not trusted. Cannot prevent the real vendor from publishing a competing, legitimate ProductEvent. | T8, T16, T32 |
| **Defaming Consumer** | Holds a valid Nostr key. Publishes fabricated negative findings — fake vulnerability reports, doctored test results, forged screenshots, AI-generated PDF reports — as MetadataEvents, and creates BindingEvents linking them to a target product. May build minimal trust over time before launching the attack. Can produce artifacts that are superficially convincing but cannot be cryptographically disproven (there is no way to prove a vulnerability does not exist). Creates an asymmetric burden: the vendor must investigate and contest each false claim individually, while the attacker can generate them cheaply. | Cannot bypass trust filtering on clients where the key is not trusted. Cannot remove or modify the permanent cryptographic attribution linking the false claims to the attacker's pubkey. Cannot prevent other trusted parties from publishing competing findings that contradict the false claims. Cannot forge signatures from the target vendor's key. | T34 |
| **Spam/DoS Attacker** | Can generate large volumes of syntactically valid SCRUTINY events (fake ProductEvents, meaningless MetadataEvents, nonsensical BindingEvents) at low cost using automated tooling. Can target specific products with high-volume event floods to exhaust relay storage or degrade client-side graph traversal. Can upload large files to artifact hosts to consume hosting quotas. Can systematically abuse Nostr feedback mechanisms (NIP-56 reports, NIP-25 reactions) to flag legitimate findings as spam or inaccurate, suppressing them in clients that downrank by report count. Can construct deep binding chains or extreme fan-out graphs to amplify client resource consumption. | Cannot bypass trust filtering — spam events from untrusted keys are invisible to clients with curated trust lists. Cannot forge signatures or impersonate trusted publishers. Cannot force relays to accept or retain events beyond the relay's own storage and rate-limiting policies. Cannot guarantee that report-based suppression will work against clients that weight reports by reporter trust. | T10, T11, T13, T35, T39 |

---

## 5. Risk Scoring Methodology

Residual risk ratings use a qualitative **Risk = Impact × Likelihood** assessment.

- **Impact** is measured directly against the security goals defined in Section 2 (Integrity, Authenticity, Censorship Resistance, Trust Separation, Discoverability, Auditability, Portability). A threat that permanently breaks Integrity or Authenticity with no protocol-level recovery path scores higher than one that temporarily degrades Discoverability or Portability under narrow conditions.
- **Likelihood** accounts for attacker cost and capability (mapped to the archetypes in Section 4), the number of preconditions required, and whether the vulnerability is a passive structural weakness inherent to the design or requires active, sustained exploitation.

| Rating | Definition | Example |
|--------|------------|---------|
| **Critical** | Breaks one or more core security goals (Integrity, Authenticity, Trust Separation) with no protocol-level recovery mechanism. Exploitation requires moderate effort from at least one attacker archetype. The damage is systemic and self-propagating once achieved. | Key compromise (T6): a stolen private key grants full authority over all events authored by that identity, with no in-protocol revocation path. |
| **High** | Causes significant, measurable degradation of a core security goal. Exploitation requires specific but realistic conditions — the attacker needs positional advantage or sustained effort, but not exotic capabilities. Partial mitigations exist in the design but leave material gaps. | Timestamp manipulation (T1): self-reported `created_at` is directly consumed by the Effective View algorithm, and the optional OpenTimestamps mitigation has no adoption mandate. |
| **Medium** | Partially degrades a security goal, but the impact is bounded by client implementation quality, ecosystem maturity, or the attacker's ability to sustain the attack. Active effort is required and the payoff is conditional. | Sybil endorsement inflation (T7): fabricated trust edges only succeed if the target user's trust list is permissive or poorly curated. |
| **Low** | Causes minor or operational impact under unlikely configurations or with low attacker payoff. The attack surface is narrow, easily detectable, or the consequence is self-limiting. | Event size exceeding relay limits (T13): a purely operational concern with no direct compromise of a security goal. |

Range ratings (e.g., Low–High) indicate that the residual risk varies substantially depending on client implementation quality or deployment context. The lower bound assumes a well-implemented, security-conscious client; the upper bound assumes a naive or default-configured client.

---

## 6. Threats

### 6.1 Data Integrity Threats

#### T1 — Timestamp manipulation

**Problem:** The `created_at` field in Nostr events is self-reported by the publisher with no relay-side or protocol-level verification. A Compromised Publisher can backdate events to falsely claim first-publisher status for a product or vulnerability identifier, or future-date UpdateEvents to hijack the Effective View ordering (which processes updates by ascending `created_at`, then lexicographic `id`). This directly undermines the **Integrity** and **Auditability** goals: the historical ordering of the graph becomes attacker-controlled.

**Mitigation in the design:** NIP-03 OpenTimestamps is listed as an optional feature, particularly recommended for UpdateEvents to provide temporal provenance.

**Not solved by the protocol:** Timestamp validation is not required. No relay-side rejection of anomalous timestamps is specified. No client-side policy for flagging or discarding events with implausible timestamps is mandated. The Effective View algorithm consumes `created_at` without skepticism.

**Residual risk:** High. The Effective View algorithm is directly vulnerable to crafted timestamps. Mitigation depends entirely on client policy and voluntary OpenTimestamps adoption, neither of which is guaranteed.

---

#### T2 — Update ordering race condition

**Problem:** A Compromised Publisher who controls the original author key can craft UpdateEvents with specific `created_at` values designed to interleave with legitimate updates. Because the Effective View algorithm applies updates in chain order, the attacker can construct a chain that produces a desired final state — for example, overwriting a patched vulnerability status back to "vulnerable" or altering a certification label. This undermines **Integrity** by allowing the author (or someone who has stolen the author's key) to rewrite history in a way that appears deterministic.

**Mitigation in the design:** Updates require matching `pubkey` (author-only authority). Ordering within the chain is deterministic and based on the explicit `reply` linked list structure.

**Not solved by the protocol:** Deterministic ordering on a self-reported field does not prevent deliberate manipulation by the legitimate author or anyone who has compromised the author's key. No mechanism exposes the full update chain to end users for independent auditing.

**Residual risk:** Medium. Exploitable only by the original (malicious) author or after key compromise. Impact is amplified by T1 (timestamp manipulation) and T6 (key compromise).

---

#### T3 — Retraction suppression (split-view)

**Problem:** After a publisher issues a RetractionEvent, a Malicious Relay Operator or Network-Level Attacker can re-broadcast the original event to relays that have not received the retraction. Clients querying only those relays see retracted metadata as active. Conversely, a Malicious Relay Operator can drop the RetractionEvent while retaining the original, permanently splitting the network view. This breaks **Integrity** (retracted data appears valid) and **Auditability** (the retraction is invisible to affected clients).

**Mitigation in the design:** Retractions are append-only events, so they are not destructive. Multi-relay replication means the retraction exists somewhere in the network.

**Not solved by the protocol:** No mechanism ensures retractions propagate to all relays holding the target event. No relay-side requirement to index or co-serve retractions alongside the events they target. No client-side requirement to query multiple relays before accepting an event as non-retracted.

**Residual risk:** Medium. Exploits the structural gap between "retraction published" and "retraction universally visible." Risk increases if the practical relay set is small.

---

#### T4 — Binding relationship mislabeling

**Problem:** A Compromised Publisher publishes a BindingEvent with an incorrect relationship label (e.g., labeling a `vulnerability` as `patch`, or a `test` as `certification`). Because BindingEvents are strictly immutable and cannot be targeted by UpdateEvents, the incorrect label cannot be corrected in place. Correction requires a full retract-and-republish cycle, during which the mislabeled binding may remain visible on relays that have not received the retraction. This degrades **Integrity** and **Discoverability**: users following the graph may draw incorrect conclusions about a product's security posture.

**Mitigation in the design:** Trust-based filtering limits which bindings are visible. BindingEvents are signed and attributable, so a mislabeled binding is traceable to its author.

**Not solved by the protocol:** No schema validation of relationship labels against the referenced event content. The retract-and-republish correction path is not atomic, creating a window of inconsistency.

**Residual risk:** Low–Medium. Low if trust filtering is active and users verify binding content against labels. Higher for users with permissive trust settings or during the bootstrap phase.

---

#### T5 — Artifact integrity (`imeta` poisoning)

**Problem:** `imeta` artifacts are hosted on external, mutable URLs. After a MetadataEvent is published with a valid SHA-256 hash, the host (or an attacker who compromises the host) can replace the file at the URL with a malicious substitute — a weaponized PDF, a trojanized script, or a falsified test report. If clients do not verify the hash before rendering or executing the artifact, the **Integrity** guarantee is silently broken.

**Mitigation in the design:** The `x` tag provides a SHA-256 hash for integrity verification. The protocol spec (Section 3.3) specifies that clients SHOULD validate the hash by streaming the artifact content and comparing against the declared hash before trusting the artifact, and SHOULD enforce reasonable size limits.

**Not solved by the protocol:** Hash verification is specified as SHOULD, not MUST. No sandboxing, content-type enforcement, or content-addressed storage alternative is required. No guidance on what a client should do if the hash fails (reject silently? warn the user? quarantine?).

**Residual risk:** Low–High. Low if clients enforce hash verification strictly. High if they do not — this is entirely a client implementation dependency.

---

#### T30 — Occasionally lying publisher (intermittent false metadata)

**Problem:** An Occasionally Lying Publisher maintains a track record of accurate, valuable metadata contributions, building genuine trust and endorsement weight — then sporadically injects false or subtly misleading findings (e.g., downgrading a real vulnerability's severity, fabricating a passing test result for a flawed product, or attributing a CVE to the wrong product version). Because the publisher's overall reputation is high, the false entries inherit the same trust score as the legitimate ones. Unlike a Sybil attack (T7), this does not require multiple keys — a single, well-established identity is sufficient. This undermines **Integrity** and **Trust Separation**: the trust model assumes publishers are consistently honest or consistently untrustworthy, and has no mechanism for per-event credibility assessment.

**Mitigation in the design:** Endorsement deduplication means a single publisher contributes at most one endorsement edge per binding. Events are attributable and auditable, so post-hoc investigation can identify the source of false data.

**Not solved by the protocol:** No mechanism for partial distrust, per-event scoring, or anomaly detection within a single publisher's output. A user must either trust or distrust a pubkey entirely. No protocol-level dispute or counter-assertion mechanism allows other trusted parties to flag specific events as contested.

**Residual risk:** Medium. The protocol's binary trust model (trusted vs. untrusted per pubkey) offers no defense against an adversary willing to play a long game. Detection requires ecosystem-level tooling (cross-referencing with authoritative sources) that the protocol does not specify.

---

#### T31 — Deleted raw metadata (external artifact unavailability)

**Problem:** A MetadataEvent references an external artifact (e.g., a PDF test report, a power-trace dataset) via an `imeta` URL. If the artifact host deletes the file, lets the domain expire, or blocks access, the MetadataEvent becomes an empty shell — the `content` summary and the SHA-256 hash remain in the Nostr event, but the actual evidence is irrecoverable. This degrades **Integrity** (claims become unverifiable), **Auditability** (the evidential basis for a finding is lost), and **Portability** (the event cannot be fully replicated to a new context).

**Mitigation in the design:** The SHA-256 hash in the `imeta` tag ensures that if the artifact can be sourced from any location (mirrors, Blossom relays, IPFS, personal archives), its integrity is verifiable. The protocol's design of separating the event from the artifact implicitly supports multi-source retrieval.

**Not solved by the protocol:** No requirement for artifact mirroring, pinning, or content-addressed storage. No guidance on how clients should handle a MetadataEvent whose artifact is unreachable (display a warning? hide the event? show only the summary?). No expiry or liveness-check mechanism for artifact URLs.

**Residual risk:** Medium. This is a structural weakness of any system that references external mutable hosting. The risk increases over time as URLs rot. Mitigation is entirely ecosystem-dependent (Blossom relays, archive services, community mirroring practices).

---

### 6.2 Identity and Impersonation Threats

#### T6 — Key compromise

**Problem:** A Compromised Publisher (attacker archetype) who obtains a private key inherits full, irrevocable authority over that identity: they can publish UpdateEvents that rewrite any ProductEvent or MetadataEvent authored by that key, retract any event, and publish new events that carry the key's accumulated trust and endorsement weight. Since trust in SCRUTINY is anchored to public keys, a compromised key for a high-authority entity (e.g., a major security laboratory, a certification body, or a prolific NVD importer bot) allows the attacker to corrupt the graph view for every user who trusts that key. This is a simultaneous, catastrophic break of **Integrity**, **Authenticity**, and **Trust Separation**.

**Mitigation in the design:** The protocol spec notes this as an open question. Events remain cryptographically valid (the signature is correct), so the compromise is undetectable at the protocol layer. At the ecosystem layer, threshold cryptography demonstrates a theoretical path to reducing single-device key compromise risk by splitting signing authority across multiple devices (e.g., FROST-style threshold Schnorr signing and the MeeSign demonstrator from CRoCS) ([RFC 9591](https://www.rfc-editor.org/rfc/rfc9591), [meesign-server](https://github.com/crocs-muni/meesign-server), [meesign-client](https://github.com/crocs-muni/meesign-client)).

**Not solved by the protocol:** Nostr has no native key revocation mechanism (NIP-41 is proposed but not adopted). SCRUTINY defines no key rotation, revocation, or emergency broadcast mechanism. Recovery requires out-of-band communication to every trusting party, with no guarantee of reaching them all. Threshold signing is not natively supported by standard Nostr clients today, so it cannot currently be relied upon as a protocol-level mitigation.

**Residual risk:** Critical. A compromised high-authority key has no protocol-level recovery path. This is the single most severe threat in the model and is inherited directly from Nostr's key architecture.

---

#### T7 — Sybil attacks on endorsement aggregation

**Problem:** The protocol specifies aggregating identical bindings from multiple trusted authors into an endorsement score. A Compromised Publisher creates many keypairs, gets them minimally trusted (e.g., by following patterns that place them within one or two hops of legitimate trust lists), and publishes identical bindings from each key. The aggregated endorsement count inflates, making a false or low-quality binding appear widely corroborated. This undermines **Trust Separation** — the user believes the endorsement reflects independent assessment from multiple sources, when it is a single actor.

**Mitigation in the design:** Trust-based filtering limits which keys contribute to aggregation. Only keys within the user's trust graph are counted.

**Not solved by the protocol:** No Sybil resistance beyond the trust model. No weighting by trust depth (a key at hop 2 counts the same as a directly trusted key). No diminishing-returns scoring, no cap on endorsement count per trust distance, and no detection of coordinated key creation patterns.

**Residual risk:** Medium. Effectiveness depends entirely on the rigor of individual user trust lists and whether client scoring implementations apply WoT weighting.

---

#### T8 — Canonical ID squatting

**Problem:** The `i` tag (canonical identifiers: CPE, PURL, CVE, CWE) is self-asserted with no validation against authoritative registries. A Compromised Publisher can publish a ProductEvent claiming a well-known CPE (e.g., `cpe:2.3:o:microsoft:windows_10`), or a MetadataEvent referencing a real CVE identifier with fabricated content. Because `i` tags are used for cross-protocol discovery (clients query by canonical ID to find related SCRUTINY events), the squatter's events will appear alongside or instead of legitimate ones. This degrades **Discoverability** and **Integrity**.

**Mitigation in the design:** Trust-based filtering. Multiple competing events for the same canonical ID are allowed and expected. Users choose which to consume based on author trust.

**Not solved by the protocol:** No cross-reference against authoritative registries (NVD, OSV, NIST CPE dictionary). No conflict detection or resolution when multiple authors claim the same canonical ID.

**Residual risk:** Medium. Effective only if clients surface author identity alongside canonical IDs and users actively verify provenance.

---

#### T9 — Fake identities

**Problem:** Anyone can generate a Nostr keypair and claim to represent a vendor, laboratory, certification body, or researcher. There is no in-protocol identity attestation mechanism. A Compromised Publisher can create a key with a display name mimicking a real entity (e.g., "BSI Certification Authority" or "Google Project Zero") and publish authoritative-sounding events. This undermines **Authenticity** — events are attributable to a public key, but not to a verified real-world identity.

**Mitigation in the design:** Identity validity is not assumed. Trust derives from user-curated key lists and reputation within the Web of Trust, not from key creation or self-asserted display names.

**Not solved by the protocol:** No in-protocol identity attestation mechanism (e.g., Keybase-style cross-platform proofs, domain-linked keys, or organization-attested key registries). New users without established trust lists are vulnerable.

**Residual risk:** Low–Medium. Low for users with curated trust lists and established WoT connections. Higher for new users relying on default lists or discovering keys through unverified channels.

---

#### T32 — Product impostor / hijacker

**Problem:** A Product Impostor creates a ProductEvent claiming a product that belongs to another vendor (e.g., publishing a ProductEvent for "Infineon SLE78" with a valid CPE and plausible labels, signed by the attacker's key). If the attacker publishes first or backdates the event (T1), they gain first-mover visibility. They can then author UpdateEvents that modify the product's metadata (e.g., injecting false version numbers, altering certification claims), or publish BindingEvents linking the product to fabricated metadata. Because ProductEvents are not permissioned — any key can publish one — the attacker's version competes with the legitimate vendor's version. This breaks **Authenticity** (the product identity is not bound to the actual vendor) and **Integrity** (users may consume attacker-controlled product definitions).

**Mitigation in the design:** Multiple ProductEvents for the same product are expected. Trust-based filtering means users only see products from authors they trust. Canonical ID tags (`i`) allow clustering of competing claims.

**Not solved by the protocol:** No mechanism to verify that a ProductEvent author is the actual vendor or an authorized representative. No priority or ranking advantage for the real vendor's key. During bootstrap, before the vendor's key is widely trusted, the impostor may have equal or greater visibility.

**Residual risk:** Medium. The attack is viable but bounded by trust filtering at maturity. High risk during bootstrap or for products whose vendors have not published SCRUTINY events.

---

#### T33 — scrutiny.cloud impostor (infrastructure impersonation)

**Problem:** A scrutiny.cloud Impostor creates a web service, relay, or client application that mimics official SCRUTINY infrastructure (e.g., `scrutiny-fabric.io`, `scrutiny.network`) and distributes default trust lists, recommended relay lists, or pre-built client software that have been tampered with. Users who discover SCRUTINY through the impostor's channels receive a compromised bootstrap: attacker-controlled keys in their trust list, attacker-operated relays as defaults, or client software with backdoors. This is a compound attack that undermines **Trust Separation** (the trust model is seeded by the attacker), **Censorship Resistance** (attacker relays can censor arbitrarily), and **Authenticity** (users cannot distinguish the impostor from the real project).

**Mitigation in the design:** The protocol is decentralized and does not depend on any single domain or service. Events are cryptographically signed and verifiable regardless of where they are obtained.

**Not solved by the protocol:** No official, protocol-level registry of project infrastructure, canonical domain names, or signing keys for distribution artifacts. The trust bootstrap problem (T15) makes this attack especially effective: new users have no basis for distinguishing legitimate from impostor infrastructure. No code-signing or reproducible-build requirements for client software are specified.

**Residual risk:** Medium. The decentralized design limits damage if detected, but detection itself is not aided by the protocol. Risk is highest during early adoption when brand recognition and community verification are weakest.

---

#### T34 — Defaming consumer (fabricated negative findings)

**Problem:** A Defaming Consumer publishes MetadataEvents containing fabricated negative findings about a product — fake vulnerability reports, doctored test results, forged screenshots of security failures — and creates BindingEvents linking them to the target product. If the attacker has built any trust (or their events reach users with permissive trust settings), the fabricated findings damage the product's perceived security posture. The attacker may also attach fabricated `imeta` artifacts (e.g., a PDF report with a plausible-looking vulnerability analysis) to lend credibility. This undermines **Integrity** (false data enters the graph) and creates an asymmetric burden: the vendor must invest significant effort to identify, contest, and seek retraction of each false claim, while the attacker can generate them cheaply.

**Mitigation in the design:** Events are signed and attributable — the defaming consumer's pubkey is permanently associated with the false claims. Trust filtering limits visibility to users who trust the attacker's key. Other trusted parties can publish competing BindingEvents or MetadataEvents that contradict the false claims.

**Not solved by the protocol:** No in-protocol dispute, counter-assertion, or flagging mechanism that allows a vendor to formally contest a specific MetadataEvent. NIP-56 reports exist but are advisory and client-interpreted. There is no way to cryptographically prove a negative (i.e., that a vulnerability does not exist), so the burden of proof is structurally asymmetric. Fabricated screenshots or artifacts cannot be disproven at the protocol layer.

**Residual risk:** Medium. The trust model bounds propagation, but the attack exploits the permissionless nature of the protocol. Vendors with strong trust presence can effectively drown out false claims; smaller vendors may not have this luxury.

---

### 6.3 Availability and Denial-of-Service Threats

#### T10 — Spam and graph pollution

**Problem:** A DoS attacker floods the network with syntactically valid SCRUTINY events — fake ProductEvents, meaningless MetadataEvents, nonsensical BindingEvents — all carrying correct `scrutiny_fabric` tags and valid signatures. The goal is to bury legitimate findings in noise, increase relay storage and client processing costs, and poison search results for canonical identifiers. This degrades **Discoverability** (legitimate events are drowned) and imposes asymmetric costs on the ecosystem.

**Mitigation in the design:** Trust-based filtering, SCRUTINY-specific tags for relay-side filtering, optional Proof-of-Work (NIP-13) to raise the cost of event creation.

**Not solved by the protocol:** Trust filtering is circular with the WoT bootstrap problem (T15) — spam filtering requires a functioning trust model, which requires an established ecosystem. SCRUTINY-specific tags are trivially replicated by attackers. PoW raises cost symmetrically for legitimate publishers and spammers. No concrete rate-limiting, progressive-trust, or reputation-based throttling mechanism is specified.

**Residual risk:** Medium. No concrete anti-spam mechanism beyond trust filtering, which is bootstrapped-dependent.

---

#### T11 — Graph traversal amplification

**Problem:** A DoS attacker constructs deep binding chains (A binds to B binds to C ... hundreds deep) or extreme fan-out (thousands of BindingEvents anchored to a single ProductEvent). When a client attempts to traverse the product's graph, it exhausts memory, CPU, or network bandwidth fetching and processing the amplified graph. This is a targeted denial-of-service against client resources, degrading **Discoverability** for the targeted product.

**Mitigation in the design:** None specified in the protocol.

**Not solved by the protocol:** No maximum traversal depth, no fan-out limit, no pagination requirement, and no mandatory timeout or resource budget for graph traversal. Clients that implement depth limits do so as local policy without protocol guidance.

**Residual risk:** High. Naive client implementations are directly vulnerable. The protocol provides no defensive guidance.

---

#### T12 — Replay and re-broadcast

**Problem:** Valid signed events can be re-broadcast to any relay indefinitely. A Malicious Relay Operator or Network-Level Attacker can replay retracted bindings to relays that are missing the retraction (amplifying T3), or flood relays with old events to consume storage and confuse clients that do not deduplicate properly.

**Mitigation in the design:** Events are idempotent — the same event ID always maps to the same content. Relays can deduplicate on event ID.

**Not solved by the protocol:** Relay-side deduplication is not required by the Nostr protocol. The interaction between replayed events and retraction propagation is unaddressed.

**Residual risk:** Medium. Low for storage (deduplication is standard practice). Medium for state consistency when combined with retraction suppression (T3).

---

#### T13 — Event size and relay limits

**Problem:** SCRUTINY events with many labels, canonical IDs, and `imeta` attachments may exceed practical relay size limits. Nostr does not define a universal maximum event size, and relays set their own limits.

**Mitigation in the design:** None specified.

**Not solved by the protocol:** No maximum event size recommendation for SCRUTINY events. No guidance on how to split large events across multiple linked events.

**Residual risk:** Low. Operational concern, not a direct security-goal violation.

---

#### T35 — Event and artifact flooding (targeted DoS)

**Problem:** A DoS attacker targets a specific product or metadata chain with a high volume of events: thousands of BindingEvents referencing a single ProductEvent, or massive `imeta` artifacts that consume relay storage quotas. Unlike general spam (T10), this is targeted: the goal is to make a specific product's SCRUTINY graph unusable — either by exhausting relay resources so the relay drops the product's events, or by making the client-side graph traversal intolerably slow. Additionally, the attacker can repeatedly upload large files to artifact hosts referenced by `imeta` tags, consuming hosting quotas and potentially triggering takedowns that also affect legitimate artifacts on the same host. This degrades **Discoverability** and **Censorship Resistance** for the targeted product.

**Mitigation in the design:** Trust filtering limits which events a client processes. SCRUTINY-specific tags allow relays to set per-type quotas.

**Not solved by the protocol:** No per-product event count limits, no relay-side rate limiting per pubkey, no artifact hosting durability requirements. The protocol cannot prevent an attacker from overwhelming shared infrastructure.

**Residual risk:** Medium. Trust filtering provides client-side defense, but relay-side resource exhaustion is an ecosystem problem the protocol cannot solve.

---

### 6.4 Discovery and Indexing Threats

#### T14 — Relay indexing heterogeneity

**Problem:** Different relays may accept SCRUTINY events but not index all the tags relevant to discovery — for example, a relay might index `#t` tags but not `#q` tags, or not index custom markers like `e_rev`. Clients relying on tag-based subscription filters (`#e`, `#q`, `#t`) get inconsistent results depending on which relay they query. This directly degrades **Discoverability**: a binding exists in the network but is unfindable via the expected query path.

**Mitigation in the design:** SCRUTINY uses standard Nostr tagging primitives (`e`, `q`, `t`, `i` tags) to maximize compatibility with existing relay implementations.

**Not solved by the protocol:** The protocol cannot mandate relay indexing behavior. Relays are sovereign and may choose which tags to index based on performance, storage, or policy considerations.

**Residual risk:** Medium. Discovery reliability depends on relay implementation quality. Dedicated SCRUTINY-aware relays are the practical ecosystem-level mitigation.

---

#### T15 — WoT bootstrap trap

**Problem:** The trust model requires curated pubkey trust lists to function — every filtering, endorsement, and admission decision depends on the user having a populated trust list. But those lists have value only once the ecosystem is populated with trusted publishers. New users face a chicken-and-egg problem: they have no basis for trust decisions, and the protocol provides no guidance on how to bootstrap. A single-source default trust list reintroduces centralization at the trust layer, undermining **Trust Separation**. A poorly curated or compromised default list (T23) undermines every security goal simultaneously.

**Mitigation in the design:** Default trust lists are mentioned as a bootstrap mechanism.

**Not solved by the protocol:** The spec does not define who creates, signs, distributes, or updates default trust lists. No multi-party attestation, no versioning, no revocation mechanism for default lists. No progressive-trust or graduated-admission mechanism for new users.

**Residual risk:** High. This is a foundational design gap. The security of every new user's experience depends on an unspecified, extra-protocol process.

---

#### T16 — Metadata squatting (first-publisher advantage)

**Problem:** A Compromised Publisher publishes the first event about a newly disclosed vulnerability or a new product, claiming the canonical identifier before the authoritative source (e.g., the NVD or the vendor) enters the SCRUTINY ecosystem. Combined with timestamp backdating (T1), the squatter gains first-mover visibility. Client implementations that rank by publication order or trust-agnostic sorting may surface the squatter's event prominently. This degrades **Discoverability** (users find the squatter's version first) and **Integrity** (the squatter's content may be inaccurate or malicious).

**Mitigation in the design:** Multiple competing events for the same canonical ID are allowed. Canonical identifiers cluster related claims for comparison.

**Not solved by the protocol:** No ranking preference for higher-trust sources. No timestamp verification to prevent backdating. No mechanism to transfer canonical ID ownership.

**Residual risk:** Medium. Depends heavily on client ranking logic and whether the authoritative source eventually publishes a competing event that gains trust.

---

### 6.5 Censorship Threats

#### T17 — Relay censorship

**Problem:** A Malicious Relay Operator refuses to store or serve specific events — particularly negative findings about influential vendors or politically sensitive security metadata. Because relays are sovereign and unaccountable, this censorship is undetectable by clients that only query the censoring relay. This directly undermines **Censorship Resistance**.

**Mitigation in the design:** Multi-relay model. Events can be published to many relays simultaneously. External archives (git repositories, Blossom relays, flat storage) provide additional durability.

**Not solved by the protocol:** If the practical relay set is small (especially during bootstrap), coordinated censorship across a handful of relays is feasible. No relay transparency or audit mechanism (e.g., "prove you are serving all events matching filter X") exists.

**Residual risk:** Low–Medium. Low at scale with diverse relay sets. Medium during early adoption or in jurisdictions with limited relay infrastructure.

---

#### T18 — Eclipse attack on relay set

**Problem:** A Network-Level Attacker (or a Malicious Relay Operator who controls multiple relays) isolates a client to a set of attacker-controlled relays. The client receives a fabricated view of the SCRUTINY graph: missing events, injected events (though these cannot be forged — only legitimate events can be selectively included or excluded), and a curated selection that presents a false security posture. This breaks **Discoverability** (the client sees an incomplete, attacker-curated graph) and degrades **Censorship Resistance**.

**Mitigation in the design:** Relay diversity is encouraged. Events are cryptographically signed, so integrity holds even under eclipse — the attacker can omit but not forge events.

**Not solved by the protocol:** No mechanism for a client to detect that its view is incomplete. No cross-relay consistency check. No minimum relay diversity requirement.

**Residual risk:** Low–High. Low under normal conditions with a diverse relay set. High against a targeted attacker with network-level access (e.g., corporate network, state-level adversary controlling regional infrastructure).

---

#### T36 — Censoring vendor (economic and legal relay coercion)

**Problem:** A Censoring Vendor — typically a large commercial entity whose product has unfavorable security findings published in the SCRUTINY graph — exerts economic or legal pressure on relay operators to remove or refuse to serve specific events. The pressure may take the form of cease-and-desist letters, DMCA notices targeting MetadataEvents or their artifact hosts, contractual leverage over hosting providers, or direct payments to relay operators. Unlike generic relay censorship (T17), this is targeted and motivated: the vendor has a specific, identifiable set of events they want suppressed, and may have the resources to pressure multiple relays simultaneously. This is a direct attack on **Censorship Resistance** and has a chilling effect on **Integrity** (publishers may self-censor to avoid legal exposure).

**Mitigation in the design:** Multi-relay replication. Nostr events are portable and can be re-broadcast from any archive. The decentralized architecture means no single takedown request can eliminate an event from the network.

**Not solved by the protocol:** The protocol cannot prevent legal coercion against relay operators, artifact hosts, or publishers. If the effective relay set is small or concentrated in a single legal jurisdiction, a well-resourced vendor can achieve practical suppression. No protocol-level mechanism detects coordinated censorship or alerts the publishing community.

**Residual risk:** Medium. The decentralized design is the primary defense, but its effectiveness depends on relay diversity and jurisdictional distribution — both of which are ecosystem-level properties the protocol cannot guarantee.

---

#### T37 — Suing vendor (legal intimidation of publishers)

**Problem:** A Suing Vendor initiates or threatens litigation against the author of unfavorable security findings — invoking trade secret claims, computer fraud statutes, or defamation law — to force retraction or deter future publication. The attack targets the publisher, not the relay: even if the events remain on the network, the publisher may be compelled to issue a RetractionEvent under legal duress, or may simply stop publishing. Other researchers, observing the litigation, self-censor. This is distinct from T36 (Censoring Vendor) which targets relay operators, and distinct from T27 (Legal pressure) which is the general case: the Suing Vendor specifically uses the legal system as a weapon against individual publishers. This undermines **Censorship Resistance** (suppression via legal threat) and **Integrity** (retractions issued under duress are indistinguishable from voluntary retractions).

**Mitigation in the design:** Events, once published and replicated across multiple relays and archives, are difficult to completely suppress even if the original author retracts. The append-only retraction model means the original event remains accessible for audit even after retraction.

**Not solved by the protocol:** No protocol-level distinction between a voluntary retraction and a coerced retraction. No mechanism for a publisher to signal "this retraction was issued under duress" without further legal exposure. No collective defense or whistleblower protection mechanism. The protocol cannot grant legal immunity.

**Residual risk:** Medium. The chilling effect is real and well-documented in security research. The protocol's auditability (retracted events remain visible) provides partial resilience, but the primary defense is jurisdictional and community-level, not protocol-level.

---

### 6.6 Surveillance Threats

#### T19 — Relay-level metadata leakage

**Problem:** Relay operators can observe all subscription filters (`REQ` messages) from connected clients, revealing which pubkeys are querying which products, vulnerabilities, and canonical identifiers. A Malicious Relay Operator can build detailed profiles of organizational security interests, investigation priorities, and technology stacks. This is a passive, undetectable attack on **Auditability** (surveillance without accountability) and creates risks outside the protocol's scope (operational security, competitive intelligence).

**Mitigation in the design:** None specified.

**Not solved by the protocol:** Nostr subscription filters disclose exact query parameters in plaintext. No private information retrieval, encrypted queries, or relay-oblivious query mechanism exists in the protocol or in Nostr.

**Residual risk:** High. Mitigation requires external measures (Tor, VPN, broad filters with local post-filtering) that the protocol does not specify or require.

---

#### T20 — Product interest graph exposure

**Problem:** The SCRUTINY graph itself — the pattern of queries, trust list composition, and binding traversal paths — reveals which products and vulnerabilities an organization is interested in. If a security team's relay connections and query patterns are observable (by the relay operator or a Network-Level Attacker), adversaries can map the organization's technology stack, identify unpatched vulnerabilities they are investigating, and infer incident response timelines. This is a higher-level surveillance threat than T19: even if individual queries are anonymized, the aggregate pattern is informative.

**Mitigation in the design:** None specified.

**Not solved by the protocol:** Read-only participation still leaks query metadata to relays. Trust list composition, if observable, reveals the user's security community. No protocol-level mechanism for anonymous or pseudonymous consumption of the graph.

**Residual risk:** Medium–High. Organizational users face a structural trade-off between protocol participation and operational security. The risk is highest for users whose query patterns directly map to their vulnerability exposure.

---

#### T41 — Artifact host surveillance & tracking

**Problem:** Fetching external `imeta` artifacts directly from third-party hosts reveals the requesting client's network and application metadata to that host (IP address, request timing, user agent / client fingerprint traits, referrer-like context, and repeated access patterns). A malicious or data-hungry artifact host can embed unique tracking identifiers (including pixel-like beacons and per-user URLs) to correlate who is investigating which vulnerability or product and when. This creates a surveillance side-channel outside relay traffic and degrades operational privacy for researchers, vendors, and incident responders ([NIP-92 `imeta`](https://github.com/nostr-protocol/nips/blob/master/92.md), [web beacon background](https://en.wikipedia.org/wiki/Web_beacon), [PETS 2018 email-tracking analysis](https://petsymposium.org/2018/files/papers/issue1/paper42-2018-1-source.pdf)).

**Mitigation in the design:** Integrity hashing (`x` tag) detects content tampering but does not hide who fetched content. Clients can partially mitigate through network isolation and retrieval hygiene (e.g., proxying, Tor/VPN egress separation, relay-side mirrors, delayed/batched fetching, and disabling automatic remote content loads where practical).

**Not solved by the protocol:** SCRUTINY defines integrity checks for artifacts but no anonymity-preserving artifact retrieval layer, no mandatory proxy model, and no anti-tracking normalization requirements. Surveillance risk persists even when integrity checks are perfect.

**Residual risk:** High. Integrity and privacy are decoupled for external artifact retrieval; users can verify what they downloaded while still exposing that they downloaded it.

---

### 6.7 Ecosystem and Operational Threats

#### T21 — Bot centralization during seeding

**Problem:** The early SCRUTINY ecosystem depends on bots importing data from NVD, OSV, sec-certs, and other databases. These seed bots become the most prolific publishers and, by path dependency, accumulate outsized trust weight in the WoT. If a seed bot's key is compromised (T6), or if the bot's data pipeline is poisoned, the impact is amplified by the bot's central position. This is a structural threat to **Trust Separation**: the system, designed to avoid single sources of authority, develops one through operational necessity.

**Mitigation in the design:** Users can migrate to richer, more diversified trust sets over time as the ecosystem matures.

**Not solved by the protocol:** No mechanism to prevent, detect, or limit concentration of trust in a small number of keys. No protocol-level diversity requirement. Seed publishers often retain outsized influence long after the bootstrap phase.

**Residual risk:** Medium. Operational, not cryptographic. The risk is time-bounded but may persist if users do not actively diversify their trust lists.

---

#### T22 — Client/indexer re-centralization

**Problem:** Efficient graph traversal, trust filtering, endorsement aggregation, and ranking are computationally expensive. This incentivizes centralized indexers that pre-compute these views and serve them via APIs. A dominant indexer becomes a single point of failure (availability), a single point of control (censorship via selective indexing), and a single point of surveillance (query metadata). This structurally undermines **Censorship Resistance**, **Trust Separation**, and **Discoverability**.

**Mitigation in the design:** The data model is open and portable. Events are self-contained and can be independently verified.

**Not solved by the protocol:** No standard query API for indexer interchangeability. No mechanism to verify that an indexer is serving a complete, unfiltered view. Economic pressure toward centralization is structural and not addressable at the protocol layer.

**Residual risk:** Medium. A well-known, well-documented risk in decentralized systems. The protocol's portability provides a theoretical escape hatch, but practical switching costs may be high.

---

#### T23 — Supply chain attack on default trust lists

**Problem:** Default trust lists distributed with client software are a high-value supply-chain target. A Compromised Developer (or an attacker who compromises the distribution channel) can inject attacker-controlled keys into the default trust list, granting those keys immediate trust in every new installation. This is equivalent to compromising every new user's trust model in a single action. It undermines **Trust Separation** (the user's trust is not self-curated) and enables every other identity and integrity threat in this model.

**Mitigation in the design:** None specified.

**Not solved by the protocol:** No signing, versioning, multi-party attestation, or reproducible-build requirement for trust list distribution. No mechanism for users to verify the provenance of their default trust list.

**Residual risk:** High. Compromise of the trust list distribution channel is a single point of failure for the security of all new users.

---

#### T24 — Client-side content injection (XSS)

**Problem:** `content` fields in SCRUTINY events are free text. If rendered in a web context without sanitization, they enable cross-site scripting (XSS), phishing via injected links, and markdown injection. An attacker who gets any event into the user's visible graph (even a low-trust event in a permissive view) can exploit client-side rendering vulnerabilities. This threatens the confidentiality and integrity of the client application, which is outside the protocol's scope but directly impacts the user.

**Mitigation in the design:** None specified. This is explicitly a client implementation concern.

**Not solved by the protocol:** No content sanitization requirements in the spec. No restricted character set or markup language is mandated for `content` fields.

**Residual risk:** Medium. Standard web security concern. Entirely dependent on client implementation quality.

---

#### T25 — `kind: 1` friction and Nostr evolution risk

**Problem:** SCRUTINY uses `kind: 1` (text notes) for all event types, chosen for maximum compatibility with existing relays and clients. However, general-purpose relays may deprioritize, rate-limit, or apply spam filtering to `kind: 1` events that SCRUTINY depends on. Nostr protocol changes — NIP deprecations, changes to `kind: 1` semantics, new relay behavior requirements — may break SCRUTINY without any SCRUTINY-specific change. This is a structural dependency risk threatening **Portability** and **Discoverability**.

**Mitigation in the design:** `kind: 1` was chosen for bootstrap compatibility. Version tagging (`scrutiny_v040`) enables clients to negotiate protocol versions. SCRUTINY-specific `t` tags allow relay-side filtering.

**Not solved by the protocol:** No migration path to a dedicated kind number. No compatibility matrix against relay implementations. No mechanism to detect when a relay's `kind: 1` handling becomes incompatible with SCRUTINY's requirements.

**Residual risk:** Medium. External dependency on a rapidly evolving protocol ecosystem. The risk is structural and long-term.

---

#### T26 — Stale data and version drift

**Problem:** Security metadata has a shelf life. A vulnerability patched in a later product version, a certification that has expired, or a test result superseded by new methodology — all remain bound to the product indefinitely in the append-only model. Users who encounter stale bindings without context may make incorrect security decisions: false positives (treating a patched vulnerability as active) or false negatives (trusting an expired certification). This degrades **Integrity** (the graph presents an outdated picture) and **Discoverability** (stale data buries current findings).

**Mitigation in the design:** ProductEvent labels support version information. BindingEvent `e_rev`/`q_rev` snapshot tags allow clients to detect staleness relative to the current Effective View.

**Not solved by the protocol:** No validity period, no automatic expiry, no version-scoped binding semantics. No mechanism to distinguish "this binding is stale because the product was updated" from "this binding is still active for all product versions." Staleness detection depends entirely on clients implementing snapshot comparison logic.

**Residual risk:** Medium. Stale false positives erode user trust in the system. Stale false negatives provide dangerous false assurance. Both are structural consequences of the append-only, no-expiry design.

---

#### T27 — Legal pressure on publishers and relays

**Problem:** Publishing negative security findings about commercial products may trigger legal threats: DMCA takedown notices, trade secret claims, computer fraud statute invocations (e.g., CFAA in the US), or defamation suits. Relay operators may preemptively censor to avoid liability. Publishers may self-censor to avoid personal legal risk. This is the general case of legal-system attacks; T36 and T37 are targeted variants by specific vendor archetypes. The threat directly undermines **Censorship Resistance**.

**Mitigation in the design:** Multi-relay, multi-archive replication. The decentralized architecture makes complete suppression difficult.

**Not solved by the protocol:** Operational and jurisdictional. The protocol cannot prevent legal coercion, cannot grant safe harbor, and cannot compel relay operators to resist takedown requests.

**Residual risk:** Medium. A well-documented chilling effect on legitimate security research. The protocol's replication model provides resilience, not immunity.

---

#### T38 — Compromised developer (client/bot supply chain attack)

**Problem:** A Compromised Developer with commit access to a SCRUTINY client application, bot, or library introduces a backdoor or subtle bug. The attack surface includes: (a) a client that silently drops or deprioritizes events from certain pubkeys (soft censorship), (b) a client that phones home with query metadata (surveillance), (c) a bot that subtly alters imported data (integrity corruption at the seeding layer), (d) a client that weakens signature verification or trust filtering (enabling other attacks in this model), or (e) a build system compromise that injects malicious code into distributed binaries without modifying the source repository. Because clients are trusted to correctly implement the Effective View algorithm, trust filtering, and signature validation (Section 3 assumptions), a compromised client breaks every security assumption simultaneously.

**Mitigation in the design:** The protocol is specified as an open standard. Multiple independent client implementations are possible and expected. The data model is portable, so a compromised client does not corrupt the underlying events.

**Not solved by the protocol:** No client certification, reproducible-build requirement, or conformance testing suite. No mechanism for users to verify that their client correctly implements the protocol. The spec explicitly lists correct client implementation as an assumption (Section 3), not a guarantee.

**Residual risk:** High. A compromised dominant client is a single point of failure. The protocol's openness mitigates the theoretical risk (anyone can build an alternative), but practical switching costs and user inertia limit this defense.

---

#### T39 — Dispute troll (abuse of feedback mechanisms)

**Problem:** A Dispute Troll systematically abuses Nostr's reporting mechanism (NIP-56, `kind: 1984`) and reactions (NIP-25) to flag legitimate, high-quality MetadataEvents as spam, abuse, or inaccurate. If clients or relays downrank or hide events based on report count without weighting by reporter trust, the troll can suppress legitimate findings. The troll may also publish competing MetadataEvents with contradictory claims (e.g., "this vulnerability does not exist") and aggressively zap/react to boost their version's visibility. This degrades **Integrity** (legitimate findings are suppressed) and **Discoverability** (the signal-to-noise ratio decreases).

**Mitigation in the design:** NIP-56 reports and NIP-25 reactions are advisory. Trust-based filtering applies to reports and reactions just as it does to bindings. Zaps are permissionless and provide economic signal but not authority.

**Not solved by the protocol:** No requirement for clients to weight reports by reporter trust. No rate limiting on reports per pubkey per target. No formal dispute resolution mechanism. The protocol does not define how clients should aggregate conflicting signals (positive endorsements vs. negative reports) for the same event.

**Residual risk:** Medium. The attack is bounded by trust filtering but exploits the lack of formal dispute resolution. Clients that naively count reports without trust weighting are directly vulnerable.

---

#### T40 — Misbehaving malicious LLM (AI-generated false metadata)

**Problem:** A Misbehaving Malicious LLM is deployed as an automated metadata generation pipeline — either by an attacker using an LLM to mass-produce plausible but false security findings, or by a legitimate operator whose LLM is misconfigured, poisoned, or hallucinating. The LLM generates MetadataEvents with coherent, technically detailed `content` fields, appropriate labels, valid canonical identifiers, and even plausible `imeta` artifacts (AI-generated PDF reports, fabricated test data). Because the output is syntactically indistinguishable from human-authored expert analysis, trust filtering alone cannot detect the attack — the LLM's publishing key may have legitimate trust if it belongs to an organization that deployed the LLM as a productivity tool. This is a scalability multiplier for T30 (Occasionally Lying Publisher): the LLM can produce false metadata at volume without the attacker needing domain expertise. This undermines **Integrity** (false data at scale) and **Authenticity** (the attributed author may not have reviewed the LLM's output).

**Mitigation in the design:** Events are attributable to a pubkey. Trust filtering limits propagation to users who trust the publishing key. The endorsement model rewards independent corroboration, and LLM-generated findings that lack corroboration from other trusted sources will have low endorsement counts.

**Not solved by the protocol:** No mechanism to distinguish human-authored from AI-generated events. No requirement for publishers to disclose AI involvement. No protocol-level verification of claims against external sources. The trust model assumes human curation of the trust list, but not human authorship of events. At scale, the sheer volume of plausible LLM output may overwhelm community capacity for review.

**Residual risk:** Medium–High. The barrier to generating plausible false metadata has dropped dramatically. The protocol's defenses (trust filtering, endorsement aggregation) are designed for human-scale threats and may not scale to AI-driven volume. This is an emerging threat that the current design does not specifically address.

---

### 6.8 Nostr Protocol Collision Threats

#### T28 — NIP-09 deletion vs. SCRUTINY retraction collision

**Problem:** Nostr defines a native deletion mechanism (NIP-09, `kind: 5`) that is semantically distinct from SCRUTINY's application-layer `RetractionEvent` (`scrutiny_retract`). If a publisher issues a NIP-09 deletion targeting a SCRUTINY event instead of publishing a RetractionEvent, a state machine conflict arises: (1) A relay that honors NIP-09 may physically delete the target event, destroying it rather than marking it retracted — violating SCRUTINY's **Auditability** goal (historical state should remain recoverable). (2) A SCRUTINY-aware client that only watches for `RetractionEvent` will not recognize the NIP-09 deletion, leaving the event visible in its Effective View even though the relay has dropped it. (3) A client that honors both NIP-09 and RetractionEvent must reconcile two deletion semantics with different authority rules. This collision creates ambiguous event states that undermine **Integrity** and **Auditability**.

**Mitigation in the design:** None. The protocol spec does not reference NIP-09 or define how clients should handle native Nostr deletions of SCRUTINY events.

**Not solved by the protocol:** No canonical rule for whether NIP-09 deletions should be treated as equivalent to, inferior to, or ignored relative to `RetractionEvent`. No guidance for relay operators on whether to honor NIP-09 for SCRUTINY-tagged events. No recommendation for publishers on which mechanism to use.

**Residual risk:** Medium. Likely to surface in practice as users interact with SCRUTINY events through generic Nostr clients. Creates silent inconsistency between relay state and client state.

---

#### T29 — Cryptographic agility risk

**Problem:** Nostr hardcodes Schnorr signatures over `secp256k1` for event authentication and `SHA-256` for event ID computation (NIP-01). SCRUTINY inherits this dependency without abstraction. Quantum-capable adversaries (or major cryptanalytic breaks) would directly pressure these primitives: (a) historical and live event signatures could become forgeable, (b) event IDs and reference integrity (`e`/`q` graph pointers) would be undermined, and (c) there is no defined Post-Quantum Cryptography (PQC) migration path in Nostr today. In practice, SCRUTINY is tied to `secp256k1` unless the base protocol evolves through a breaking transition (effectively a hard fork or equivalent incompatible migration) ([NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), [NIST PQC migration guidance](https://csrc.nist.gov/projects/post-quantum-cryptography)). This is a long-horizon, systemic threat to **Integrity** and **Authenticity**.

**Mitigation in the design:** None. SCRUTINY does not define a cryptographic agility layer, nor does Nostr.

**Not solved by the protocol:** Algorithm migration would require a new Nostr event format, new kind numbers, or a parallel signing scheme — all breaking changes to both Nostr and SCRUTINY. No PQC transition plan exists at either layer.

**Residual risk:** Low (near-term) / High (long-term). No known practical attacks on secp256k1 or SHA-256 exist today. The risk is relevant if the protocol is intended to persist across decades.

---

## 7. Residual Risks and Trade-offs

### Inherently unsolved by the protocol

The following limitations are structural consequences of SCRUTINY's design decisions and its inheritance of Nostr's architecture. They cannot be eliminated at the protocol layer and must be addressed by the surrounding ecosystem (client implementations, operational practices, community governance).

**Key revocation.** No protocol-level recovery from key compromise. This is the single most critical architectural gap, inherited from Nostr. A compromised key retains full authority indefinitely — there is no mechanism to invalidate it, delegate authority to a successor key, or broadcast a revocation notice that all clients will honor. NIP-41 (key rotation) is proposed in Nostr but not adopted.

**Timestamp trustworthiness.** `created_at` is self-reported and directly consumed by the Effective View algorithm. All ordering-dependent logic — update chain construction, first-publisher advantage, and staleness detection — is vulnerable to manipulation. Optional OpenTimestamps mitigates but does not solve, and adoption is not required.

**Query privacy.** Relay subscription filters (`REQ`) leak exact client interests to relay operators in plaintext. No private information retrieval mechanism exists in Nostr or SCRUTINY. Organizational users face a structural trade-off between participating in the ecosystem and protecting their operational security.

**Artifact-fetch privacy leakage.** External `imeta` retrieval leaks requester metadata to artifact hosts. Hash validation protects integrity of fetched bytes, not privacy of the fetch itself.

**Trust bootstrap.** The WoT model is sound at maturity but undefined at genesis. Default trust list creation, signing, distribution, updating, and revocation are all unspecified. The bootstrap phase is the period of maximum vulnerability, yet receives the least protocol-level protection.

**View completeness.** The protocol guarantees event integrity (signatures) but not view completeness. A client can never know it has seen all relevant events for a given product or canonical identifier. This is an inherent limitation of any decentralized, relay-mediated system with no global consensus layer.

**NIP-09 / retraction semantic gap.** The protocol does not define how native Nostr deletions interact with SCRUTINY's retraction state machine. This creates ambiguous event states and a potential bypass of the auditability guarantee.

**Cryptographic agility.** Both Nostr and SCRUTINY hardcode `secp256k1` + `SHA-256` with no abstraction layer. Under a serious quantum or cryptanalytic break scenario, migration to PQC would require incompatible base-protocol evolution (hard-fork-like transition) across both layers.

**Binary trust model.** Trust is per-pubkey, not per-event. The protocol has no mechanism for partially trusting a publisher, flagging individual events as contested, or weighting trust based on domain expertise. This creates blind spots against intermittently dishonest publishers and AI-generated content.

**Permissionless identity.** Any key can claim any real-world identity. The protocol provides no identity attestation mechanism and explicitly relies on out-of-band trust establishment. This is a deliberate design choice (permissionlessness), but it shifts the identity verification burden entirely to users and clients.

**External artifact durability.** `imeta` artifacts are hosted on mutable external URLs. The protocol provides hash verification but no durability, mirroring, or liveness guarantees. Over time, artifact link rot degrades the evidential basis of the graph.

---

### Boundary between protocol and ecosystem

| Responsibility | Protocol | Ecosystem / Client |
|----------------|----------|--------------------|
| Event integrity (signature verification) | Yes — Schnorr signatures over secp256k1 (inherited from Nostr NIP-01) | — |
| Event availability | Partial — multi-relay design; portable event format | Relay operators; archival practices; Blossom relays; community mirroring |
| Artifact availability (`imeta` files) | Hash for integrity verification only | Hosting providers; content-addressed storage (Blossom, IPFS); mirror policies |
| Trust list curation | Structure defined (pubkey whitelists, WoT traversal rules) | Users; client defaults; community governance; default list signing and distribution |
| Trust bootstrap (genesis) | Not addressed | Client distributors; community seed lists; bootstrapping ceremonies |
| Content sanitization | Not addressed | Client implementations (XSS prevention, input validation) |
| Key management and revocation | Not addressed (noted as open question) | Users; key management tools; future Nostr NIPs (NIP-41) |
| Identity attestation | Not addressed (permissionless by design) | Out-of-band verification; domain proofs; organization-level key registries |
| Stale data management | Labels support versioning; `e_rev`/`q_rev` enable staleness detection | Client UX; publisher discipline; community conventions for expiry |
| Query privacy | Not addressed | Tor/VPN; broad filtering with local post-filtering; relay selection discipline |
| Artifact-fetch privacy (`imeta`) | Integrity hash only; no anonymity model | Proxy retrieval, artifact mirroring, anti-tracking fetch policies |
| Spam and DoS mitigation | Optional PoW (NIP-13); SCRUTINY tags for filtering | Relay-side rate limiting; client-side trust filtering; community moderation |
| NIP-09 / retraction interop | Not addressed | Client implementation policy; relay operator policy |
| Cryptographic agility | Not addressed | Dependent on Nostr protocol evolution |
| Dispute resolution | Not addressed (NIP-56 reports are advisory) | Community governance; client-side aggregation logic; out-of-band arbitration |
| Client correctness | Assumed (Section 3) | Conformance testing; code audits; reproducible builds; multiple implementations |
| AI-generated content detection | Not addressed | Publisher disclosure norms; community review processes; external verification tools |

---

## 8. Summary Table

| ID | Threat | Problem | Mitigation | Not Solved | Residual Risk |
|----|--------|---------|------------|------------|---------------|
| T1 | Timestamp manipulation | Self-reported `created_at` enables backdating/future-dating; Effective View directly vulnerable | Optional OpenTimestamps (NIP-03) | No client-side or relay-side rejection mandated; no timestamp validation requirement | High |
| T2 | Update ordering race | Crafted timestamps and chained UpdateEvents manipulate Effective View merge order | Deterministic ordering; author-key requirement | Self-reported timestamps undermine determinism; no user-facing audit of update chains | Medium |
| T3 | Retraction suppression | Retracted events replayed to relays missing the retraction; split-view across network | Multi-relay replication; append-only retractions | No retraction co-propagation guarantee; no relay-side retraction indexing requirement | Medium |
| T4 | Binding mislabeling | Incorrect relationship labels on immutable bindings; no in-place correction | Trust filtering; attributable authorship | No label validation; correction requires retract+republish with consistency window | Low–Medium |
| T5 | Artifact poisoning (`imeta`) | External host replaces file after publication; malicious artifacts exploit client parsers | SHA-256 hash (`x` tag); streaming validation guidance | Hash check is SHOULD, not MUST; no sandboxing or content-addressed storage requirement | Low–High |
| T6 | Key compromise | Attacker inherits full author authority; no protocol-level recovery | Open question; threshold-signing is a potential ecosystem direction | No key revocation in Nostr or SCRUTINY; threshold model not natively supported in standard clients | Critical |
| T7 | Sybil endorsement | Fake keys inflate aggregated endorsement scores | Trust-based filtering | No Sybil resistance; no depth weighting, scoring caps, or coordinated-creation detection | Medium |
| T8 | Canonical ID squatting | Self-asserted `i` tags claim well-known CPE/CVE identifiers | Multiple competing events; trust filtering | No cross-reference with authoritative registries; no conflict resolution | Medium |
| T9 | Fake identities | Anyone can create a key claiming any role or organization | Trust from curated lists, not key creation | No in-protocol identity attestation mechanism | Low–Medium |
| T10 | Spam / graph pollution | Flood of valid but worthless SCRUTINY events buries legitimate findings | Trust filtering; SCRUTINY tags; optional PoW (NIP-13) | Circular with bootstrap; PoW cost is symmetric; no rate limiting specified | Medium |
| T11 | Graph traversal amplification | Deep chains or extreme fan-out exhaust client resources during traversal | None specified | No depth/fan-out limits; no pagination or resource budget mandated | High |
| T12 | Replay / re-broadcast | Valid events replayed to relays missing retractions; storage flooding | Event deduplication (relay-side, not required) | Relay dedup not mandated; retraction gap interaction unaddressed | Medium |
| T13 | Event size limits | Large SCRUTINY events exceed relay size limits | None specified | No size recommendation for SCRUTINY events | Low |
| T14 | Relay indexing heterogeneity | Relays may not index all SCRUTINY-relevant tags (`#q`, `#e`, custom markers) | Standard Nostr tagging primitives | Cannot mandate relay indexing behavior | Medium |
| T15 | WoT bootstrap trap | Trust lists empty at genesis; no basis for trust decisions | Default trust lists (unspecified) | Who creates/signs/distributes/updates default lists is undefined | High |
| T16 | Metadata squatting | First publisher gains visibility; amplified by backdating (T1) | Multiple competing events; canonical ID clustering | No ranking preference for higher-trust sources; no timestamp verification | Medium |
| T17 | Relay censorship | Relay refuses to serve specific events | Multi-relay replication; external archives | Small relay sets enable coordinated censorship; no transparency mechanism | Low–Medium |
| T18 | Eclipse attack | Attacker controls all client relays; fabricates graph view via selective omission | Relay diversity; cryptographic event verification | No view-completeness check; no cross-relay consistency mechanism | Low–High |
| T19 | Relay surveillance | Relay operators observe query patterns and client interests | None specified | No private query mechanism in Nostr; plaintext subscription filters | High |
| T20 | Interest graph exposure | SCRUTINY queries reveal org security priorities and technology stack | None specified | Read-only participation still leaks metadata; aggregate patterns are informative | Medium–High |
| T21 | Bot centralization | Seed importers become de facto authorities via path dependency | Users can diversify trust over time | No concentration detection or diversity requirement | Medium |
| T22 | Indexer re-centralization | Convenience drives indexer concentration; single point of failure/control | Open, portable data model | No standard query API for interchangeability; no completeness verification | Medium |
| T23 | Trust list supply chain | Default trust list distribution is a compromise target | None specified | No signing/versioning/multi-party attestation defined for distribution | High |
| T24 | Client-side injection (XSS) | Free-text `content` enables XSS if unsanitized | None specified (client concern) | No sanitization requirement in spec | Medium |
| T25 | `kind: 1` friction / Nostr drift | Relay behavior changes or NIP deprecations break SCRUTINY | Version tagging; `kind: 1` for bootstrap compatibility | No migration path to dedicated kind; no relay compatibility matrix | Medium |
| T26 | Stale data | Old bindings persist; outdated findings mislead users | Version labels; `e_rev`/`q_rev` staleness detection | No expiry, no validity period, no version-scoped bindings | Medium |
| T27 | Legal pressure (general) | Litigation or takedowns suppress negative findings; chilling effect | Multi-relay, multi-archive replication | Cannot prevent legal coercion; no safe harbor mechanism | Medium |
| T28 | NIP-09 / retraction collision | Native Nostr deletion conflicts with SCRUTINY retraction state machine | None specified | No interop guidance; NIP-09 may cause permanent data loss bypassing audit trail | Medium |
| T29 | Cryptographic agility | Nostr hardcodes secp256k1 + SHA-256; no PQC migration path under quantum pressure without protocol-breaking changes | None (inherited from Nostr) | Practical migration likely requires a hard fork / incompatible base-protocol evolution | Low / High (long-term) |
| T30 | Occasionally lying publisher | Trusted publisher intermittently injects false metadata among accurate contributions | Attributable authorship; single-endorsement-per-key dedup | Binary trust model; no per-event credibility scoring or anomaly detection | Medium |
| T31 | Deleted raw metadata | External artifact becomes unavailable; MetadataEvent becomes an unverifiable shell | SHA-256 hash enables multi-source retrieval if mirrors exist | No mirroring, pinning, or liveness requirement; no client guidance for unavailable artifacts | Medium |
| T32 | Product impostor / hijacker | Attacker claims a product belonging to another vendor; gains first-mover visibility | Trust filtering; multiple competing events expected | No vendor verification; no priority for real vendor's key; bootstrap-phase vulnerability | Medium |
| T33 | scrutiny.cloud impostor | Impersonation of official SCRUTINY infrastructure; compromised bootstrap for new users | Decentralized design; cryptographic event verification | No official infrastructure registry; no code-signing requirement; trust bootstrap gap | Medium |
| T34 | Defaming consumer | Fabricated negative findings published and bound to target product | Attributable authorship; trust filtering; competing counter-assertions possible | No formal dispute mechanism; asymmetric burden of proof; screenshots/artifacts unfalsifiable at protocol layer | Medium |
| T35 | Event/artifact flooding (targeted DoS) | Targeted flood of events or large artifacts against specific product or hosting infrastructure | Trust filtering; SCRUTINY tags for relay-side filtering | No per-product rate limits; no artifact hosting durability requirements | Medium |
| T36 | Censoring vendor | Economic/legal pressure on relay operators to suppress specific events | Multi-relay replication; event portability | Cannot prevent legal coercion; small relay sets enable effective suppression | Medium |
| T37 | Suing vendor | Legal intimidation of individual publishers to force retraction or self-censorship | Append-only retractions preserve originals for audit; multi-relay replication | No distinction between voluntary and coerced retractions; no collective defense mechanism | Medium |
| T38 | Compromised developer | Backdoor or bug in client/bot software; breaks all protocol assumptions simultaneously | Open standard; multiple implementations possible; portable data model | No client certification, conformance testing, or reproducible-build requirement | High |
| T39 | Dispute troll | Systematic abuse of NIP-56 reports and NIP-25 reactions to suppress legitimate findings | Trust-based filtering applies to reports and reactions; reports are advisory | No trust-weighted report aggregation requirement; no rate limiting on reports; no dispute resolution | Medium |
| T40 | Misbehaving malicious LLM | AI-generated plausible but false metadata at scale; indistinguishable from expert analysis | Attributable authorship; endorsement model rewards independent corroboration | No human/AI distinction; no disclosure requirement; trust model not designed for AI-scale volume | Medium–High |
| T41 | Artifact host surveillance & tracking | External `imeta` fetches leak requester metadata and enable tracking-beacon correlation of investigations | Integrity hash checks; optional retrieval hygiene (proxying/mirroring) | No protocol-level private retrieval model or anti-tracking requirements | High |

---

## 9. Sources (selected)

- SCRUTINY v0.4 protocol specification: https://github.com/crocs-muni/scrutiny-fabric/blob/main/docs/protocol-spec.md
- Nostr NIPs index: https://github.com/nostr-protocol/nips/blob/master/README.md
- NIP-01 (events/signatures): https://github.com/nostr-protocol/nips/blob/master/01.md
- NIP-03 (OpenTimestamps): https://github.com/nostr-protocol/nips/blob/master/03.md
- NIP-09 (deletion requests): https://github.com/nostr-protocol/nips/blob/master/09.md
- NIP-10 (root/reply threading): https://github.com/nostr-protocol/nips/blob/master/10.md
- NIP-13 (Proof-of-Work): https://github.com/nostr-protocol/nips/blob/master/13.md
- NIP-25 (Reactions): https://github.com/nostr-protocol/nips/blob/master/25.md
- NIP-31 (Dealing with unknown events / `alt`): https://github.com/nostr-protocol/nips/blob/master/31.md
- NIP-32 (Labeling): https://github.com/nostr-protocol/nips/blob/master/32.md
- NIP-56 (Reporting): https://github.com/nostr-protocol/nips/blob/master/56.md
- NIP-57 (Lightning zaps): https://github.com/nostr-protocol/nips/blob/master/57.md
- NIP-92 (`imeta`): https://github.com/nostr-protocol/nips/blob/master/92.md
- FROST threshold Schnorr (RFC 9591): https://www.rfc-editor.org/rfc/rfc9591
- MeeSign demonstrator repos (CRoCS):
	- https://github.com/crocs-muni/meesign-server
	- https://github.com/crocs-muni/meesign-client
- NIST PQC project (migration guidance and standards): https://csrc.nist.gov/projects/post-quantum-cryptography
- CWE-347 (Improper Verification of Cryptographic Signature): https://cwe.mitre.org/data/definitions/347.html
- Web beacon / tracking pixel background: https://en.wikipedia.org/wiki/Web_beacon
- Privacy implications of email tracking (PETS 2018): https://petsymposium.org/2018/files/papers/issue1/paper42-2018-1-source.pdf
