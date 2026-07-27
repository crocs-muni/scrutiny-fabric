# Execution Plan: SCRUTINY Fabric v0.5.1 Threat Model

## Decisions locked

| # | Decision | Choice |
|---|---|---|
| D1 | Opus reuse | Adapt & normalize — extract mechanical insight, rewrite in consistent voice |
| D2 | Threat ID scheme | 2-letter category prefixes — DI, ID, AV, DC, CE, SV, EC, PI — with taxonomy table at §6 head |
| D3 | Coverage scope | Path B — ~34 threats, only where SCRUTINY architecture changes outcome or creates surface |
| D4 | TVRA formality | Hybrid — asset inventory (§3b), adversary tables (§4), risk methodology (§5) use TVRA elements; threat prose stays narrative |
| D5 | New threat placement | Integrate into categories (§6.1–6.8). No separate §6.9 |
| D6 | Version delta | None. Pure standalone for v0.5.1. Zero backward references |
| D7 | Obsolete threats | Excluded silently. Dead mechanics don't appear. Living concepts rewritten fresh |
| — | Per-threat format | B5+ — 3-row header (Adversary, Assets, Spec) + numbered 1-4 prose sections |

## Document structure (11 sections, target ~990 lines)

```
§1  Scope                      40L   System boundary, in/out scope, protocol version
§2  Security goals             25L   Property→Description table (7 properties)
§3  Trust model                50L   Derived from spec §2.1 — three actor types, assumptions
§3b Asset inventory            35L   13-row table: C/I/A/Au/NR flags per protocol-layer asset
§4  Adversary archetypes       60L   11 archetype capability tables (cannot-do column)
§5  Risk methodology           30L   Impact × Likelihood, four-level scale defined
§6  Threats                   610L   34 threats across 8 categories
    §6.1 Data integrity         6 threats
    §6.2 Identity               5 threats
    §6.3 Availability           5 threats
    §6.4 Discovery              4 threats
    §6.5 Censorship             3 threats
    §6.6 Surveillance           3 threats
    §6.7 Ecosystem              4 threats
    §6.8 Protocol interactions  4 threats
§7  Residual risks             50L   Structural limitations, trade-offs, excluded concerns
§8  Boundary matrix            30L   Protocol-vs-ecosystem responsibility table
§9  Summary table              40L   ID→Name→Problem→Mitigation→Gap→Risk, cross-ref to §6
§10 Recommendation matrix      15L   Placeholder for Cybernetica population
§11 Sources                    15L   Protocol spec + 7 NIPs + external references
```

## Complete threat taxonomy

### Category table (placed at §6 head)

| Prefix | Category | Count | Focus |
|---|---|---|---|
| DI | Data Integrity | 6 | Content, diffs, chains, attribution |
| ID | Identity | 5 | Pubkeys, trust, impersonation |
| AV | Availability | 5 | Spam, exhaustion, artifacts |
| DC | Discovery | 4 | Relay capability gaps, identifier findability |
| CE | Censorship | 3 | Suppression, eclipse, coercion |
| SV | Surveillance | 3 | Query privacy, host tracking |
| EC | Ecosystem | 4 | Adoption-scale risks |
| PI | Protocol Interactions | 4 | Cross-mechanism semantic tensions |

### §6.1 Data Integrity (T-DI-01 through T-DI-06)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-DI-01 | Timestamp manipulation via forged created_at | Compromised publisher | §7.2, §3.1 OTS |
| T-DI-02 | Fork resolution determinism | Compromised publisher | §7.2, §7.5 |
| T-DI-03 | Retraction propagation gaps | Malicious relay operator | §10, §7.5 cascade |
| T-DI-04 | Binding relationship ambiguity | Occasionally-lying publisher | §4.3, §9.4 relationship prefix |
| T-DI-05 | Cherry-pick attribution laundering | Compromised publisher | §7.4 |
| T-DI-06 | Attached content integrity (diff + artifact verification being client-side SHOULD) | Malicious relay operator, Network-level attacker | §5.2 lookup, §9.2 imeta, Blossom split-world |

### §6.2 Identity (T-ID-01 through T-ID-05)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-ID-01 | Key compromise — no Nostr revocation | Compromised publisher | §2.1 trust model |
| T-ID-02 | Sybil amplification through WoT expansion | Spam/DoS attacker | §2.1, §6.1, §6.3–6.4 |
| T-ID-03 | Canonical identifier squatting | Product impostor | §9.4, §9.3 discipline |
| T-ID-04 | Unverifiable identity claims (fake vendor + product impostor) | Product impostor, Hostile vendor | §2.1, §6.1 |
| T-ID-05 | Author hint forgery on e tags | Compromised publisher | §4.3 e tag semantics |

### §6.3 Availability (T-AV-01 through T-AV-05)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-AV-01 | Spam and graph pollution | Spam/DoS attacker | §3.1 PoW (MAY), §8.0 relays |
| T-AV-02 | Graph traversal amplification | Spam/DoS attacker | §6.4 binding traversal, §7.5 chain computation |
| T-AV-03 | Event size exceeding relay limits | Hostile vendor | §9.2 imeta recommendation |
| T-AV-04 | Artifact hosting fragility (URL rot + takedown + split-world) | Hostile vendor, Malicious relay | §9.2, §5.2 attached diffs |
| T-AV-05 | Prose-only patch abuse | Compromised publisher | §4.4 prose-only definition |

### §6.4 Discovery (T-DC-01 through T-DC-04)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-DC-01 | Inconsistent relay NIP support | Malicious relay operator | §8.0 fallback table, §8.3 |
| T-DC-02 | WoT bootstrap trap | N/A (structural) | §6.1, §2.1 Sybil section |
| T-DC-03 | Identifier mirror infidelity (omission + fabrication in patch i tags vs diff content) | Occasionally-lying publisher, Compromised publisher | §4.4.1 mirroring, §8.3 |
| T-DC-04 | Patch-to-root resolution gap | N/A (design assumption) | §8.3 client resolution MUST, §4.4.1 |

### §6.5 Censorship (T-CE-01 through T-CE-03)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-CE-01 | Relay-level event suppression | Malicious relay operator | §2.1 honest-but-curious, §8.0 multi-relay |
| T-CE-02 | Eclipse attack on relay set | Network-level attacker | §2.1, §8.0 ≥3 relays |
| T-CE-03 | Economic/legal relay coercion | Hostile vendor | §2.1 censorship paragraph |

### §6.6 Surveillance (T-SV-01 through T-SV-03)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-SV-01 | Plaintext REQ filter leakage | Malicious relay operator | NIP-01 (inherited), §2.1 honest-but-curious |
| T-SV-02 | Organizational query pattern exposure | Malicious relay operator | §8 discovery patterns |
| T-SV-03 | Artifact host tracking via imeta fetches | Hostile vendor | §9.2 imeta + Blossom |

### §6.7 Ecosystem (T-EC-01 through T-EC-04)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-EC-01 | Indexer re-centralization | N/A (adoption pressure) | §7.5 canonical view cost |
| T-EC-02 | Default trust list compromise | Compromised developer, scrutiny.cloud impostor | §6.1, §2.1 bootstrap |
| T-EC-03 | kind:1 namespace coupling with relay policy | Malicious relay operator | §3 all-events-kind-1 design choice |
| T-EC-04 | AI-generated false metadata at scale | Misbehaving LLM | §2 principle 4 (AI does interpretation) |

### §6.8 Protocol Interactions (T-PI-01 through T-PI-04)

| ID | Threat | Adversary | Key spec refs |
|---|---|---|---|
| T-PI-01 | Legal pressure vectors (DMCA, trade secret, CFAA) | Hostile vendor | §2.1 censorship paragraph |
| T-PI-02 | NIP-09 semantic tension (deletion vs audit trail preservation) | Compromised publisher | §10, §7.3 orphaned disputes |
| T-PI-03 | Cryptographic agility gap (secp256k1+SHA-256 hardcoded) | N/A (future-state) | §3.1 NIP dependencies |
| T-PI-04 | Snapshot pin staleness (root:rev/link:rev pinned to retracted patch) | N/A (mechanic interaction) | §4.3 snapshot tags, §10 cascade, §7.3 orphaned |

## Per-threat format (applied uniformly to all 34 entries)

```markdown
#### T-XX-NN — Threat name

| Adversary | [archetype(s) from §4, or "N/A (structural)" if no attacker required] |
| Assets    | [asset names from §3b inventory] |
| Spec      | [section references — §X.Y, §A.B–C] |

**1. Problem.** [3-5 sentences: what goes wrong, how mechanically, which adversary triggers it. No filler.]

**2. Mitigation.** [3-5 sentences: what the protocol provides. MUST/SHOULD/MAY distinguished. Gated defenses (OTS=MAY, PoW=MAY) called out explicitly. Specific spec sections named.]

**3. Gap.** [2-4 sentences: what remains unsolved and WHY — structural consequence of design choice X, inherited Nostr limitation Y, ecosystem maturity requirement Z. Never "just unsolved."]

**4. Residual risk: Rating.** [2-3 sentence rationale tied to mitigation/gap above. Rating = Critical / High / Medium / Low, with range (Low–High) where implementation-dependent.]
```

Target: 18-22 lines per threat including header. Longer for compound threats (Sybil, censorship), shorter for inherited Nostr concerns (surveillance queries). No threat shorter than 12 lines; none longer than 28.

## Write order (sequential, single file)

### Phase 1 — Preamble
Write §§1, 2, 3, 3b, 4, 5 in sequence.
- §3 derives vocabulary from spec §2.1 trust model rather than inventing parallel terminology
- §3b asset inventory uses exact spec terminology (canonical view, not "Effective View")
- §4 adversary archetypes re-verify every "can do"/"cannot do" against v0.5.1 mechanics

### Phase 2 — Core threats
Write §6.1 through §6.8 sequentially.
For each subsection:
1. Write all threats in that category fresh against spec
2. Before writing T-ID-02 (Sybil): check Opus's surviving entry for mechanical insights → adopt insight, discard wording, rewrite in plan voice
3. Before writing any DC threat: ensure §8.0 fallback strategy is cross-referenced
4. After completing each category: scan for orphaned cross-references and resolve

### Phase 3 — Wrap-up
Write §§7, 8, 9, 10, 11.
- §7 Residual risks consolidates excluded threats
- §9 summary table constructed by extracting one-line condensation from each §6 entry
- §10 placeholder populated with empty table + contextual note for Cybernetica
- §11 sources: protocol-spec.md + 7 NIP URLs

### Phase 4 — Verification pass
Read full document end-to-end. Check:
1. Every spec cross-reference resolves to an actual section
2. Every adversary archetype named in §6 exists in §4
3. Every asset named in §6 headers exists in §3b
4. All 6 new v0.5.1-specific threats are covered
5. No instance of stale terminology
6. Every MUST/SHOULD/MAY claim matches current spec verbatim

## Opus salvage procedure

For each surviving Opus threat:
1. Read Opus's entry, extract the core mechanical observation
2. Discard: all Opus wording, all mixed-prefix IDs, all v0.4 comparisons, any `#q` reference, any "Effective View" term
3. Cross-check mechanical claim against current spec text
4. Rewrite in plan format (header + 1-4 numbered prose) with consistent depth
5. Map old Opus ID to new plan ID

## Exclusion register

Items intentionally absent from the threat model:

| Item | Disposition | Reason |
|---|---|---|
| Schnorr signature forgery | Excluded entirely | Mathematically impossible |
| SHA-256 collision | Excluded entirely | Astronomically negligible |
| Secp256k1 nonce reuse | Excluded entirely | Key hygiene, not protocol |
| TLS relay downgrade | Excluded entirely | Transport layer |
| Canonical view determinism across implementations | §7 Residual Risks | Specification precision issue; resolved by test vectors |
| Line ending / encoding normalization edge cases | §7 Residual Risks | Implementation correctness testing |
| Compromised developer supply chain | §7 Residual Risks | Universal software risk |
| Relay TLS certificate validation | Excluded | NIP-01 transport |
| DNS poisoning of relay URLs | Excluded | Infrastructure, not protocol |

## Delivery checklist

- [ ] File at `docs/SCRUTINY_threat_model_v0_5_1.md`
- [ ] 34 threats across 8 categories, all using T-XX-NN prefix scheme
- [ ] Category taxonomy table at §6 head mapping each prefix to category name
- [ ] All 6 new v0.5.1-specific threats present
- [ ] Zero stale terminology
- [ ] Every spec cross-reference resolves to correct section
- [ ] §3 aligns with spec §2.1 vocabulary
- [ ] §6.4 threats reference spec §8.0 fallback strategies
- [ ] Risk ratings defensible
- [ ] §10 recommendation matrix is placeholder
- [ ] Target length ~950-1050 lines