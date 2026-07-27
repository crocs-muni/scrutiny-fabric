# Existing Protocol Failures — Chain/Attestation Ordering & Timestamp Races

## Report for SCRUTINY Fabric Threat Model Research
**Date:** 2026-05-03
**Scope:** Documented failure modes in production attestation/supply-chain protocols related to ordering, timestamp binding, and inclusion races.

---

## 1. Cosign / Sigstore — Rekor Bundle Cross-Signature Copy Attack

### CVE-2022-23649 · GHSA-ccxc-vr6p-4858
**Severity:** Low (but high conceptual relevance)  
**Fixed in:** cosign v1.5.2  
**Discovered by:** Miloslav Trmač (@mtrmac)  
**Published:** 2022-02-18  
**Source:** https://github.com/sigstore/cosign/security/advisories/GHSA-ccxc-vr6p-4858

### Description
An attacker with OCI push/pull access to a signature could transplant a valid Rekor transparency log bundle from one signature onto another signature that was never submitted to Rekor. The attacker would:

1. Pull the signature image from OCI
2. Annotate it with **any valid Rekor bundle** under `dev.sigstore.cosign/bundle`
3. Push the signature back to OCI

Cosign's verification output then falsely claimed:
> *"Existence of the claims in the transparency log was verified offline"*

**Key failure:** Cosign did **not verify that the Rekor `signedEntryTimestamp` (SET) corresponded to the specific signature being verified.** It only checked that the bundle was cryptographically valid — the binding between the SET and the signed artifact was absent.

### Keyless variant
The attacker could use a different keypair signing during the same Fulcio certificate validity window (~20 minutes) to get a real Rekor entry, then copy that bundle to the unsigned artifact.

### Fix Applied
The patch in v1.5.2 added a comparison check: the signature inside the `signedEntryTimestamp` from Rekor must match the signature being verified. If a valid bundle is copied to a different signature, verification fails.

### Relevance to SCRUTINY Fabric
This is the **prototypical attestation-ordering attack**: a transparency log entry for attestation B is presented as proof for attestation A. The countermeasure is **cryptographic binding between the log commitment (SET) and the attested artifact — you must verify the signed payload references the specific artifact under verification.**

---

## 2. Cosign — Bundle Mismatch Silent Acceptance (Multiple Vulns)

### CVE-2022-36056 · GHSA-8gw7-4j42-w388
**Severity:** Moderate (CVSS 5.5)  
**Fixed in:** cosign v1.12.0  
**Published:** 2022-09-14  
**Source:** https://github.com/sigstore/cosign/security/advisories/GHSA-8gw7-4j42-w388

### Four distinct vulnerabilities in one advisory:

**Vulnerability 1: Bundle mismatch**
A cosign bundle contains `base64Signature`, `cert`, and `rekorBundle`. Step three of verification — verifying the `rekorBundle` payload references the given artifact — **was not performed**. Any old Rekor bundle could pass validation.

Steps to reproduce:
```
cosign sign-blob blob1 --bundle bundle1
cosign sign-blob blob2 --bundle bundle2
jq --slurpfile bundle2 bundle2 '.rekorBundle = $bundle2[0].rekorBundle' bundle1 > invalidBundle
cosign verify-blob blob1 --bundle invalidBundle  # SUCCEEDS INCORRECTLY
```

**Vulnerability 2: Certificate identity checks silently skipped**
When providing `--certificate-email` and `--certificate-oidc-issuer` flags with an offline bundle, cosine ignored those values entirely. Verification succeeded regardless.

**Vulnerability 3: Invalid bundle + missing experimental flag = success**
Without `COSIGN_EXPERIMENTAL=1`, an invalid bundle caused Cosign to fall through to online inclusion proof, but then exit early — succeeding unconditionally without actually verifying anything.

**Vulnerability 4: Invalid transparency log entry = unconditional success**
If Rekor returned an invalid entry (bad SET, bad inclusion proof, malformed), Cosign exited early and succeeded unconditionally rather than failing.

### Relevance to SCRUTINY Fabric
Three critical design lessons:
1. **Every field in a verification chain must be independently validated.** Cosign had gaps at multiple levels.
2. **Silent fallback to "success" on error** is a devastating failure mode for attestation verification.
3. **Offline bundles require online-equivalent rigor.** The offline path must perform every check the online path does.

---

## 3. Cosign — Any Valid Rekor Entry Accepted (Regression)

### CVE-2026-22703 · GHSA-whqx-f9j3-ch6m
**Severity:** Moderate (CVSS 5.5)  
**Fixed in:** cosign v2.6.2, v3.0.4  
**Discovered by:** Hayden Blauzvern (@haydentherapper) / 1seal  
**Published:** 2026-01-09  
**Source:** https://github.com/sigstore/cosign/security/advisories/GHSA-whqx-f9j3-ch6m

### Description
**This is a regression of CVE-2022-36056 Vulnerability 1.** Recent refactoring in cosign re-introduced the bundle mismatch vulnerability. A crafted bundle could successfully verify even if the embedded Rekor entry **did not reference the artifact's digest, signature, or public key.**

The fix from GHSA-8gw7-4j42-w388 had been lost during code reorganization. Cosign would accept **any response from Rekor as valid** when using `--trusted-root` or TUF-fetched keys.

### Reproduction
```bash
cosign sign-blob --new-bundle-format=false --bundle bundle.1 blob
cosign sign-blob --new-bundle-format=false --bundle bundle.2 blob
jq ".rekorBundle |= $(jq .rekorBundle bundle.2)" bundle.1 > bundle.3
cosign verify-blob --bundle bundle.3 blob  # SUCCEEDS (incorrectly)
```

### Relevance to SCRUTINY Fabric
This demonstrates that **regression risk in attestation binding checks is real and recurring.** The core invariant — "the Rekor entry must prove inclusion of THIS specific signed artifact" — had to be fixed twice. In a protocol design, this invariant should be structurally enforced such that omitting the check makes the entire verification fail, rather than succeed.

---

## 4. Cosign — CA Certificate Validity Window Mismatch

### CVE-2026-24122 · GHSA-wfqv-66vq-46rm
**Severity:** Low (CVSS 3.7)  
**Fixed in:** cosign v3.0.5  
**Discovered by:** Hayden Blauzvern / 1seal  
**Published:** 2026-02-19  
**Source:** https://github.com/sigstore/cosign/security/advisories/GHSA-wfqv-66vq-46rm

### Description
When verifying signatures with a certificate chain, Cosign verifies the chain using only the leaf certificate's `notBefore` timestamp. The timestamp (from Rekor SET or TSA) is then checked **only against the leaf certificate** — not against intermediate or root CA certificates.

**Scenario:**
- Root CA valid: 12pm–2pm
- Intermediate CA valid: 12:30pm–1:30pm
- Leaf cert valid: 1pm–3pm
- Signature created at 2:30pm (with valid Rekor timestamp)

At 2:30pm, both root and intermediate CAs are expired. Yet Cosign used the leaf's `notBefore` (1pm) to verify the chain — at which point all certs appeared valid — and only checked the timestamp against the leaf. **Verification succeeded despite the chain being expired at signature time.**

### Relevance to SCRUTINY Fabric
A fundamental ordering/timestamp vulnerability: **every certificate in a chain must be checked for validity at the attested time.** Selecting the wrong anchor time for chain validation creates a window where expired/invalid certs appear valid. SCRUTINY's binding verification must apply timestamp checks recursively through the entire trust chain.

---

## 5. Cosign — Attestation Type Mismatch False Positive

### CVE-2022-35929 · GHSA-vjxv-45g9-9296
**Severity:** Moderate  
**Fixed in:** cosign v1.10.1  
**Discovered by:** Matt Moore (@mattmoor)  
**Published:** 2022-08-04  
**Source:** https://github.com/sigstore/cosign/security/advisories/GHSA-vjxv-45g9-9296

### Description
`cosign verify-attestation --type spdx` would report success if ANY attestation existed (e.g., a vuln attestation), even when NO attestation of the requested type was present. The predicate type check was simply skipped.

### Relevance to SCRUTINY Fabric
Attestation verification must validate **the predicate type, not just the existence of a valid signature.** This is a form of attestation substitution: presenting one kind of attestation (vuln scan) as proof of another (SBOM).

---

## 6. In-Toto — PGP Trust Model Gaps (Including Timestamp Validation)

### GHSA-jjgp-whrp-gq8m
**Severity:** Moderate  
**Affected versions:** in-toto ≤ 1.4.0  
**Published:** 2023-05-10  
**Audited by:** X41 D-Sec GmbH  
**Source:** https://github.com/in-toto/in-toto/security/advisories/GHSA-jjgp-whrp-gq8m

### Three findings aggregated into one advisory:

**PGP Key Creation Time Not Validated (severity: low)**
- in-toto does not check if the validity period of a PGP key (starting with key creation time) is in the future when copying from GnuPG to layout, or during verification.
- A validity period in the future usually indicates a wrong system clock, meaning it can't be trusted.
- A MITM attacker who manipulates software products **may also control system time via NTP manipulation.**
- In a scenario where an attacker gained control over two expired subkeys with non-overlapping validity periods, they could **set system time to before either key's validity period, making both keys appear valid.**

**PGP Key Revocation Not Considered (severity: medium)**
- in-toto does not check PGP revocation signatures. A revoked key would still be accepted.

**PGP Key Usage Flags Not Considered (severity: low)**
- Keys not permitted to sign data are accepted for signature verification.

### Reference Issues
- secure-systems-lab/securesystemslib#190: "Handle GPG revocation signatures"
- in-toto/in-toto#569: "inconsistent use of GnuPG"

### Relevance to SCRUTINY Fabric
**Direct timestamp-race relevance:** The finding that NTP manipulation can make expired keys appear valid is exactly the class of attack SCRUTINY must defend against. When the system clock is untrusted, timestamps from attestations cannot be relied upon — a trusted timestamping service or distributed consensus on time is needed.

---

## 7. In-Toto — Local Configuration Injection via `.in_totorc`

### CVE-2023-32076 · GHSA-wc64-c5rv-32pf
**Severity:** Moderate  
**Affected versions:** in-toto ≤ 1.4.0  
**Published:** 2023-05-10  
**Audited by:** X41 D-Sec GmbH  
**Source:** https://github.com/in-toto/in-toto/security/advisories/GHSA-wc64-c5rv-32pf

### Description
in-toto reads configuration from `.in_totorc` in the directory where it runs. If an attacker controls inputs to a supply chain step, they can **mask their activities by passing in an `.in_totorc` that includes exclude patterns and other settings.**

This bypasses artifact rule enforcement: files that should have been verified are excluded from the verification scope entirely via configuration injection.

### Fix
Support for `.in_totorc` was dropped. All options remain settable via API parameters or CLI arguments.

### Relevance to SCRUTINY Fabric
This is a form of **artifact rule bypass via configuration poisoning.** The ordering issue: the configuration is read at verification time from an attacker-controlled directory, after-the-fact altering what the previous links "should have" covered.

---

## 8. Rekor — Malformed In-Toto Entries Cause Server Panic

### CVE-2023-33199 · GHSA-frqx-jfcm-6jjr
**Severity:** Moderate (CVSS 5.3)  
**Fixed in:** Rekor v1.2.0  
**Discovered by:** OSS-Fuzz  
**Published:** 2023-05-26  
**Source:** https://github.com/sigstore/rekor/security/advisories/GHSA-frqx-jfcm-6jjr

### Description
A malformed proposed entry of type `intoto/v0.0.2` causes a panic on a thread within Rekor. The thread recovers and returns HTTP 500, so availability impact is minimal. However, this enables a **denial-of-service vector against the transparency log** via crafted in-toto attestation metadata.

### Relevance to SCRUTINY Fabric
Attestation parsing is an attack surface. Malformed attestation metadata at the transparency log level can disrupt availability even when cryptographic integrity is preserved.

---

## 9. Sigstore Threat Model — Rekor Timestamp Manipulation

**Source:** https://docs.sigstore.dev/about/threat-model/

### Formal Threat Model Analysis

The Sigstore threat model (ACM CCS 2022 paper: "Sigstore: Software Signing for Everybody") explicitly analyzes compromise scenarios involving Rekor's Signed Entry Timestamp (SET):

| Compromised Component | Timestamp Capability |
|---|---|
| **Rekor Server** | Can change the timestamp on Fulcio signatures to make them appear valid when used outside the certificate validity window. Can deny existence of valid signatures. |
| **Fulcio CT Log + Rekor Server** | Can replay certificates created earlier because Rekor won't report duplicate entries. |
| **Rekor Server + Monitor** | Historical entries can be altered; all previous timestamps become untrusted; may require re-signing all metadata. |

### Mitigation Required
The Sigstore threat model mandates:
1. Identity monitoring of the Fulcio CT log
2. Consistency monitoring of the append-only Merkle tree
3. Gossip protocol among multiple monitors
4. TUF root of trust for recovery

### Relevance to SCRUTINY Fabric
This is the most authoritative documentation of timestamp manipulation threats in an attestation protocol. The takeaway: **a compromised transparency log server can forge timestamps unless external consistency proofs are verified.** SCRUTINY Fabric likely needs multi-party timestamp consensus or cross-log verification.

---

## 10. Certificate Transparency — Maximum Merge Delay Exploit Surface

**Source:** https://certificate.transparency.dev/howctworks/  
**Specification:** RFC 6962, RFC 9162

### MMD as a Race Condition Enabler

The Certificate Transparency design includes a **Maximum Merge Delay (MMD)** — typically 24 hours — between when a log issues an SCT (Signed Certificate Timestamp) and when the certificate is actually incorporated into the Merkle tree.

This creates a fundamental race condition:
- **An SCT is a promise of future inclusion**, not proof of current inclusion.
- During the MMD window (up to 24h), the certificate has been promised inclusion but is not yet verifiably in the tree.
- An attacker who can block the actual merge could create certificates with valid SCTs that never appear in the log.
- Monitors cannot detect this until after the MMD elapses.

### Known Academic Research on CT Attacks

- **Dowling, Günther, Herath (2021):** "Secure logging schemes and Certificate Transparency" — European Symposium on Research in Computer Security. Analyzes CT security properties including MMD-based attacks.
- **Chuat et al. (2015):** "Efficient gossip protocols for verifying the consistency of Certificate Transparency logs" — Demonstrates that without widespread gossip among monitors, split-view (fork) attacks on CT logs remain possible.
- **Nordberg, Gillmor, Ritter (2014–2022):** Multiple RFC-level analyses of CT log misbehavior including SCT timestamp manipulation, log equivocation (showing different log states to different clients), and MMD-based denial of inclusion.

### MMD Exploit Pattern
1. Malicious CA issues a certificate and submits to CT log
2. CT log returns valid SCT (promise of inclusion)
3. Browser accepts certificate (has sufficient SCTs)
4. Malicious CA prevents actual log inclusion (DoS, collusion with log operator)
5. Certificate remains "valid" per browser policy during MMD window
6. Certificate holder exploits unverified certificate during the gap

### Relevance to SCRUTINY Fabric
The MMD gap is directly analogous to any protocol where attestation submission and attestation finality are temporally decoupled. SCRUTINY Fabric's binding mechanism needs to consider: **does a binding promise future inclusion, or does it require proven past inclusion?**

---

## 11. SLSA — Provenance Integrity Threats

**Source:** https://slsa.dev/spec/v1.0/threats

### Threats Relevant to Attestation Ordering

**Threat E: Compromise Build Process — Forge Provenance Values (Build L2+)**
- Generate false provenance and get the trusted control plane to sign it.
- Mitigation requires: Build L2+ where the trusted control plane generates all provenance information. At L3, hardened build platforms with isolated, ephemeral environments cryptographically bind the provenance to the build output.

**Threat C: Build from Modified Source**
- Adversary builds from a version that does not match the official source repo.
- Adversary fetches from repo, makes a local commit, requests build from that local commit.
- **Race condition:** The builder records source commit, but the code was modified post-checkout.
- Mitigation: Builder must pull directly from source repo and accurately record provenance.

**Replay Attacks Across Builds (Implicit Threat)**
- A valid provenance from one build could theoretically be presented for a different artifact if the digest binding is weak.
- SLSA addresses this through **subject digest binding:** provenance must include output artifact hashes.

### Relevance to SCRUTINY Fabric
The lesson from SLSA is that provenance must be **cryptographically bound to specific artifact digests at generation time**, and that any post-checkout modification window represents a race condition between "source state" and "build state."

---

## 12. Rekor — Canonicalization Gap in Entry Verification

**Source:** sigstore/rekor#1162  
**URL:** https://github.com/sigstore/rekor/issues/1162  
**Opened by:** Zachary Newman (@znewman01), 2022-11-02

### Description
Rekor signs the **byte representation of the entry as-provided by the client**, without any canonicalization step. Most Rekor entries are JSON, which has no canonical encoding. This leads to a critical verification fragility:

> *"One client might produce different JSON from another, which means that verifying is a pain."*

**Key excerpt:**
> "Right now, Rekor signs the representation of the Rekor entry as-provided. [...] The current implementation of the Bundle format relies on reconstructing the Rekor entry type in order to check the signature in the SignedEntryTimestamp."

### Implications
- Two semantically identical entries with different JSON whitespace/ordering produce different SET signatures.
- Verifiers must reconstruct the **exact byte representation** the original submitter used — requiring intimate knowledge of the submitting client's serialization behavior.
- The issue proposes moving to COSE or another canonicalization-friendly format, acknowledging this is a systemic design problem.

### Relevance to SCRUTINY Fabric
This is a direct lesson for decentralized attestation: **the transparency log must use deterministic, canonicalized representations for entries.** If different clients (or Nostr relays in the SCRUTINY case) serialize the same logical binding differently, verification becomes non-deterministic. SCRUTINY Fabric should define a canonical event format before any log-commitment mechanism is designed.

---

## 13. In-Toto Specification — Artifact Rule Processing Order

**Source:** https://github.com/in-toto/docs/blob/master/in-toto-spec.md (v1.0.0)

### Artifact Rule Matching Semantics

Per the in-toto specification (Section 4.3.3):

> Artifact rules operate on materials and products of steps. Rules MATCH patterns, DISALLOW patterns, and REQUIRE patterns against the artifacts recorded in link metadata.

The spec defines ordering semantics:
1. **MATCH rules** — material of one step matches product of another step
2. **DISALLOW rules** — specified patterns must not be present
3. **REQUIRE rules** — specified patterns must be present

### Implicit Race Condition
The artifact rule engine processes rules sequentially. If a functionary produces additional artifacts beyond what was declared, and a later step's MATCH rule inadvertently matches those undeclared artifacts, the chain appears valid while carrying unauthorized artifacts forward.

The spec itself acknowledges (Section 1.5.2):
> in-toto does not record or verify any accompanying artifact metadata such as file permissions and timestamps.

### Relevance to SCRUTINY Fabric
in-toto's artifact matching operates on filenames and hashes, not on temporal ordering guarantees. There is no mechanism to assert: "this artifact was produced BEFORE that artifact was consumed." SCRUTINY Fabric's attestation ordering model directly addresses this gap.

---

## Summary of Identified Failure Classes

| Failure Class | Real-World Example | CVEs / IDs |
|---|---|---|
| **Transparency log entry transplant** | Cosign bundle cross-signature copy | CVE-2022-23649 |
| **Bundle-to-artifact binding gap** | Cosign rekorBundle not checked against artifact | CVE-2022-36056 (V1) |
| **Binding check regression** | Same bug reintroduced after refactoring | CVE-2026-22703 |
| **Certificate chain timestamp mismatch** | Chain validated at leaf's notBefore, not signing time | CVE-2026-24122 |
| **Attestation type substitution** | Wrong predicate type silently accepted | CVE-2022-35929 |
| **Configuration injection bypassing artifact rules** | `.in_totorc` masking attacker activity | CVE-2023-32076 |
| **NTP/time manipulation for key validity** | System clock control making expired keys valid | GHSA-jjgp-whrp-gq8m |
| **Log server timestamp manipulation** | Sigstore threat model: Rekor can forge SETs | Sigstore TM Sec 5 |
| **MMD deferral / denial of inclusion** | CT: SCT issued, certificate never merged | RFC 9162 implicit |
| **Fork/split-view attacks on log** | CT: Different log states shown to different clients | Dowling et al. 2021 |
| **Provenance-to-digest binding gap** | SLSA: build from modified post-checkout code | SLSA Threat C |
| **Artifact rule processing order bypass** | in-toto: sequential rule evaluation gaps | in-toto Spec 4.3.3 |
| **Canonicalization-dependency verification gap** | Rekor: different JSON serializations produce different SETs | sigstore/rekor#1162 |

---

## Key Academic & Official References

- **ACM CCS 2022:** Newman, Z., Meyers, J.S., Torres-Arias, S. "Sigstore: Software Signing for Everybody." DOI: 10.1145/3548606.3560596 — The peer-reviewed paper defining Sigstore's security model, including formal analysis of Rekor SET and timestamp threats.
- **RFC 9162:** Laurie, B., Messeri, E., Stradling, R. "Certificate Transparency Version 2.0" (2021) — Defines MMD, SCT semantics, and log consistency proof requirements.
- **RFC 6962-bis:** Laurie, B., Langley, A., Kasper, E. "Certificate Transparency" — Original CT specification establishing append-only Merkle tree log semantics.
- **Dowling, Günther, Herath (ESORICS 2021):** "Secure logging schemes and Certificate Transparency" — Academic security analysis of CT including MMD-based and split-view attacks.
- **in-toto Specification v1.0.0:** https://github.com/in-toto/docs/blob/master/in-toto-spec.md — Formal specification documenting artifact rule processing order and functionary trust assumptions.
- **X41 D-Sec in-toto Audit Report (2023):** https://github.com/in-toto/in-toto/issues/569 — Professional source code audit identifying PGP trust model gaps, configuration injection vulnerabilities, and timestamp validation issues.
- **SLSA v1.0 Threats & Mitigations:** https://slsa.dev/spec/v1.0/threats — Comprehensive threat taxonomy including build process compromise and provenance forgery vectors.
- **Sigstore Research Page:** https://docs.sigstore.dev/about/research/ — Lists key academic work including binary transparency (Contour) and software supply chain security reading list.

---

## Design Implications for SCRUTINY Fabric

From these failures, the following invariants emerge as requirements for a decentralized attestation protocol:

1. **SET-to-artifact cryptographic binding must be mandatory and verified at every verification.** (Cosign CVE-2022-23649, CVE-2026-22703)

2. **Timestamp validation must propagate through the entire trust/certificate chain, not just the leaf.** (Cosign CVE-2026-24122)

3. **Error/default-to-success paths must be eliminated.** Every silent fallback resulted in a CVE. Verification must fail-closed.

4. **Time sources must be externally anchored.** NTP-dependent timestamping is insufficient against system-clock-manipulating attackers. (in-toto GHSA-jjgp-whrp-gq8m)

5. **Attestation submission and inclusion finality must be distinguished.** Inclusion-promises (like SCTs) are not inclusion-proofs. Binding verification must check actual log position, not just the promise.

6. **Attestation type/predicate must be part of the verified binding, not just the signature envelope.** (Cosign CVE-2022-35929)

7. **Multi-monitor consensus is necessary for fork detection** if the protocol relies on a single transparency log. (Sigstore threat model)

8. **Artifact ordering assertions** — "A preceded B in the supply chain" — require explicit temporal binding that existing protocols lack.

9. **Configuration integrity under attacker control.** Configuration must flow through the same signed attestation chain as artifacts. (in-toto CVE-2023-32076)

10. **Regression resistance.** Attestation binding checks should be architecturally guaranteed, not dependent on correct implementation of runtime checks. (Cosign regression between CVE-2022-36056 and CVE-2026-22703)

11. **Canonical entry representation is mandatory.** Transparency log entries must use a deterministic serialization format. JSON without canonicalization introduces non-deterministic verification where semantically identical entries produce different signatures across clients. (sigstore/rekor#1162)