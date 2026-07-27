# Key Compromise Recovery: Failure Mode Analysis Across Protocols

**Purpose:** Research report for SCRUTINY Fabric — analyzing existing protocol failure modes in key compromise recovery to inform design of a decentralized product attestation system.

**Date:** 2026-05-03

---

## Executive Summary

Every protocol that relies on cryptographic keys as the root of identity must address what happens when keys are compromised. This report examines seven distinct protocol ecosystems, cataloging their specific failure modes, mitigation strategies, and the fundamental tension between **immutability** (needed for audit trails) and **recoverability** (needed after compromise). The central finding is that **no existing protocol solves this tension cleanly** — each makes trade-offs that sacrifice either history continuity or security after compromise.

---

## 1. W3C DID Key Revocation Patterns

### 1.1 `did:key` — Non-Updatable by Design

The `did:key` method encodes the public key directly into the identifier itself using Multibase/Multicodec encoding [(W3C CCG, did-key-spec v0.9)](https://github.com/w3c-ccg/did-key-spec). It is "purely generative, requiring no look ups in a registry."

**Failure mode:** The spec explicitly states (Section "Operations > Update"):
> *"This DID Method does not support updating the DID Document."*

And (Section "Operations > Deactivate"):
> *"This DID Method does not support deactivating the DID Document."*

**Consequence for key compromise:** If the private key is leaked, there is zero recovery path. The entire identity is permanently compromised. The spec acknowledges this in privacy considerations:
> *"There is no mechanism to recover privacy after a correlation event or to refresh the identifier while maintaining continuity of the underlying digital identity."*

**Key limitation for SCRUTINY:** `did:key` represents one extreme — absolute immutability with no recovery. A product attestation system cannot use this model because products persist across key lifetimes.

### 1.2 `did:web` — Key Rotation via HTTPS, DNS-Dependent

`did:web` uses a web domain as the DID method-specific identifier, resolving the DID document from `https://<domain>/.well-known/did.json`. Updates are pushed by modifying the hosted document.

**Failure modes:**
- **DNS/HTTPS dependency:** The DID's security reduces to the security of the domain's DNS and TLS. Domain hijacking == DID hijacking.
- **Temporal gap in rotation:** Between the moment a key is revoked in the hosted DID document and when all verifiers have fetched the new version, forged attestations using the compromised key remain valid. There is no push mechanism for key revocation — it's poll-based.
- **No cryptographic history chain:** `did:web` does not maintain a verifiable log of past keys. An attacker who compromises the web server can retroactively modify the `alsoKnownAs` or `controller` field without leaving evidence (beyond standard HTTP access logs).
- **Version ambiguity:** While the DID Core spec defines `versionId` and `versionTime` parameters [(W3C DID Core, §3.2.1)](https://www.w3.org/TR/did-core/#did-parameters), `did:web` doesn't require versioned resolution, meaning verifiers may see different DID documents depending on when they resolve.

**Relevant spec section:** W3C DID Core §9.7 "Verification Method Rotation" and §9.8 "Verification Method Revocation" [(W3C Recommendation, 19 July 2022)](https://www.w3.org/TR/2022/REC-did-core-20220719/).

### 1.3 `did:ethr` — Smart Contract Gas Cost Issues

**Failure modes:**
- **Gas costs for revocation:** Every key rotation requires an Ethereum transaction. During periods of high network congestion, revocation transactions can be delayed or become economically prohibitive.
- **Transaction ordering:** Miners can reorder transactions. A malicious miner could delay a revocation transaction while front-running with a forged attestation using the compromised key.
- **Smart contract bugs:** The `did:ethr` registry contract becomes a single point of failure. Bugs in the contract (e.g., incorrect permission checks on `revokeAttribute`) can permanently lock out legitimate key rotation.

### 1.4 General DID Recovery (§9.9 of DID Core)

The DID Core spec acknowledges key recovery as an open problem:
> *"The DID method specification's recovery policy must be observed, which will provide clarity around how to perform key recovery for the DID method."*

This delegates the entire recovery question to individual method implementations, creating inconsistent security postures across the ecosystem.

---

## 2. Sigstore Keyless Signing — Ephemeral Keys Cannot Be Revoked

### 2.1 Architecture

Sigstore's "keyless" signing generates an ephemeral public/private keypair in-memory, obtains a short-lived X.509 certificate from Fulcio (valid for 10 minutes), signs the artifact, then **destroys the private key**. The signing event is logged in Rekor's transparency log [(Sigstore docs, "Signing Overview")](https://docs.sigstore.dev/cosign/signing/overview/).

### 2.2 CI/CD Environment Compromise

**Failure modes from Sigstore's own threat model** [(Sigstore Threat Model)](https://docs.sigstore.dev/threat-model/):

| Compromise | Attacker Capability | Impact |
|---|---|---|
| **OIDC Account** | Arbitrary software attack for whatever that account has access to | "Might be recoverable through mechanism set up by OIDC server" |
| **OIDC Server** | Arbitrary software attack for anything OIDC domain covers | Full compromise of all identities in that domain |

**Critical finding:** Sigstore explicitly acknowledges:
> *"OIDC account compromise is not handled by Sigstore, but we recommend that OIDC issuers provide revocation in the case of a compromised OIDC account."*

**The timeline problem:**
1. CI/CD pipeline gets compromised (e.g., GitHub Actions runner poisoned)
2. Attacker signs malicious artifacts with legitimate OIDC identity
3. Certificates are valid for 10 minutes — enough time to push to registries
4. Rekor entries are permanent — they cannot be deleted
5. Existing signatures cannot be invalidated since keys were destroyed
6. The only remediation is to revoke the Fulcio certificate chain via TUF root of trust — but this revokes ALL signatures made under that chain, not just the malicious ones

**Mitigation Sigstore recommends:**
> *"Identity and consistency monitoring is critical to mitigate risks... All signers should monitor the Fulcio CT log for unauthorized use of their identity."*

This is detection-only, not prevention.

### 2.3 Cosign Key Management — Rotating Without Invalidating

Cosign supports both keyless and long-lived key signing. For long-lived keys [(Cosign Key Management docs)](https://docs.sigstore.dev/cosign/key_management/overview/):

- Keys are stored locally or in KMS
- When rotating: old public keys must be distributed to verifiers
- There is no built-in mechanism for marking old signatures as "still valid despite key rotation"
- If a key is compromised, **all signatures ever made with that key become suspect** — there's no timestamp-anchored separation of "pre-compromise" vs "post-compromise" validity

**Relevant GitHub discussion:** Cosign issue tracker has multiple discussions on key rotation and signature validity windows (search: `sigstore/cosign` issues tagged `key-management`).

---

## 3. PGP Key Revocation Certificate Distribution Failures

### 3.1 CVE-2019-13050 — Certificate Spamming Attack

**NVD Summary:**
> *"Interaction between the sks-keyserver code through 1.2.0 of the SKS keyserver network, and GnuPG through 2.2.16, makes it risky to have a GnuPG keyserver configuration line referring to a host on the SKS keyserver network. Retrieving data from this network may cause a persistent denial of service, because of a Certificate Spamming Attack."* [(NVD, CVE-2019-13050)](https://nvd.nist.gov/vuln/detail/CVE-2019-13050)

**CVSS Score:** 7.5 HIGH (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)

### 3.2 Robert J. Hansen's Post-Incident Analysis

From the definitive gist ["SKS Keyserver Network Under Attack"](https://gist.github.com/rjhansen/67ab921ffb4084c865b3618d6955275f) by rjhansen (GnuPG FAQ maintainer, commit access to GnuPG git repo):

**Core design flaw:**
> *"In the early 1990s we made a quick decision that keyservers would never, ever, ever, delete information. Keyservers could add information to existing certificates but could never, ever, ever, delete either a certificate or information about a certificate."*

**The attack:**
> *"Unknown actors deployed a certificate spamming attack against two high-profile contributors in the OpenPGP community (Robert J. Hansen and Daniel Kahn Gillmor). This attack exploited a defect in the OpenPGP protocol itself in order to 'poison' rjh and dkg's OpenPGP certificates."*

**Impact on revocation:**
> *"These attestations — what we call certificate signatures — can be made by anyone for any purpose. And once made, they never go away. Ever. Even when a certificate signature gets revoked the original remains on the certificate: all that happens is a second signature is affixed saying 'don't trust the previous one I made'."*

**Consequences for key recovery:**
1. Poisoned certificates cannot be deleted from the keyserver network
2. If you fetch a poisoned certificate, you break your GnuPG installation
3. Any certificate may be poisoned at any time
4. Even downloading and re-importing a vendor's certificate is useless because GnuPG chokes on the spam

**The revocation distribution problem:**
> *"The confederated nature of the keyserver network makes changing the design goals even harder than it would normally be — and rest assured, it would normally be very hard!"*

Since the SKS network has no centralized authority, there is:
- No guaranteed propagation time for revocation certificates
- No way to force deletion of malicious signatures
- No universal "this key is revoked" broadcast mechanism
- Keyserver operators each independently decide whether to run updated software

### 3.3 GnuPG 2.2.17 Mitigation

From Werner Koch's announcement [(gnupg-announce, July 2019)](https://lists.gnupg.org/pipermail/gnupg-announce/2019q3/000439.html):
> *"gpg: Ignore all key-signatures received from keyservers. This change is required to mitigate a DoS due to keys flooded with faked key-signatures."*

This is a workaround, not a fix — it sacrifices the Web of Trust (the primary value proposition of PGP) to prevent denial of service.

**Hansen's final assessment:**
> *"At present I (speaking only for myself) do not believe the global keyserver network is salvageable. High-risk users should stop using the keyserver network immediately."*

---

## 4. Keybase Sigchain Irreversibility

### 4.1 Architecture

Keybase maps social media identities to encryption keys through publicly auditable proof statements posted on the respective platforms [(Keybase.io)](https://keybase.io). The sigchain is an append-only Merkle tree where each action (identity proof, device addition, key rotation) adds a new signed entry chaining to the previous one.

**Wikipedia summary:**
> *"Teams are largely administered by adding signatures to a chain. Each signature can add, remove, or change the membership of a user in a team... Each chain starts with a signature made by the team owner, with subsequent actions signed on by team admins or users. This ensures that every action is made by an authorized user, and that actions can be verified by anyone in possession of the public key used."* [(Wikipedia, "Keybase")](https://en.wikipedia.org/wiki/Keybase)

### 4.2 Account Compromise Aftermath

**Failure mode:**
- Once a proof is posted to the sigchain, it **cannot be removed** — only superseded by a newer entry
- If an attacker compromises a user's device key, they can post fraudulent proofs linking the victim's identity to attacker-controlled keys
- The victim can post a revocation, but **both the fraudulent proof and the revocation coexist forever** in the chain
- Verifiers must evaluate the full chain and determine which entry is "most recent and valid" — there is no universal consensus mechanism for resolving conflicting entries

### 4.3 Zoom Acquisition and Development Freeze

> *"On May 7, 2020, Keybase announced it had been acquired by Zoom... Since the acquisition, development has stopped, but the service has been kept functional."* [(Wikipedia)](https://en.wikipedia.org/wiki/Keybase)

This means the sigchain design's known limitations will never be addressed.

**Relevance to SCRUTINY:** The sigchain model is exactly what append-only attestation faces: you can't delete bad entries, only append corrections. The difference is Keybase has no notion of temporal validity windows — a proof is either present in the chain or not.

---

## 5. TUF Root Key Compromise and Rotation

### 5.1 Multi-Root Key Rotation Architecture

TUF specifies a threshold-based root role with offline keys [(TUF Specification v1.0.34)](https://github.com/theupdateframework/specification/blob/master/tuf-spec.md):

> *"If less than a threshold of Root keys are compromised, the repository should revoke trust on the compromised keys. This can be accomplished with a normal rotation of root keys."*

**The critical warning:**
> *"If a threshold of root keys is compromised, the Root keys should be updated out-of-band, however, the threshold should be chosen so that this is extremely unlikely. In the unfortunate event that a threshold of keys are compromised, it is safest to assume that attackers have installed malware and taken over affected machines. For this reason, making it difficult for attackers to compromise all of the offline keys is important because safely recovering from it is nearly impossible."*

### 5.2 TAP 5 — Multi-Root URL Specification

**Status:** Rejected [(TAP 5, 20-Jul-2020)](https://github.com/theupdateframework/taps/blob/master/tap5.md)

TAP 5 proposed allowing each top-level role to specify its own URL, enabling:
1. Restricting trust in a community repository to a single project
2. Using mirrors only for snapshot and targets metadata

**Why rejected:** The proposal introduced complexity around URL management and didn't sufficiently address the trust bootstrap problem. If the `root.json` URLs are themselves compromised, clients have no way to discover correct URLs.

**Failure mode specific to multi-root:**
- If root keys are distributed across multiple URLs (as proposed), a compromise of ANY single URL server could feed stale root metadata to clients
- The TUF freshness mechanism (timestamp role) partially mitigates this but only if the timestamp role's URL is independently trusted
- If both root and timestamp URLs are the same server, compromise of that server defeats both protections

### 5.3 Threshold Bypass Scenarios

**Scenario:** Consider a (3-of-5) threshold for root key signatures. An attacker who compromises:
- 2 root key holders: cannot rotate root keys unilaterally, but can veto legitimate rotations (denial of service)
- 3 root key holders: can perform arbitrary root key rotation, effectively taking over the repository

**Mitigation from TUF security docs** [(TUF Security)](https://theupdateframework.io/security/):
> *"Fast and secure key replacement and revocation. Minimal trust placed in keys that are at high risk. Keys that are kept online or used in an automated fashion should not pose an immediate risk to clients if compromised. Multiple key usage and a threshold/quorum of signatures."*

### 5.4 Sigstore's Use of TUF

Sigstore uses TUF for distributing Fulcio root CA certificates and Rekor public keys. From the threat model:
> *"TUF root of trust provides strong revocation abilities for all services managed by Sigstore. To recover, the TUF root of trust for Fulcio needs to be invoked to revoke trust in the compromised Fulcio CA server."*

However, Sigstore also notes:
> *"If you had Fulcio's signing key, you wouldn't need to additionally hack Fulcio to make false claims."*

---

## 6. Cosign Key Management — Rotation Without Invalidation

### 6.1 Key Rotation Mechanics

Cosign's key management [(Cosign Key Management)](https://docs.sigstore.dev/cosign/key_management/overview/) supports importing existing key pairs and managing them via:
- Local filesystem
- Cloud KMS (AWS, GCP, Azure)
- Hardware tokens / PKCS#11
- Kubernetes secrets

### 6.2 The Fundamental Problem

When you rotate a Cosign signing key:
1. You generate a new key pair
2. You start signing NEW artifacts with the new key
3. EXISTING signatures remain valid against the old public key

**The problem:** There is no cryptographic binding between the old and new key that allows a verifier to automatically trust the new key if they already trusted the old one. Each verifier must independently receive and trust the new public key.

### 6.3 Compromise Scenario

If a Cosign signing key is compromised:
- All signatures ever made with that key are valid — including forgeries made by the attacker using the compromised key
- There is NO WAY to distinguish pre-compromise legitimate signatures from post-compromise malicious ones (without external timestamping)
- The only remediation is to revoke the key entirely — but this also invalidates all legitimate historical signatures
- Verifiers must be told out-of-band to stop trusting the old key

**Relevant observation from Sigstore threat model:**
> *"A signature verifier must check that an artifact has been uploaded to Rekor and the certificate has been published to Fulcio's log before trusting the artifact. This ensures that the artifact and certificate are publicly auditable."*

This is the rationale for why Cosign moved toward keyless signing — to avoid the key management problem entirely. But keyless signing introduces the CI/CD compromise problem described in Section 2.

---

## 7. Certificate Transparency Log Inclusion — Retroactive Handling of CA Key Compromise

### 7.1 DigiNotar — The Canonical Case Study

> *"The company was hacked in June 2011 and it issued hundreds of fraudulent certificates, some of which were used for man-in-the-middle attacks on Iranian Gmail users."* [(Wikipedia, "DigiNotar")](https://en.wikipedia.org/wiki/DigiNotar)

**Timeline:**
- **19 June 2011:** DigiNotar first detected an incident on their systems [(Fox-IT Interim Report, v1.0)](http://www.rijksoverheid.nl/bestanden/documenten-en-publicaties/rapporten/2011/09/05/diginotar-public-report-version-1/rapport-fox-it-operation-black-tulip-v1-0.pdf)
- **10 July 2011:** First fraudulent wildcard certificate for `*.google.com` issued
- **28 August 2011:** Certificate problems observed on ISPs in Iran
- **29 August 2011:** Google Chrome detected the fraudulent certificate via certificate pinning
- **Early September 2011:** All major browsers blacklisted DigiNotar root certificates
- **20 September 2011:** DigiNotar declared bankrupt

**Scale:**
> *"The final known total of misissued certificates is at least 531."* [(Gervase Markham, Mozilla)](http://blog.gerv.net/2011/09/updated-diginotar-cn-list/)

**The Fox-IT investigation** concluded that ~300,000 Iranian Gmail users were the primary targets of the resulting MITM attacks [(Computerworld, 2011-09-06)](http://www.computerworld.com/s/article/9219731/Hackers_spied_on_300_000_Iranians_using_fake_Google_certificate).

### 7.2 What Went Wrong for Recovery

1. **Detection lag:** The compromise was active for over 2 months before public discovery
2. **No proactive transparency:** Certificate Transparency was not yet deployed — there was no public log to audit
3. **All-or-nothing revocation:** Removing the DigiNotar root from browser trust stores broke legitimate certificates too, including Dutch government services (DigiD, RDW)
4. **Cross-contamination:** The "Staat der Nederlanden" intermediate under DigiNotar was initially exempted from the distrust, then later found to be compromised too and also revoked — disrupting critical government identity infrastructure
5. **The Comodohacker connection:** The same attacker claimed responsibility for multiple CA breaches [(PC World Australia, 2011-09-06)](http://www.pcworld.idg.com.au/article/399812/comodo_hacker_claims_credit_diginotar_attack/), revealing a systemic vulnerability in the CA model

### 7.3 How Certificate Transparency Would Help (Post-Hoc)

If CT had been deployed in 2011:
- Misissued certificates would appear in public logs
- Domain owners could monitor logs for unauthorized certificates for their domains
- Detection would potentially happen in hours instead of months

**But CT does not solve retroactive recovery:**
- Already-misissued certificates remain in the log forever
- The only remedy is still browser-level root distrust
- Legitimate certificates from the same CA are collateral damage

### 7.4 Lessons for SCRUTINY

The DigiNotar case demonstrates that when the root of trust is centralized in a single CA:
- **Detection is slow** (months)
- **Response is destructive** (bankruptcy-level consequences)
- **Recovery is all-or-nothing** (legitimate and illegitimate certs both invalidated)
- **Collateral damage is massive** (government services disrupted)

Transparency logs (CT, Rekor) improve detection speed but don't fundamentally change the recovery model — they only make the evidence of compromise public.

---

## Comparative Analysis Matrix

| Protocol | Key Rotation Support | History Preservation After Rotation | Revocation Propagation | Recovery After Full Compromise |
|---|---|---|---|---|
| `did:key` | **None** — identity == key | N/A (identity dies with key) | None needed (but no recovery) | Create new identity |
| `did:web` | Yes (HTTPS update) | No verifiable history chain | Poll-based, non-guaranteed | Replace DID document |
| `did:ethr` | Yes (smart contract) | On-chain history preserved | Blockchain-guaranteed | Replace keys on-chain (gas cost) |
| PGP SKS | Add-only (can't delete) | Old signatures remain forever | Best-effort gossip, no guarantee | **Cannot recover** — network is "unsalvageable" |
| Keybase Sigchain | Append-only | Old entries permanent | Client-synced verification | Add revocation (coexists with fraud) |
| TUF | Threshold-based rotation | Versioned metadata chain | Timestamp role enforces freshness | Out-of-band if threshold breached |
| Sigstore/Cosign (keyless) | Ephemeral (per-signature) | Rekor log is permanent | TUF root trust distribution | Revoke Fulcio CA chain |
| DigiNotar/CA model | N/A (centralized) | None | CRL/OCSP (optional) | Browser root removal (total destruction) |

---

## Key Insights for SCRUTINY Fabric Design

### 1. The Immutability-Recovery Tension

Every analyzed system faces the same fundamental choice:
- **Immutable history** (PGP, Keybase, Rekor, CT): You cannot delete past entries, so you can always audit what happened — but you also cannot remove fraudulent entries created with compromised keys
- **Mutable identity** (did:web, TUF): You can change current trust anchors, but you lose the ability to cryptographically prove what state existed at any given past moment

SCRUTINY Fabric must explicitly choose its position on this spectrum, or develop a novel mechanism that provides both.

### 2. Temporal Key Validity Windows Are Critical

The most glaring gap across ALL reviewed protocols is the inability to distinguish **"this key was valid when the signature was made"** from **"this key is currently valid."** Solutions:

- TUF's versioned `root.json` with timestamps comes closest
- Sigstore's Rekor entries include timestamps, but they're not bound to key validity windows
- Cosign has no built-in temporal validity concept at all

**Design recommendation:** SCRUTINY attestations should include a mandatory timestamp AND a reference to a verifiably-timestamped key validity record. A signature should be evaluated as: `valid(signature, key_state_at(timestamp))`, not `valid(signature, current_key_state)`.

### 3. The Distributed Revocation Propagation Problem

PGP's SKS network failure teaches us that revocation MUST NOT rely on best-effort gossip. TUF's approach (signed timestamp metadata with mandatory freshness checks) provides a more reliable model, but depends on the timestamp server being available.

**Design recommendation:** SCRUTINY should anchor key state transitions in Nostr relay events with well-defined retention and propagation semantics. Unlike PGP's SKS, Nostr relays can be queried for specific event kinds, providing targeted rather than bulk synchronization.

### 4. The Root Key Compromise Catastrophe

TUF's warning about threshold root compromise — "safely recovering from it is nearly impossible" — applies to any system with a centralized or quorum-based root. The DigiNotar case proves this at real-world scale.

**Design recommendation:** Consider a **forward-secrecy model for attestations** where:
- Products can be bound to rotating subkeys
- Subkeys are signed by a master key
- Master key compromise enables rotation of subkeys but does NOT invalidate historical attestations made under uncompromised subkeys
- The temporal binding from point 2 above enables verifiers to check "was subkey X valid at the time this attestation was made?"

### 5. What Sigstore Got Right (and Wrong)

**Right:** The separation of signing keys (ephemeral) from identity (OIDC) means key compromise is contained to a short window. The transparency log provides tamper-evident audit.

**Wrong:** The reliance on OIDC identity providers creates a transitive trust problem — compromising GitHub Actions is equivalent to compromising the signing identity. The 10-minute certificate window is an arbitrary limit, not a cryptographic guarantee.

### 6. The SCRUTINY-Specific Question

For a decentralized product attestation protocol:
- **Products have long lifetimes** (years to decades) — cannot use ephemeral keys
- **Attestations must survive key rotation** — a firmware measurement from 2023 should remain verifiable after the vendor rotates keys in 2026
- **The revocation problem is asymmetric** — vendors want to control their own keys; consumers want assurance that old attestations aren't retroactively invalidated
- **Nostr provides better revocation propagation than PGP's SKS** — relay subscriptions with event-type filters enable targeted delivery of key state updates

---

## Source References

1. W3C DID Core v1.0 (REC 2022-07-19): https://www.w3.org/TR/did-core/
2. W3C CCG did:key Method v0.9: https://github.com/w3c-ccg/did-key-spec
3. CVE-2019-13050 (NVD): https://nvd.nist.gov/vuln/detail/CVE-2019-13050
4. Hansen, R.J. "SKS Keyserver Network Under Attack" (2019-06-30): https://gist.github.com/rjhansen/67ab921ffb4084c865b3618d6955275f
5. Koch, W. "GnuPG 2.2.17 released to mitigate attacks on keyservers" (2019-07-09): https://lists.gnupg.org/pipermail/gnupg-announce/2019q3/000439.html
6. Sigstore Threat Model: https://docs.sigstore.dev/threat-model/
7. Sigstore Cosign Signing Overview: https://docs.sigstore.dev/cosign/signing/overview/
8. Sigstore Cosign Key Management: https://docs.sigstore.dev/cosign/key_management/overview/
9. TUF Specification v1.0.34: https://github.com/theupdateframework/specification/blob/master/tuf-spec.md
10. TUF Security Principles: https://theupdateframework.io/security/
11. TAP 5 (Rejected): https://github.com/theupdateframework/taps/blob/master/tap5.md
12. Keizer, G. "Hackers spied on 300,000 Iranians using fake Google certificate" Computerworld (2011-09-06): http://www.computerworld.com/s/article/9219731/
13. Fox-IT "Operation Black Tulip" Interim Report v1.0 (2011-09-05): http://www.rijksoverheid.nl/bestanden/documenten-en-publicaties/rapporten/2011/09/05/diginotar-public-report-version-1/rapport-fox-it-operation-black-tulip-v1-0.pdf
14. Wikipedia, "DigiNotar": https://en.wikipedia.org/wiki/DigiNotar
15. Wikipedia, "Keybase": https://en.wikipedia.org/wiki/Keybase
16. Google Online Security Blog, "An update on attempted man-in-the-middle attacks" (2011-08-29): https://security.googleblog.com/2011/08/update-on-attempted-man-in-middle.html
17. Mozilla Security Blog, "Fraudulent *.google.com Certificate" (2011-08-29): https://blog.mozilla.org/security/2011/08/29/fraudulent-google-com-certificate/
18. Markham, G. "Updated DigiNotar CN List" (2011-09-04): http://blog.gerv.net/2011/09/updated-diginotar-cn-list/
19. PC World Australia, "Comodo hacker claims credit for DigiNotar attack" (2011-09-06): http://www.pcworld.idg.com.au/article/399812/comodo_hacker_claims_credit_diginotar_attack/
20. Ars Technica, "Comodo hacker: I hacked DigiNotar too; other CAs breached" (2011-09-06): https://arstechnica.com/security/news/2011/09/comodo-hacker-i-hacked-diginotar-too-other-cas-breached.ars
21. Slate, "How a 2011 Hack You've Never Heard of Changed the Internet's Infrastructure" (2016-12-21): https://slate.com/technology/2016/12/how-the-2011-hack-of-diginotar-changed-the-internets-infrastructure.html
22. van der Meulen, N. "DigiNotar: Dissecting the First Dutch Digital Disaster" Journal of Strategic Security 6(2):46-58 (2013): https://doi.org/10.5038/1944-0472.6.2.4