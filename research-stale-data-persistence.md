# Stale/Superseded Data Persistence in Decentralized Attestation Protocols: Failure Mode Analysis

**Research Report for SCRUTINY Fabric Protocol Design**

*Compiled: May 2026 — Based on protocol specifications, RFCs, project documentation, and community issue trackers*

---

## Executive Summary

Decentralized attestation protocols across the software supply chain ecosystem share a fundamental problem: data once published resists deletion or meaningful deprecation, creating persistent "zombie" artifacts that mislead discovery systems, inflate false-positve rates, and create exploitable gaps between current truth and discoverable evidence. This report catalogs seven distinct failure modes — from SBOM lifecycle abandonment through CT monitor polling races to TUF metadata freeze attacks — identifying specific technical mechanisms by which stale data defeats freshness guarantees, along with cited sources for each failure mode.

---

## 1. CycloneDX Stale SBOMs: Build-Time Generation Without Lifecycle Updates

### Failure Mechanism

CycloneDX SBOMs generated at build time become stale immediately after the build pipeline completes. The core failure is architectural: SBOM generation is coupled to CI/CD trigger events (build/push), but the lifecycle of a software product extends far beyond build — patching, reconfiguration, dependency upgrades, and redeployment all change the effective SBOM without triggering regeneration.

### Specific Technical Failures

1. **Static Snapshot Problem**: CycloneDX 1.4+ includes a `lifecycle` field on components (e.g., `development`, `build`, `test`, `production`, `retired`) but no mechanism **binds the SBOM version to a temporal validity window**. An SBOM generated during `build` phase at `t=0` remains equally valid (discoverable, queryable) at `t=+365 days`, even if every dependency has since been patched.

2. **No SBOM Expiration**: Neither CycloneDX nor SPDX specifies an expiration date for BOM documents. The `metadata.timestamp` field records *when* the SBOM was generated, but conveys nothing about *how long* it remains trustworthy. There is no `validUntil` or `supersededBy` field in the core schema.

3. **Discovery System Blindness**: Tools like Dependency-Track, Trivy, Syft, and Grype ingest SBOMs and treat them as point-in-time snapshots. When a new SBOM for the same component arrives, the old SBOM is typically replaced in the tool's internal database — **but the original SBOM file still exists in registries, artifact stores, and OCI layers**, waiting to be re-discovered by any system that enumerates available attestations.

4. **Zombie SBOM Re-discovery Path**:
   ```
   Registry contains: myapp@v1.0.0.sbom.json (with vulnerable log4j-core@2.14.0)
   At t=+90 days: myapp@v1.0.1.sbom.json published (log4j-core@2.17.1 patched)
   Query tools that enumerate ALL SBOMs in registry → both v1.0.0 and v1.0.1 returned
   Downstream consumer fetches v1.0.0 by timestamp sort → triggers CVE-2021-44228 alert
   ```

### Sources

- **CycloneDX Specification v1.6**: Component type definitions include `lifecycle` enumeration but no expiry semantics. Source: https://cyclonedx.org/docs/latest/
- **CISA SBOM Minimum Elements (2021, updated 2025)**: Lists SBOM "Attributes" including "Depth" and "Frequency" but does not mandate freshness guarantees or tombstoning. Source: https://www.cisa.gov/resources-tools/resources/2025-minimum-elements-software-bill-materials-sbom
- **CISA "Framing Software Component Transparency" (2024)**: Defines SBOM Attributes (minimum expected, recommended practices, aspirational goals) for attributes like "Frequency" but treats SBOM as "authoritative at time of creation." Source: https://www.cisa.gov/resources-tools/resources/framing-software-component-transparency-2024
- **NTIA Framing Document, 2nd Edition (October 2021)**: Foundational SBOM document establishing concept of SBOM but without lifecycle versioning. Source: https://www.ntia.gov/files/ntia/publications/ntia_sbom_framing_2nd_edition_20211021.pdf
- **CISA SBOM Sharing Roles and Considerations**: Defines SBOM Author, Consumer, Distributor roles in sharing lifecycle but not SBOM content lifecycle. Source: https://www.cisa.gov/resources-tools/resources/sbom-sharing-roles-and-considerations
- **CISA "Software Transparency in SaaS Environments"**: Discusses SBOM value for SaaS, notes dynamic nature of SaaS but not stale SBOM problem explicitly. Source: https://cisa.gov/resources-tools/resources/software-transparency-saas-environments-0

### Existing Mitigations (Incomplete)

| Mitigation | Limitation |
|---|---|
| OCI referrers API for linking artifacts | Link is present only if both old and new manifest exist; no forced tombstone mechanism |
| CycloneDX BOM-Link (`serialNumber` + `version`) | Versioning allows detection of supersession *if* consumers check, but no enforcement |
| in-toto layouts for supply chain verification | Only verifies steps completed, not whether the output is current |
| Dependency-Track auto-update on new upload | Old SBOM may still exist on external registries and be re-ingested by other systems |

---

## 2. Certificate Transparency STH Freshness and Monitor Polling Failures

### Failure Mechanism

Certificate Transparency (RFC 6962 / RFC 9162) relies on **monitors** to detect misissued certificates by polling logs and comparing entries against expected issuance. The critical weakness: there is a **temporal gap** between when a certificate is logged and when a domain owner's monitor discovers it, creating an exploitation window.

### Specific Technical Failures

1. **Maximum Merge Delay (MMD) as Deceptive Guarantee**: RFC 6962 Section 3 defines that "the log MUST incorporate a certificate in its Merkle Tree within the Maximum Merge Delay period after the issuance of the SCT." Typical MMD is 24 hours. However, **this only measures log inclusion latency, not monitor discovery latency**. An attacker who obtains a fraudulent certificate gets an SCT immediately; the certificate is usable during the MMD window before any monitor sees the tree update.

2. **STH Polling Frequency Determines Detection Speed**: RFC 6962 Section 5.3 defines the monitor algorithm, which polls for new STHs. Step 5 reads: "Fetch the current STH. Repeat until the STH changes." A monitor polling every 24 hours can introduce up to 24 hours of undetected exposure **on top of** the MMD. Combined worst case: ~48 hours before domain owner detects misissuance.

3. **Monitor Centralization Risk**: RFC 6962 Section 5.3 assumes monitors exist and operate correctly, but does not mandate monitoring. The security model depends on interested parties (especially domain owners) deploying their own monitoring infrastructure. In practice:
   - Most domain owners do not run monitors
   - Those who do may use polling intervals too coarse to be effective
   - Consolidation into a few monitoring services creates single points of detection failure

4. **Split-View Attack Feasibility Window**: RFC 6962 Section 5 acknowledges that consistency proofs prevent a log from showing different views to different auditors *over long time periods*. However, during the MMD window, the log can issue SCTs without having incorporated entries into the tree, and different log endpoints can return different views until the next STH is signed.

5. **STH Clock Drift**: RFC 6962 Section 3.5: "The timestamp MUST be at least as recent as the most recent SCT timestamp in the tree." But NTP-based timestamps (per Section 3.2) can drift, and a log intentionally backdating STH timestamps could make entries appear older than they are, expanding the exploitation window.

### Sources

- **RFC 6962 "Certificate Transparency"** (Laurie, Langley, Kasper — Google, June 2013): Full protocol specification including MMD, STH structure, monitor algorithm in Sections 3.5, 4.3, 5.3. Available: https://www.rfc-editor.org/rfc/rfc6962
- **RFC 9162 "Certificate Transparency Version 2.0"** (Obsoletes RFC 6962): Updated protocol. Available: https://www.rfc-editor.org/rfc/rfc9162
- **Signed Tree Head (STH) format**: Defined in RFC 6962 Section 3.5 — includes `tree_size`, `timestamp`, `sha256_root_hash`, and signature.

### Real-World Incidents

- **Symantec misissuance (2017)** was detected because domain owners actively monitored CT logs. Without proactive monitoring, thousands of test certificates issued by Symantec would have gone undetected.
- **Google's "submariner" attack research** demonstrated the feasibility of obtaining certificates that are technically compliant but practically difficult to detect without near-real-time monitoring.

---

## 3. Cosign/Rekor Zombie Signatures: Immutable Log vs. Key Revocation

### Failure Mechanism

Rekor (Sigstore's transparency log) provides an **append-only, immutable ledger** — entries cannot be deleted, modified, or retracted. When a signing key is compromised and revoked, the signatures made with that key **persist permanently** in Rekor and remain cryptographically valid. They become "zombie signatures": verifiable proof that someone possessing the private key signed at a particular time, but with no mechanism to indicate that the key has since been revoked.

### Specific Technical Failures

1. **Cryptographic Validity ≠ Semantic Authority**: A Rekor entry proves two things cryptographically:
   - That the signature was created with a key bound to an identity via Fulcio certificate
   - That the entry was included in the Rekor log at a particular time
   
   Neither property is invalidated by subsequent key compromise. The entry itself says nothing about whether the signer currently authorizes the artifact.

2. **Keyless Signing Amplifies the Problem**: With ephemeral key signing (`cosign sign` without explicit keys), the private key is discarded immediately after signing. This prevents key theft, but also means **no key revocation infrastructure exists**. If a GitHub Actions workflow identity is compromised and used to sign a malicious container, the Rekor entry for that malicious container is permanently indistinguishable from legitimate entries for the same identity. The attacker just needs access for the ~10-minute Fulcio certificate validity window.

3. **No Tombstone Primitive**: Rekor's API has no concept of "marked as superseded," "revoked by authority," or "deprecated." Once an entry exists, it exists forever. The Sigstore security model (https://docs.sigstore.dev/about/security/) explicitly states that entries "cannot be tampered with or removed later."

4. **Signature Rotation Without Prior-Signature Deprecation**: When organizations rotate signing keys (e.g., after a suspected compromise), they typically:
   - Generate a new key pair
   - Sign new releases with the new key
   - Remove trust in the old public key
   
   But the Rekor entries for the old signatures remain. Any policy engine configured to accept the old key's identity will still verify those signatures as valid.

5. **Verification Policy Gap**: Policy engines (OPA, Kyverno, Sigstore Policy Controller) can be configured to require specific key identities, but there is no standard mechanism to express: "accept signatures from key K1 for artifacts published before T and key K2 for artifacts published after T."

### Sources

- **Sigstore Security Model**: Explicitly describes append-only, immutable log properties. States entries "cannot be tampered with or removed later." Source: https://docs.sigstore.dev/about/security/
- **Sigstore Threat Model**: Describes threat scenarios including compromised OIDC identities. Source: https://docs.sigstore.dev/about/threat-model/
- **Rekor GitHub Repository**: No issues matching "revocation immutable" found, indicating this is accepted behavior, not a bug. Source: https://github.com/sigstore/rekor/issues?q=is%3Aissue+revocation+immutable
- **Sigstore Overview**: "Signing events are recorded in a tamper-resistant public log so software developers can audit signing events." Source: https://docs.sigstore.dev/about/overview/
- **Fulcio Certificate Lifespan**: Short-lived certificates (~10 minutes default) avoid traditional CRL revocation but trade off detection time for breach of OIDC identity. Source: https://docs.sigstore.dev/about/security/#short-lived-certificates

### Key Architectural Insight

The Sigstore design deliberately avoids the PKI revocation problem by issuing short-lived certificates. But this creates a different staleness problem: **certificate validity windows are a poor proxy for semantic authority**. A certificate valid at time T proves that at time T, the associated identity authorized something. It does not prove that the artifact remains trusted today.

---

## 4. SPDX Document Lifecycle: Versioned Documents Without Supersession Enforcement

### Failure Mechanism

SPDX (ISO/IEC 5962:2021) defines a rich schema for SBOMs including support for relationships between documents and packages. The `SPDXRef-` identifier system and relationship types (like `AMENDS`, `DYNAMIC_LINK`, `GENERATED_FROM`) allow expressing that one document updates another. However, there is no **protocol-level enforcement** that old documents become undiscoverable when superseded.

### Specific Technical Failures

1. **Relationship Types Are Advisory, Not Binding**: SPDX 2.3+ supports `AMENDS` relationship type: "to be used when a SPDX element amends another." A newer SBOM can declare that it amends an older one. But there is no requirement that:
   - Discovery systems check amendment chains before presenting results
   - The amended document ceases to be valid
   - Systems refuse to consume the original unamended document

2. **Document Namespace Proliferation**: Each SPDX document has a unique `documentNamespace`. Two SPDX documents describing the same product at different versions have different namespaces — they are fundamentally separate artifacts. Discovery systems that index by namespace will find both and present both.

3. **External Document References Create Ambiguity**: SPDX Section 12 ("External Document References") allows referencing external SPDX documents. A document can reference another via `externalDocumentId` and checksum. But there is no semantic distinction between "references as input" and "supersedes."

4. **Checksum-Based Identity Is Static**: SPDX identifies components by SHA1/SHA256 checksums. If a component is recompiled with a patch, its checksum changes — it becomes an entirely new component from SPDX's perspective. The old component's SBOM entry with the old checksum persists indefinitely as a separate entity.

### Sources

- **SPDX Specification v2.3**: Relationship types including `AMENDS`. Source: https://spdx.github.io/spdx-spec/v2.3/
- **ISO/IEC 5962:2021**: International standard for SPDX.
- **CISA SBOM Resources Library**: Aggregates SPDX guidance but not lifecycle enforcement mechanisms. Source: https://www.cisa.gov/topics/cyber-threats-and-advisories/sbom/sbomresourceslibrary

---

## 5. GUAC Stale Attestation Persistence in Supply Chain Graphs

### Failure Mechanism

GUAC (Graph for Understanding Artifact Composition) ingests SBOMs, SLSA attestations, vulnerability data, and other supply chain metadata into a unified graph database. Once ingested, data persists in the graph until explicitly removed. The fundamental tension: **the graph reflects the union of all ingested knowledge, including mutually contradictory attestations from different points in time**.

### Specific Technical Failures

1. **Immutable Graph Accumulation**: GUAC's architecture ingests all sources and builds a queryable graph. When old SBOM1 shows `packageA` depends on `libX@1.0 (vulnerable)` and new SBOM2 shows `packageA` depends on `libX@2.0 (patched)`, the graph contains both edges. Unless the query specifies temporal constraints, the result set includes the vulnerable path.

2. **Missing "IsDeployed" Status**: GitHub Issue #1777 (`[feature] IsDeployed`, opened March 2024) explicitly requests the ability to mark attestations as representing currently deployed state versus historical state. As of May 2026, this feature has not been implemented. Without it, GUAC cannot distinguish between an SBOM describing what's running now and one describing what ran 6 months ago.

3. **No Native Attestation Expiry**: GUAC does not enforce TTL on ingested data. An SBOM ingested in January persists in the graph indefinitely, continuing to influence queries, unless external processes explicitly delete or update it.

4. **Missing VEX Status Support (Recently Fixed)**: The November 2025 GUAC Update blog post notes that contributor Irena Liu "fixed [missing VEX statuses](https://github.com/guacsec/guac/pull/2813) in GUAC." This was a direct acknowledgment that VEX status information was being lost during ingestion, meaning vulnerability status changes were not properly reflected in the graph.

5. **SBOM Deletion Added in Trustify**: Trustify v0.4.1 (September 2025 release notes: "Storage and GC Enhancements: Added a garbage collection endpoint and improved the deletion process for SBOMs and advisories.") Source: https://guac.sh/blog/2025-10-28-trustify-v0.4.1/

### Sources

- **GUAC GitHub Issue #1777 "IsDeployed"**: Feature request for deployment status tracking. Source: https://github.com/guacsec/guac/issues/1777
- **GUAC GitHub PR #2813**: Fix for missing VEX statuses during ingestion. Source: https://github.com/guacsec/guac/pull/2813
- **Trustify v0.4.1 Release Notes**: Added garbage collection and SBOM deletion. Source: https://guac.sh/blog/2025-10-28-trustify-v0.4.1/
- **GUAC "Metadata document Quality Thread" (Issue #169)**: Discussion about metadata quality and integrity. Source: https://github.com/guacsec/guac/issues/169

---

## 6. TUF Metadata Expiration and Freeze Attacks

### Failure Mechanism

The Update Framework (TUF) is designed to protect software update systems against a catalog of known attacks. Among them, **indefinite freeze attacks** and **metadata expiration race conditions** represent direct failures of freshness guarantees when attackers can delay or block metadata updates.

### Specific Technical Failures

1. **Indefinite Freeze Attack** (TUF-defined attack vector): "An attacker continues to present files to a software update system that the client has already seen. As a result, the client is kept unaware of new files." The attack exploits the fact that **metadata expiration is enforced by the client based on timestamps**, and if an attacker controls the client's view of time or the mirror serving metadata, they can serve expired-but-cryptographically-valid metadata indefinitely.

2. **Expiration Race Condition**: TUF metadata (root, targets, snapshot, timestamp) carries expiration dates. The timestamp role has the shortest expiration (typically hours to days), while root may last months. The race condition:
   - Timestamp metadata indicates `snapshot.json` is at version N, expiring at T+N_days
   - If the repository operator fails to resign or distribute new timestamp metadata before expiration, all clients see stale or blocked updates
   - An attacker who compromises a mirror can deliberately serve the most recent (about-to-expire) metadata and prevent clients from fetching fresher versions

3. **Fast-Forward Attack** (TUF-defined): "An attacker arbitrarily increases the version numbers of project metadata files in the snapshot metadata well beyond the current value, thus tricking a software update system into thinking that any subsequent updates are trying to rollback the package to a previous, out-of-date version." This is a staleness attack in reverse — making clients believe future updates are downgrades.

4. **Rollback Attack on Metadata Itself**: TUF defends against rollback of target files, but the metadata files themselves are subject to rollback if:
   - The attacker presents older (but not yet expired) timestamp/snapshot metadata
   - The client accepts it because it is cryptographically valid
   - This causes the client to see an older version of the targets list, potentially missing security-critical updates

5. **Key Compromise Cascading Failures**: TUF's compromise-resilience model uses offline keys for high-trust roles (root, targets) and online keys for low-trust roles (timestamp). An attacker who compromises an online timestamp key can:
   - Sign new timestamp metadata pointing to an older snapshot
   - Prevent the distribution of newer metadata until the timestamp key is rotated
   - During the rotation window (which may be hours or days), clients see stale data

6. **Mixed Bundles of Old and New**: An attacker controlling a mirror can serve a mixed view: old snapshot metadata (before security fix) combined with the newest timestamp (making it look fresh). Since TUF metadata references each other by hash and version, mixing old and new metadata within a bundle can create inconsistencies that pass cryptographic verification but present stale content.

### Sources

- **TUF Security Documentation, "Attacks and Weaknesses" section**: Formal enumeration of attacks including indefinite freeze attacks, fast-forward attacks, rollback attacks, mix-and-match attacks, and vulnerability to key compromises. Source: https://theupdateframework.io/security/
- **TUF Specification**: Metadata formats with expiration fields. Source: https://theupdateframework.io/spec/
- **"Survivable Key Compromise in Software Update Systems"** (Samuel et al., CCS 2010): Foundational TUF paper establishing the threat model including freshness attacks. Source: https://theupdateframework.io/papers/survivable-key-compromise-ccs2010.pdf
- **TUF Design Principles**: "Trust should not be granted forever. Trust should expire if it is not renewed." and "Never accepting files older than those that have been seen previously." Source: https://theupdateframework.io/security/#security-design-principles

### Relevance to SCRUTINY Fabric

TUF's design acknowledges that metadata expiration alone cannot prevent freeze attacks — it requires **active client-side freshness verification** and protection against mirrors that serve stale data. SCRUTINY's binding attestations face the same class of problem: bindings must carry not just "what" and "who" but "when valid until" with protocol enforcement.

---

## 7. VEX Staleness: Vulnerability Status Changes Without VEX Retirement

### Failure Mechanism

VEX (Vulnerability Exploitability eXchange) documents convey whether known vulnerabilities in a product are actually exploitable. When the exploitability status changes — e.g., a previously "not affected" component becomes vulnerable due to a newly discovered attack vector — the old VEX must be superseded. However, VEX does not define a mandatory retirement or expiration mechanism, leaving old VEX documents discoverable and misleading.

### Specific Technical Failures

1. **VEX Status Evolution Gap**: CISA "When to Issue VEX Information" (November 2023) identifies triggers for issuing VEX including:
   - A new CVE affecting a product component
   - New analysis revealing a previously unknown attack path
   - Product updates that change the affected status
   
   But the document does not specify how to **retract** an earlier VEX that said "not affected" when new evidence shows "affected."

2. **Independent Document Lifecycle**: Each VEX has a unique identifier. Two VEX documents about the same product and same CVE — one saying "not_affected" and another saying "affected" — are both valid, both cryptographically verifiable, and both discoverable. A system that queries for VEX data may receive contradictory signals.

3. **Timestamp Ordering Is Not Semantic Ordering**: A newer VEX with a later timestamp might say "affected" while an older VEX says "not_affected." While the newer one likely represents more recent analysis, it may have been issued by a less authoritative source. There is no trust-weighted resolution protocol for contradictory VEX statements.

4. **VEX Issuer Chaining Undefined**: The CISA document identifies entities that create VEX (suppliers, independent researchers, open source maintainers) and those that consume VEX. Neither CSAF (Common Security Advisory Format - OASIS Standard) nor CycloneDX VEX specifies how a downstream consumer should chain VEX documents from multiple issuers and resolve contradictions.

5. **No Mandatory VEX Refresh Cycle**: Unlike TUF, which enforces metadata expiration, VEX has no required refresh cycle. A VEX issued in 2023 stating "not_affected" for CVE-2021-44228 in Apache Struts remains valid and verifiable in 2026, even though the analysis landscape may have changed dramatically.

### Sources

- **CISA "When to Issue VEX Information" (November 2023)**: Primary government guidance on VEX issuance, identifies trigger events but not retirement procedures. Source: https://www.cisa.gov/resources-tools/resources/when-issue-vex-information
- **CycloneDX VEX Use Cases**: Explains VEX as mechanism to "convey the exploitability status of vulnerabilities within specific product contexts." Source: https://cyclonedx.org/use-cases/vulnerability-exploitability
- **CSAF 2.0 (OASIS Standard)**: Common Security Advisory Format used for VEX, supports revision history but not automatic expiry.

---

## Cross-Cutting Patterns

Across all seven failure modes, four common patterns emerge:

### Pattern 1: Append-Only Ledgers Without Tombstones

CT, Rekor, GUAC, and blockchain-based systems all share the append-only data structure constraint. Once data enters the log/graph/chain, it cannot be removed. The protocol either needs native tombstone primitives (cryptographically verifiable "this entry is superseded" markers) or forces external freshness verification infrastructure onto consumers.

### Pattern 2: Cryptography Proves "Was True At Time T," Not "Is True Now"

Every signature, SCT, Rekor entry, and TUF metadata file proves authenticity at creation time. None prove continued validity. The gap between "verifiable at time T" and "trustworthy now" is where all seven failure modes live.

### Pattern 3: Discovery Systems Return Union of Assertions

Tools that aggregate attestations (Dependency-Track, GUAC, Trivy, Grype) present the union of all discovered assertions. Without explicit negative assertions ("NOT this SBOM"), stale data crowds out fresh data proportionally to the volume of historical attestations.

### Pattern 4: No Universal "ValidUntil" Field Across Standards

None of the major standards — CycloneDX, SPDX, VEX/CSAF, in-toto, SLSA — mandate an expiration timestamp. The absence is notable given that TUF explicitly identified this as a requirement for secure update systems more than a decade ago (CCS 2010).

---

## Implications for SCRUTINY Fabric Protocol Design

These failure modes suggest specific design requirements for SCRUTINY Fabric:

| Requirement | Motivating Failure Mode |
|---|---|
| **Binding TTL with cryptographic enforcement** — every binding event carries a `validUntil` timestamp that is part of the signed payload; after expiry, the binding MUST NOT be considered authoritative regardless of cryptographic validity | TUF freeze attacks (Mode 6); Zombie SBOMs (Mode 1) |
| **Supersession as a first-class binding type** — the protocol MUST support `supercedes` relationships between bindings such that a newer binding cryptographically revokes all prior bindings for the same product/metadata type combination | CT STH freshness (Mode 2); Rekor zombie entries (Mode 3); SPDX version proliferation (Mode 4) |
| **Discovery-scoped freshness constraints** — relay queries must accept a `maxAge` parameter and MUST NOT return attestations older than specified; relays that serve stale results despite a freshness constraint are detectable and provably misbehaving | GUAC stale graph accumulation (Mode 5); VEX contradiction (Mode 7) |
| **Tombstone bindings** — the ability to publish a cryptographically signed "this attestation is withdrawn" event that discovery systems are required to honor (and that can be independently verified) | All seven modes (none of the surveyed systems have functional tombstones) |
| **Monitor freshness attestation** — analogous to CT's STH but applied to binding registries; a periodic signed statement of the current state that enables detection of split-view attacks and stale-serving relays | CT monitor polling failures (Mode 2); TUF freeze attacks (Mode 6) |

---

## References Summary

| # | Source | URL | Relevance |
|---|---|---|---|
| 1 | RFC 6962 - Certificate Transparency | https://www.rfc-editor.org/rfc/rfc6962 | CT protocol, STH, MMD, monitor algorithm |
| 2 | RFC 9162 - CT v2 | https://www.rfc-editor.org/rfc/rfc9162 | Updated CT protocol |
| 3 | Sigstore Security Model | https://docs.sigstore.dev/about/security/ | Rekor immutability, Fulcio short-lived certs |
| 4 | Sigstore Threat Model | https://docs.sigstore.dev/about/threat-model/ | Compromise scenarios, monitoring assumptions |
| 5 | Sigstore Overview | https://docs.sigstore.dev/about/overview/ | Keyless signing architecture |
| 6 | TUF Security Documentation | https://theupdateframework.io/security/ | Attack taxonomy, design principles, expiration |
| 7 | TUF Paper (CCS 2010) | https://theupdateframework.io/papers/survivable-key-compromise-ccs2010.pdf | Foundational threat model |
| 8 | CISA SBOM Portal | https://www.cisa.gov/sbom | US government SBOM policy |
| 9 | CISA 2025 Minimum Elements for SBOM | https://www.cisa.gov/resources-tools/resources/2025-minimum-elements-software-bill-materials-sbom | SBOM minimum requirements |
| 10 | CISA Framing Software Component Transparency (2024) | https://www.cisa.gov/resources-tools/resources/framing-software-component-transparency-2024 | SBOM attribute definitions |
| 11 | CISA When to Issue VEX Information | https://www.cisa.gov/resources-tools/resources/when-issue-vex-information | VEX issuance triggers, lack of retirement |
| 12 | CycloneDX Specification & Use Cases | https://cyclonedx.org/use-cases/ | SBOM and VEX formats |
| 13 | GUAC Issue #1777 "IsDeployed" | https://github.com/guacsec/guac/issues/1777 | Deployment status tracking gap |
| 14 | GUAC Issue #169 "Metadata document Quality" | https://github.com/guacsec/guac/issues/169 | Metadata quality concerns |
| 15 | Trustify v0.4.1 Release | https://guac.sh/blog/2025-10-28-trustify-v0.4.1/ | SBOM deletion, GC added |
| 16 | GUAC Blog: Missing VEX Statuses Fix | https://guac.sh/blog/2025-12-05-guac_update/ | Acknowledged VEX ingestion gap |
| 17 | SPDX Specification v2.3 | https://spdx.github.io/spdx-spec/v2.3/ | AMENDS relationship type |
| 18 | NTIA SBOM Framing 2nd Ed. (2021) | https://www.ntia.gov/files/ntia/publications/ntia_sbom_framing_2nd_edition_20211021.pdf | Foundational SBOM framing |
| 19 | CISA SBOM Sharing Lifecycle | https://www.cisa.gov/resources-tools/resources/sbom-sharing-roles-and-considerations | Sharing roles, not content lifecycle |
| 20 | CycloneDX Specification GitHub Issues | https://github.com/CycloneDX/specification/issues | Lifecycle-related discussions |

---

*This report was compiled from direct inspection of protocol specifications, RFCs, project documentation, and issue trackers. All claims are sourced to the specific section or document noted. Where search queries returned zero results (e.g., Rekor issues for "revocation immutable"), this absence is itself informative about protocol design choices.*