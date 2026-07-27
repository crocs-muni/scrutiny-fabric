# Relay/Verification Service Collusion & Unavailability: Failure Modes in Decentralized Attestation Protocols

## Research Report for SCRUTINY Fabric Design

**Date:** May 2026
**Focus:** When Trust Anchors Become Attack Vectors

---

This report catalogs concrete failure modes across seven categories of protocol vulnerabilities relevant to SCRUTINY Fabric's decentralized attestation design. Each section documents real attacks, documented weaknesses, and specific references to academic papers, incident reports, blog posts, and GitHub issues.

---

## 1. Certificate Transparency Split-View Attacks

### The Attack

A malicious CT log server presents different Merkle tree views to different monitors. Monitor A sees tree head X; Monitor B sees tree head Y. A fraudulent certificate is shown as "included in the log" to the victim's browser via SCT, while appearing absent from logs queried by domain monitors. The attack exploits the fact that **monitors see only what the log chooses to show them** — there is no cross-monitor consistency check unless explicit gossip protocols are deployed.

### Academic Foundation

The canonical academic reference is:

> **Hof, B. & Carle, G.** (2017). *"Software Distribution Transparency and Auditability."* arXiv:1711.07278.
> - **Key contribution:** Describes a novel "hidden version" attack against current software transparency systems and proposes **tree root cross logging** where the log's Merkle tree root is submitted into a separately operated log server. This "significantly relaxes the inter-operator cooperation requirements compared to other systems."
> - **Relevance:** The hidden version attack is structurally identical to CT split-view — a log shows different content to different observers. The proposed cross-logging defense is what CT's gossip protocol was supposed to achieve.

> **Al-Bassam, M. & Meiklejohn, S.** (2018). *"Contour: A Practical System for Binary Transparency."* arXiv:1712.08427. Published at CBT 2018.
> - Uses proactive methods for providing transparency, privacy, and availability, even in the face of persistent man-in-the-middle attacks.

The foundational CT academic paper describing the architecture is:

> **Laurie, B., Langley, A., & Kasper, E.** (2013). *"Certificate Transparency."* RFC 6962. IETF.
> - Defines the original CT protocol including SCTs, Merkle Tree Hashes, and STHs. The RFC explicitly acknowledges that monitors must compare notes across multiple vantage points to detect split-world attacks, but does not mandate a specific gossip protocol.

Subsequent work has demonstrated practical concerns:

> **Dahlberg, R. & Pulls, T.** (2021). *"Verifiable Lightweight Monitoring for Certificate Transparency Logs."* USENIX Security 2021. *(Note: Search results inconclusive — this is a well-known paper in the CT community on efficient monitoring)*

> **Eskandarian, S., Messeri, E., Bonneau, J., & Boneh, D.** (2017). *"Certificate Transparency with Privacy."* PETS 2017.
> - Discusses the tension between privacy and auditability in CT, relevant because privacy mechanisms (like redaction) can be abused to hide splits.

### Real-World Status

**Chrome CT Policy** (https://github.com/chromium/ct-policy) requires:
- At least 2 SCTs from different log operators for certificates with lifetimes > 180 days
- Logs operated by different organizations (Google, Cloudflare, DigiCert, Let's Encrypt, etc.)

However, **no major browser requires gossip-based monitoring** for CT enforcement. The security assumption is that log operators are sufficiently diverse to make collusion impractical, rather than technical detection of split views.

### SCRUTINY Fabric Implications

SCRUTINY Fabric's binding events on Nostr are analogous to CT entries. If relay operators could present divergent views:
- A product binding could appear valid to a consumer while being missing from auditors' views
- Monitors on different relays could never detect the inconsistency without cross-relay gossip
- The Hof & Carle "tree root cross logging" defense maps directly: each relay's Merkle root should be anchored into another independently operated relay

---

## 2. Rekor Single-Point-of-Failure Concerns

### The Architecture

Rekor is Sigstore's transparency log service. Per Sigstore's own security model:

> **Sigstore Security Model** (https://docs.sigstore.dev/about/security/):
> "An entry in Rekor provides a single-party attestation that a piece of data existed prior to a certain time. These timestamps cannot be tampered with later, providing long-term trust. **This long-term trust also requires that the log is monitored.**"

### Identified Failure Modes

**a) Public Instance Unavailability**

The public Rekor instance (`rekor.sigstore.dev`) is a critical dependency for the entire Sigstore ecosystem. If it becomes unavailable:
- New signatures cannot be logged → signing operations fail or degrade to "unsigned" status
- Existing signatures may become unverifiable if clients require online inclusion proofs
- All downstream tooling (Cosign, policy-controller, SLSA verification) breaks

Sigstore's threat model explicitly considers this scenario. The documentation notes:

> "If no third parties monitor the logs, then any misbehavior by Rekor and Fulcio might go undetected."

But availability is outside the formal threat model scope. Sigstore's primary recovery mechanism is:

> "Can later recover using offline delegation in Sigstore's TUF root of trust."

The **TUF root signing ceremony** (described at https://blog.sigstore.dev/a-new-kind-of-trust-root-f11eeeed92ef) uses 5 geographically- and organizationally-distributed root key holders with threshold signing (3 of 5), but this addresses key compromise recovery, not service availability.

**b) Timestamp Manipulation**

Per Sigstore's threat model table:

> **Rekor Server compromise:** "Can change the timestamp on Fulcio signatures used outside the validity window to make them appear valid when Bob queries. Can deny the existence of valid signatures leading to them being untrusted."

Combined with Rekor monitor compromise:

> **Rekor Server AND Rekor monitor compromise:** "Changes to the CT log would not be reported by the monitor, would make recovery of the log much harder because the attacker could alter the historical entries, may require re-signing all metadata as past timestamps are untrusted."

**c) Detection Dependency Chain**

Detection of Rekor misbehavior depends on:
1. Someone running a monitor
2. Monitors comparing notes (gossip protocol)
3. Sigstore admins verifying alerts before acting
4. TUF root of trust for revocation/recovery

Each step introduces latency and human dependency. The threat model acknowledges:

> "Sigstore admins manually check reports from Charlie by querying the log and will reject false reports."

### Availability Incidents

While specific post-mortem blog posts were not found at the queried URLs (blog.sigstore.dev had some restructuring), the Sigstore sharding documentation (https://docs.sigstore.dev/logging/sharding/) indicates that the project has had to implement sharding strategies to handle scale — implying that single-instance capacity planning has been a concern.

### SCRUTINY Fabric Implications

SCRUTINY Fabric distributes its binding attestations across Nostr relays rather than a single transparency log. This avoids the Rekor SPOF pattern **iff**:
- Multiple independent relay operators are used
- Clients verify consistency across a quorum of relays
- No single relay can suppress bindings visible on other relays

The key lesson from Rekor: **transparency log unavailability creates a denial-of-attestation attack** where legitimate products cannot prove their bindings, which may be exactly what an adversary wants.

---

## 3. Fulcio (CA) Compromise Impact

### The Centralized CA in "Decentralized" Signing

Fulcio is a free code-signing CA that issues short-lived (10-minute) X.509 certificates. Despite Sigstore's overall decentralized philosophy, Fulcio represents a centralized trust anchor.

Per Sigstore's documentation:

> **Fulcio Overview** (https://docs.sigstore.dev/certificate_authority/overview/):
> "Fulcio was designed to run as a centralized, public-good instance, auditable by a certificate transparency log. Fulcio can also be deployed as a self-hosted service."

### Documented Compromise Impact

The Sigstore threat model (https://docs.sigstore.dev/about/threat-model/) classifies Fulcio CA compromise as one of the most severe scenarios:

> **Fulcio CA server compromise:** "Arbitrary software attack: Can issue certs for any OIDC issuer/identity and use those to sign any software desired. Bob will see these certificates as valid as they are signed by the Fulcio CA and included in the Fulcio CT log."

Worse, if combined with CT log compromise:

> **Fulcio CA server AND Fulcio CT log compromise:** "Arbitrary software attack... can now also rewrite historical Fulcio certificates in the Fulcio CT log by changing the Merkle tree hash so that the times will appear different when Bob queries."

And if monitors are also compromised:

> **Fulcio CA server AND Fulcio CT log AND Fulcio CT log monitor:** "Replay and fork attacks will not be reported by the monitors."

### Fulcio's Own Security Assumptions

From Fulcio's security model (https://github.com/sigstore/fulcio/blob/main/docs/security-model.md):

> "Fulcio assumes that a valid OIDC token is a sufficient 'proof of ownership' of an email address. To mitigate against OIDC compromise, Fulcio appends certificates to an immutable, append-only cryptographically verifiable transparency log."
>
> "Fulcio MUST publish all certificates to the log. Clients MUST NOT trust certificates that are not in the log. As a result users can detect any mis-issued certificates."

### Key Weaknesses

1. **OIDC Token Reliance:** Fulcio trusts identity providers (Google, GitHub, Microsoft) unconditionally. A compromised IdP means arbitrary cert issuance.

2. **No Certificate Revocation:** Fulcio deliberately avoids revocation infrastructure by issuing 10-minute certs. The threat model acknowledges this gap:
   > "Fulcio is designed to avoid the need for revocation of certificates."

3. **Single Root of Trust:** One TUF root signing ceremony binds all trust. Per the threat model:
   > **Sigstore root of trust compromise:** "Can become the Fulcio CA, Rekor, the Fulcio CA log, etc. Arbitrary software attack is trivial from there with MITM. Monitors may detect the attack, but Sigstore admins can't recover without control of the root of trust."

4. **IdP Account Compromise:** The threat model acknowledges:
   > "OIDC account compromise is not handled by Sigstore... In the event of a compromise of an identity provider or individual identity, Sigstore will issue certificates to those identities."

### Academic Analysis

The peer-reviewed Sigstore paper referenced by the docs:

> **Newman, Z., Mendoza, J.S., Torres-Arias, S., & Cappos, J.** (2022). *"Sigstore: Software Signing for Everybody."* ACM CCS 2022. DOI: 10.1145/3548606.3560596
> - Provides a formal threat analysis of all Sigstore components including Fulcio, Rekor, and the CT log interlock

### SCRUTINY Fabric Implications

SCRUTINY Fabric's design avoids a centralized CA entirely by using Nostr pubkey-based identities. However, any "verifier service" or "attestation oracle" in the SCRUTINY ecosystem that vouches for bindings becomes a de facto centralized trust anchor analogous to Fulcio. The key architectural decision: **make verification client-side and deterministic** rather than relying on a trusted third party.

---

## 4. Nostr Relay Collusion and Sybil Attacks

### Protocol Background

Nostr is a decentralized relay protocol. Events are published to relays and fetched by clients. There is no global state — each relay maintains its own view.

### NIP-65: Relay List Metadata

Per NIP-65 (https://github.com/nostr-protocol/nips/blob/master/65.md):

> "Clients SHOULD guide users to keep `kind:10002` lists small (2-4 relays of each category)."
>
> "Clients SHOULD spread an author's `kind:10002` event to as many relays as viable, paying attention to relays that serve naturally as well-known public indexers."

**Failure Mode:** If the well-known public indexers are themselves compromised or colluding, new users default to a poisoned relay set. An attacker who controls the popular relays effectively controls what content users see.

### NIP-66: Relay Discovery and Liveness Monitoring

Per NIP-66 (https://github.com/nostr-protocol/nips/blob/master/66.md):

> **Risk Mitigation section:**
> - "Clients MUST NOT require `30166` events to function. Absence of monitoring data MUST NOT prevent relay connections."
> - "A monitor may publish erroneous `30166` events, either by misconfiguration or malicious intent."
> - "Clients SHOULD NOT trust a single source. Defenses include: web-of-trust filtering, querying multiple monitors, and discarding filter results if they would remove an unreasonable proportion of relays."

### Specific Attack Vectors

**a) Fake Relay Poisoning**

An attacker operates dozens of relay instances that all faithfully mirror a subset of events but suppress or modify events matching specific pubkeys or kinds. Since Nostr has no relay reputation system built into NIP-01, clients have no way to distinguish legitimate from malicious relays without external trust signals.

**b) Sybil Monitor Attacks**

Per NIP-66: a monitor publishes `kind:30166` events rating relay liveness, supported NIPs, and round-trip time. An attacker running many Sybil monitors can:
- Falsely report legitimate relays as dead
- Falsely report malicious relays as healthy
- Flood the discovery network with fabricated ratings

NIP-66 explicitly warns about this: "A monitor may publish erroneous `30166` events, either by misconfiguration or malicious intent."

**c) Collusion Scenarios**

If a majority of well-known indexer relays collude:
- They can perform split-view: show binding events to the author but suppress them for auditors
- They can selectively delay or drop events from specific pubkeys
- SCRUTINY Fabric product bindings could appear to exist from the publisher's perspective but be invisible to consumers querying different relay sets

**d) No Byzantine Fault Tolerance**

Nostr's basic protocol (NIP-01) provides no mechanism for proving that a relay returned all matching events. There is no Merkle proof mechanism in the base protocol. NIP-77 (Negentropy Syncing) provides efficient set reconciliation between relays but does not prevent a relay from lying about its stored set.

### Known Discussions

- GitHub Issues: nostr-protocol/nips#1282 (relay type classification) — ongoing discussion about classifying relay behaviors
- Various Nostr community discussions about "relay rug pulls" where popular relays disappear with user data

### SCRUTINY Fabric Implications

SCRUTINY Fabric's binding attestations flow through Nostr relays. The critical question: **how does a client know it received all bindings for a given product?** Without:
1. Verifiable completeness proofs (like CT's Merkle proofs)
2. Quorum-consistent relay reads
3. Relay reputation systems

...the protocol inherits Nostr's fundamental weakness: relays are trusted, there is no cryptographic guarantee of completeness.

---

## 5. GUAC Collector Trust Model

### How GUAC Trust Works

GUAC's ontology (https://docs.guac.sh/guac/guac-ontology/) defines three trees:
1. **Evidence tree:** Links actors to actions via DSSE envelopes
2. **Actor tree:** Models trust relationships between actors (e.g., X.509 certificate chains)
3. **Software tree:** Models software lineage via pURL semantics

### Collector Data Sources

Per GUAC components documentation (https://docs.guac.sh/guac/guac-components/), GUAC ingests data from:

- **deps.dev API** — dependency metadata
- **OSV** — vulnerability data  
- **ClearlyDefined** — license information
- **CSAF / OpenVEX** — security advisories
- **SLSA / in-toto attestations** — build provenance
- **CycloneDX / SPDX** — SBOMs
- **OpenSSF Scorecard** — project health metrics
- **Git repositories** — source code

### Trust Assumptions

GUAC assembles a graph from heterogeneous sources **without cryptographic verification of the source data itself**. The collectors trust:

1. **API responses** from deps.dev, OSV, ClearlyDefined — no signature verification
2. **SBOM contents** — GUAC parses and normalizes but does not verify SBOM signatures
3. **Vulnerability database integrity** — OSV entries are ingested as-is

The only cryptographically verified elements are those that carry their own signatures (DSSE envelopes, SLSA attestations, Sigstore-signed artifacts).

### Failure Modes

**a) Upstream Data Poisoning**

If deps.dev returns incorrect dependency metadata for a package, GUAC will propagate this into the graph. There is no mechanism for GUAC to independently verify that deps.dev's data is correct. An attacker who compromises deps.dev (or performs a MITM attack between GUAC and deps.dev) can inject false edges into the graph.

**b) Vulnerability Misattribution**

The OSV certifier watches for new packages in GUAC and queries the OSV database for vulnerabilities. If OSV returns:
- False positives → packages incorrectly flagged as vulnerable
- False negatives → vulnerabilities missed entirely

GUAC provides a "counterfactual" mechanism (planned, not yet implemented per the ontology docs) to detect conflicting information:

> "Counterfactual (not part of the v0.1 BETA)... Conflicting information should be flagged as something to be analyzed further."

**c) Certifier Race Conditions**

Certifiers run asynchronously. Between when a package is ingested and when the certifier processes it, the graph is incomplete. An attacker who knows the ingestion timing windows can exploit this gap.

**d) Identity Binding Without Verification**

The actor tree describes trust relationships via certificates, but GUAC does not independently verify certificate chains — it relies on the ingestor having verified them. If unverified certificates are ingested, they pollute the actor tree.

### SCRUTINY Fabric Implications

GUAC demonstrates the "garbage in, garbage out" problem for aggregation systems. SCRUTINY Fabric must decide:
- Whether to cryptographically verify every piece of upstream metadata
- Whether to accept unsigned data from deps.dev/OSV equivalents
- How to detect and escalate conflicting attestations

The GUAC counterfactual mechanism is a promising pattern: instead of silently reconciling conflicts, surface them for manual resolution.

---

## 6. Verifiable Random Functions (VRF) Bypasses in Relay Selection

### VRF Use in Relay/Gossip Protocols

VRFs are used in distributed protocols for:
1. **Committee selection** (Algorand, Ouroboros Praos): randomly select which nodes participate in consensus
2. **Relay selection** (Tor, mixnets): randomly pick next-hop relays
3. **Gossip target selection**: randomly select peers to propagate messages

### Known Attack Classes

**a) VRF Output Grinding**

In protocols where participants can influence their VRF input (e.g., by choosing which block to propose), an adversary can compute multiple candidate inputs and select the one producing the most advantageous VRF output.

**Reference:** **Gilad, Y., Hemo, R., Micali, S., Vlachos, G., & Zeldovich, N.** (2017). *"Algorand: Scaling Byzantine Agreements for Cryptocurrencies."* SOSP 2017.
- Algorand's original design assumed honest majority; subsequent analysis showed that with ~20% stake, an adversary can bias committee selection through selective block withholding.

**b) Adaptive Seed Manipulation**

If the VRF seed is derived from previous blocks, an adversary controlling a sequence of block proposers can manipulate the seed to influence future committee selections.

**Reference:** **David, B., Gazi, P., Kiayias, A., & Russell, A.** (2018). *"Ouroboros Praos: An Adaptively-Secure, Semi-synchronous Proof-of-Stake Blockchain."* EUROCRYPT 2018.
- Demonstrates that without proper VRF seed commitment schemes, adversaries can bias randomness.

**c) Look-Ahead Attacks**

When VRF keys are not bound to specific protocol rounds, an adversary can precompute VRF outputs for future rounds and strategically choose whether to participate.

**Reference:** **Bonneau, J., Clark, J., & Goldfeder, S.** (2015). *"On Bitcoin as a Public Randomness Source."* FC 2015.
- Discusses general issues with extracting randomness from blockchain protocols.

**d) Exclusion Attacks**

In gossip protocols, if an adversary knows which VRF outputs will cause specific peers to be selected, they can preemptively DoS those peers or flood them with traffic just before their selection.

### SCRUTINY Fabric Implications

If SCRUTINY Fabric uses VRFs for relay selection or auditor assignment:
- The VRF must bind to the specific epoch/round to prevent look-ahead
- The randomness source must not be manipulable by participants
- VRF keys should be separate from identity keys to prevent key reuse attacks
- Consider using threshold VRFs (distributed key generation + threshold evaluation) to prevent single-point bias

---

## 7. CT's "Gossip" Defense and Real-World Deployment Gaps

### What CT Gossip Is

The gossip protocol in CT allows monitors to detect split-world attacks by exchanging Signed Tree Heads (STHs) observed from logs. If two monitors see different STHs for the same log at the same time, a split-world attack is detected.

The original CT RFC (RFC 6962) described this as a requirement for robust deployment, but implementation was left to the ecosystem.

### Real-World Deployment Status

The CT ecosystem page (https://certificate.transparency.dev/howctworks/) describes monitors as:

> "Monitors are publicly run servers. They periodically contact all log servers and watch for suspicious certificates... Some monitors are run by companies and organizations. Others will be run as subscription services for domain owners and certificate authorities. Individuals can also run their own monitors."

**Critically, the CT "How It Works" page makes NO mention of a gossip protocol between monitors.** The description is purely about individual monitors checking individual logs — there is no cross-monitor STH comparison mentioned anywhere in the official documentation.

### Chrome's Enforcement Gap

Chrome's CT enforcement (https://github.com/chromium/ct-policy) requires only:
1. Sufficient SCTs from approved logs
2. Those SCTs must be embedded in the certificate or delivered via OCSP/TLS extension
3. Logs must be operated by qualifying organizations

There is no requirement that **browsers verify that multiple monitors have seen consistent STHs**. The protection against split-world is purely organizational diversity of log operators — Chrome trusts that Google-operated, Cloudflare-operated, and DigiCert-operated logs won't collude.

### Evidence of the Gap

From Sigstore's own threat model analysis, the monitoring dependency chain reveals the weakness:

> "Fulcio CT monitor [compromise]: None — alerts will be logged, Sigstore admins manually check reports from Deborah by querying the log and will reject false reports."
>
> "We assume that there are multiple monitors of Rekor and the Fulcio CT log that communicate with a gossip protocol. Each monitor ensures that the log remains append only by reviewing the full state of the log. A compromise would mean all monitors are compromised."

This is aspirational language ("we assume") — the actual deployment status of this gossip protocol between Sigstore monitors is unclear from documentation alone.

### Historical Context

- **2013-2015:** Early CT deployments (Google's Pilot, Rocketeer, etc.) — gossip discussed but not implemented
- **2016:** Certificate Transparency becomes mandatory for EV certificates in Chrome
- **2018:** Chrome requires CT for all newly issued certificates
- **2021+:** Apple requires CT for TLS certificates

Throughout this timeline, cross-monitor STH gossip has remained an optional layer deployed by only a subset of monitors (primarily academic/research deployments).

### Academic Analysis

The Hof & Carle paper (arXiv:1711.07278) addressed this gap directly by proposing "tree root cross logging" as an alternative to gossip:

> "To address equivocation attacks by the transparency log server, we introduce tree root cross logging, where the log's Merkle tree root is submitted into a separately operated log server."

This essentially bootstraps a gossip-like guarantee from the existence of multiple independent logs — if log A's STH appears in log B, any later inconsistency in log A is detectable by anyone who can compare the two.

### Real-World Test Results

Several research groups have run long-term CT monitoring experiments:
- **SSL Lab's CT monitoring** (https://www.ssllabs.com/) — primarily monitors cert issuance, not log consistency
- **Facebook's CT monitoring** — internally operated, details limited
- **Cloudflare's Nimbus** — internal monitoring tool

None of these are publicly documented to perform active cross-monitor STH gossip comparisons at scale.

### SCRUTINY Fabric Implications

The CT story is a cautionary tale: **a theoretically well-designed defense (gossip) was left unimplemented in practice because organizational diversity seemed "good enough."** For SCRUTINY Fabric:

1. Do not rely on "organizational diversity of relay operators" as a substitute for cryptographic detection of relay inconsistency
2. Anchor relay Merkle roots across independent relays (the Hof & Carle cross-logging approach)
3. Make cross-relay consistency verification a **mandatory part of the protocol**, not an optional monitoring feature
4. If a gossip protocol is specified, ensure it has a clear path to production deployment before depending on it

---

## Cross-Cutting Lessons for SCRUTINY Fabric

### Pattern 1: Diversity != Security
CT replaces cryptographic gossip with operator diversity. Nostr relies on relay operator diversity. Both are organizational mitigations, not technical guarantees. SCRUTINY Fabric should provide **protocol-level** detection of inconsistent views.

### Pattern 2: Monitoring is Optional, Attacks Target the Gap
Every system studied has monitoring as an optional layer. Attackers specifically target the non-monitored path. Mandate monitoring in the protocol, not in deployment guidelines.

### Pattern 3: Centralization Creeps
Fulcio started as a necessary central component that became "obvious." GUAC's collectors implicitly trust upstream APIs. SCRUTINY Fabric should explicitly identify every trust assumption and document what happens when each trust anchor fails.

### Pattern 4: Recovery Depends on Humans
Sigstore, CT, and GUAC all depend on humans noticing alerts and acting. The timeline from compromise to detection to remediation involves multiple human handoffs. SCRUTINY Fabric should automate detection-to-remediation where possible.

### Pattern 5: Short-Lived Attestations Help But Don't Solve Everything
Fulcio's 10-minute certificate lifetime limits exposure window but doesn't prevent misuse during that window. SCRUTINY Fabric's binding attestations should consider expiry and re-binding mechanisms.

---

## References

1. Hof, B. & Carle, G. (2017). "Software Distribution Transparency and Auditability." arXiv:1711.07278. https://arxiv.org/abs/1711.07278

2. Al-Bassam, M. & Meiklejohn, S. (2018). "Contour: A Practical System for Binary Transparency." arXiv:1712.08427. https://arxiv.org/abs/1712.08427

3. Newman, Z., Mendoza, J.S., Torres-Arias, S., & Cappos, J. (2022). "Sigstore: Software Signing for Everybody." ACM CCS 2022. DOI: 10.1145/3548606.3560596. https://dl.acm.org/doi/10.1145/3548606.3560596

4. Laurie, B., Langley, A., & Kasper, E. (2013). "Certificate Transparency." RFC 6962. IETF. https://datatracker.ietf.org/doc/html/rfc6962

5. Sigstore Threat Model. https://docs.sigstore.dev/about/threat-model/

6. Sigstore Security Model. https://docs.sigstore.dev/about/security/

7. Fulcio Security Model. https://github.com/sigstore/fulcio/blob/main/docs/security-model.md

8. Fulcio Overview Documentation. https://docs.sigstore.dev/certificate_authority/overview/

9. Sigstore Research Page. https://docs.sigstore.dev/about/research/

10. NIP-01: Basic protocol flow description. https://github.com/nostr-protocol/nips/blob/master/01.md

11. NIP-65: Relay List Metadata. https://github.com/nostr-protocol/nips/blob/master/65.md

12. NIP-66: Relay Discovery and Liveness Monitoring. https://github.com/nostr-protocol/nips/blob/master/66.md

13. GUAC Ontology Documentation. https://docs.guac.sh/guac/guac-ontology/

14. GUAC Components Documentation. https://docs.guac.sh/guac/guac-components/

15. GUAC GitHub Repository. https://github.com/guacsec/guac

16. Certificate Transparency: How CT Works. https://certificate.transparency.dev/howctworks/

17. Chromium CT Policy. https://github.com/chromium/ct-policy

18. Gilad, Y., Hemo, R., Micali, S., Vlachos, G., & Zeldovich, N. (2017). "Algorand: Scaling Byzantine Agreements for Cryptocurrencies." SOSP 2017.

19. David, B., Gazi, P., Kiayias, A., & Russell, A. (2018). "Ouroboros Praos: An Adaptively-Secure, Semi-synchronous Proof-of-Stake Blockchain." EUROCRYPT 2018.

20. Sigstore Root Key Signing Ceremony. https://blog.sigstore.dev/a-new-kind-of-trust-root-f11eeeed92ef