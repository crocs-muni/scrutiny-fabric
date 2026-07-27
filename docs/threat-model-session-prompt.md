# Session Prompt: Write SCRUTINY Fabric v0.5.1 Threat Model

## What you are doing

Produce a complete, production-grade threat model for SCRUTINY Fabric protocol v0.5.1. Output to `docs/SCRUTINY_threat_model_v0_5_1.md`.

This document will be sent to CYBERNETICA AS (Estonian security consultancy, X-Road authors, ETSI TS 102 165-1 co-authors) for professional review. They are auditing your work — not writing it.

## Before you write anything

Read these files thoroughly:

1. `docs/protocol-spec.md` — The v0.5.1 specification. Your sole source of truth. Read every section.
2. `docs/SCRUTINY_threat_model_v2_1.md` — The v0.4 threat model. Use ONLY for depth calibration and structural inspiration. Everything in it assumes different protocol mechanics. Do not copy-paste.
3. `docs/SCRUTINY_threat_model_v0_5_1.md` — A partial Opus output (~338 lines). It contains good analysis for some threats in §§6.2–6.6. Extract mechanical insights from it; discard all wording, numbering, and formatting. Rewrite everything in your voice using the format specified below. Do NOT carry forward its mixed T<n>/T-XX-NN numbering or its variable-depth prose style.

## Format rules

### Document sections (11 total)

```
§1  Scope                      40L
§2  Security goals             25L   Property→Description table (7 properties)
§3  Trust model                50L   Derived from spec §2.1 vocabulary; do not invent parallel terms
§3b Asset inventory            35L   13-row table with C/I/A/Au/NR columns
§4  Adversary archetypes       60L   11 capability tables with "cannot do" column
§5  Risk methodology           30L   Impact×Likelihood, four-level scale defined
§6  Threats                   610L   34 threats across 8 categories (see taxonomy below)
§7  Residual risks             50L   Structural limitations, trade-offs, excluded concerns
§8  Boundary matrix            30L   Protocol-vs-ecosystem responsibility table
§9  Summary table              40L   ID→Name→Problem→Mitigation→Gap→Risk (cross-ref §6)
§10 Recommendation matrix      15L   Placeholder table for Cybernetica population
§11 Sources                    15L   Protocol spec + 7 NIPs + external references
```

Target length: ~950-1050 lines total.

### Per-threat entry format (use for ALL 34 threats)

```markdown
#### T-XX-NN — Threat name

| Adversary | [archetype(s) from §4, or "N/A (structural)" if no attacker required] |
| Assets    | [asset names from §3b inventory, comma-separated] |
| Spec      | [section references — §X.Y, §A.B–C] |

**1. Problem.** [3-5 sentences. What goes wrong. How mechanically. Which adversary triggers it. No filler.]

**2. Mitigation.** [3-5 sentences. What the protocol provides. MUST/SHOULD/MAY distinguished explicitly. Gated defenses (OTS=MAY, PoW=MAY) called out. Specific spec sections named.]

**3. Gap.** [2-4 sentences. What remains unsolved and WHY. Must be one of: structural consequence of design choice X, inherited Nostr limitation Y, ecosystem maturity requirement Z. Never say "just unsolved."]

**4. Residual risk: Rating.** [2-3 sentence rationale. Rating = Critical / High / Medium / Low. Use range (Low–High) where implementation-dependent.]
```

18-22 lines per threat including header. Longer for compound threats; shorter for inherited Nostr concerns. Range: 12-28 lines.

### Threat ID scheme

Use 2-letter category prefixes throughout: DI, ID, AV, DC, CE, SV, EC, PI.

At the top of §6, before any subsection, insert this table:

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

## Complete threat taxonomy (34 threats)

### §6.1 Data Integrity

| ID | Threat | Key spec refs |
|---|---|---|
| T-DI-01 | Timestamp manipulation via forged created_at | §7.2, §3.1 OTS |
| T-DI-02 | Fork resolution determinism | §7.2, §7.5 |
| T-DI-03 | Retraction propagation gaps | §10, §7.5 cascade |
| T-DI-04 | Binding relationship ambiguity | §4.3, §9.4 relationship prefix |
| T-DI-05 | Cherry-pick attribution laundering | §7.4 |
| T-DI-06 | Attached content integrity (diff-in-transit + Blossom split-world) | §5.2 lookup, §9.2 imeta |

### §6.2 Identity

| ID | Threat | Key spec refs |
|---|---|---|
| T-ID-01 | Key compromise — no Nostr revocation | §2.1 trust model |
| T-ID-02 | Sybil amplification through WoT expansion | §2.1, §6.1, §6.3–6.4 |
| T-ID-03 | Canonical identifier squatting | §9.4, §9.3 discipline |
| T-ID-04 | Unverifiable identity claims (fake vendor + product impostor merged) | §2.1, §6.1 |
| T-ID-05 | Author hint forgery on e tags | §4.3 e tag semantics |

### §6.3 Availability

| ID | Threat | Key spec refs |
|---|---|---|
| T-AV-01 | Spam and graph pollution | §3.1 PoW (MAY), §8.0 relays |
| T-AV-02 | Graph traversal amplification | §6.4 binding traversal, §7.5 chain computation |
| T-AV-03 | Event size exceeding relay limits | §9.2 imeta recommendation |
| T-AV-04 | Artifact hosting fragility (URL rot + Blossom takedown + split-world merged) | §9.2, §5.2 attached diffs |
| T-AV-05 | Prose-only patch abuse | §4.4 prose-only definition |

### §6.4 Discovery

| ID | Threat | Key spec refs |
|---|---|---|
| T-DC-01 | Inconsistent relay NIP support (empty-result indistinguishable from unsupported-filter, merged) | §8.0 fallback table, §8.3 |
| T-DC-02 | WoT bootstrap trap | §6.1, §2.1 Sybil section |
| T-DC-03 | Identifier mirror infidelity (malicious omission + accidental forgetfulness merged) | §4.4.1 mirroring, §8.3 |
| T-DC-04 | Patch-to-root resolution gap | §8.3 client resolution MUST, §4.4.1 |

### §6.5 Censorship

| ID | Threat | Key spec refs |
|---|---|---|
| T-CE-01 | Relay-level event suppression | §2.1 honest-but-curious, §8.0 multi-relay |
| T-CE-02 | Eclipse attack on relay set | §2.1, §8.0 ≥3 relays |
| T-CE-03 | Economic/legal relay coercion | §2.1 censorship paragraph |

### §6.6 Surveillance

| ID | Threat | Key spec refs |
|---|---|---|
| T-SV-01 | Plaintext REQ filter leakage | NIP-01 (inherited), §2.1 honest-but-curious |
| T-SV-02 | Organizational query pattern exposure | §8 discovery patterns |
| T-SV-03 | Artifact host tracking via imeta fetches | §9.2 imeta + Blossom |

### §6.7 Ecosystem

| ID | Threat | Key spec refs |
|---|---|---|
| T-EC-01 | Indexer re-centralization | §7.5 canonical view cost |
| T-EC-02 | Default trust list compromise | §6.1, §2.1 bootstrap |
| T-EC-03 | kind:1 namespace coupling with relay policy | §3 all-events-kind-1 design choice |
| T-EC-04 | AI-generated false metadata at scale | §2 principle 4 (AI does interpretation) |

### §6.8 Protocol Interactions

| ID | Threat | Key spec refs |
|---|---|---|
| T-PI-01 | Legal pressure vectors (DMCA, trade secret, CFAA) | §2.1 censorship paragraph |
| T-PI-02 | NIP-09 semantic tension (deletion vs audit trail preservation) | §10, §7.3 orphaned disputes |
| T-PI-03 | Cryptographic agility gap (secp256k1+SHA-256 hardcoded) | §3.1 NIP dependencies |
| T-PI-04 | Snapshot pin staleness (root:rev/link:rev pinned to retracted/evolved state) | §4.3 snapshot tags, §10 cascade |

## Write order

### Phase 1 — Preamble (§§1–5)
Write sequentially. §3 derives from spec §2.1 vocabulary. §3b uses exact spec terms. §4 re-verifies every capability against v0.5.1.

### Phase 2 — Core threats (§6.1–6.8)
Write each subsection in file order. For each category: write all threats fresh, then scan for broken cross-references.

Before writing DC threats: reference §8.0 fallback strategies explicitly.
Before writing ID/EC threats: reference §2.1 trust model's actor declarations.
For SV threats: these are short — they're inherited Nostr concerns with minimal SCRUTINY-specific surface. Keep them tight.

### Phase 3 — Wrap-up (§§7–11)
Write sequentially. §7 consolidates excluded items (see exclusion register below). §9 built by condensing each §6 entry to one line. §10 is placeholder only.

### Phase 4 — Verification
Read entire document end-to-end. Check against checklist below.

## Opus salvage instructions

The file `docs/SCRUTINY_threat_model_v0_5_1.md` contains ~200 lines of well-researched threat analysis from a previous Claude Opus run that ran out of credits. Its surviving content covers parts of §§6.2–6.6 in a different format.

What to do with it:
- **Extract mechanical insights** — Opus correctly traced several attack mechanics (Sybil WoT expansion, author-hint pre-fetch UI window, artifact-host tracking-beacon correlation, empty-result ambiguity). Adopt these observations.
- **Discard everything else** — Opus wording, mixed T<n>/T-XX-NN IDs, variable-depth prose, any "#q" references, any "Effective View" terminology, any v0.4 comparisons, the file-overwrite-disaster narrative in the thinking block.
- **Cross-check every factual claim** against the current spec before adopting.
- **Rewrite in B5+ format** — 3-row header + numbered 1-4 prose with consistent depth.

Opus mapping (old ID → new ID):
- Opus T7 → T-ID-02 (Sybil amplification)
- Opus T8 → T-ID-03 (Identifier squatting)
- Opus T9 → T-ID-04 (Fake vendor, merge with product impostor)
- Opus T16 → Fold into T-ID-03 (same class of squatting concern)
- Opus T-ID-05 → T-ID-05 (Author hint forgery)
- Opus T10 → T-AV-01
- Opus T11 → T-AV-02
- Opus T13 → T-AV-03
- Opus T35 → Fold into T-AV-01
- Opus T-AV-05 → T-AV-04 (Artifact hosting fragility)
- Opus T14 → T-DC-01
- Opus T15 → T-DC-02
- Opus T-DC-04 → Merge into T-DC-01
- Opus T-DC-05 → Merge into T-DC-03
- Opus T17 → T-CE-01
- Opus T18 → T-CE-02
- Opus T-CE-04 → T-AV-04 (moved to Availability)
- Opus T19 → T-SV-01
- Opus T20 → T-SV-02
- Opus T41 → T-SV-03

## Exclusion register — do NOT include these

| Item | Where it goes instead |
|---|---|
| Schnorr signature forgery | Excluded entirely — mathematically impossible |
| SHA-256 collision | Excluded entirely — astronomically negligible |
| Secp256k1 nonce reuse | Excluded entirely — key hygiene, not protocol |
| TLS relay downgrade | Excluded entirely — transport layer |
| Canonical view determinism across implementations | §7 Residual Risks, one paragraph |
| Line ending / encoding normalization edge cases | §7 Residual Risks, consolidated under "surface normalization precision" |
| Compromised developer supply chain | §7 Residual Risks, one paragraph |
| Relay TLS certificate validation | Excluded entirely |
| DNS poisoning of relay URLs | Excluded entirely |
| Anything involving `#q` tags, structured labels, RetractionEvents, or dedicated SCRUTINY kinds | Dead mechanics — do not mention |

## Anti-trap instructions

1. **Verify every claim against the spec.** Read `protocol-spec.md` as your ground truth. If a section reference doesn't exist or says something different than what you're claiming, fix it.

2. **No stale terminology.** These words MUST NOT appear: "Effective View" (→ canonical view), "#q" tags (removed), "RetractionEvents" (→ kind:5), "scrutiny_binding" underscores (→ scrutiny-binding kebab-case), structured-label references, NIP-25/56/57 mentions, "dedicated kinds" framing.

3. **Distinguish MAY from MUST mitigations.** OTS and PoW are gated on voluntary adoption. When describing mitigation, separate "the protocol design provides X" from "implementations are free to ignore X." Residual risk ratings must reflect whether defense is gated.

4. **All events are kind:1.** SCRUTINY shares relay namespace with social posts. Rate-limiting and storage policies affect all SCRUTINY events uniformly. Analyze this honestly.

5. **The content field is free-form.** Content injection and XSS are client-side concerns, not protocol gaps. Mark the boundary clearly.

6. **Every "not solved" must be actionable.** Explain WHY it's unsolved. Never "unsolved because the protocol didn't solve it."

7. **Risk ratings must be defensible.** If rated High, a reviewer should read the problem description and agree. Erring toward over-rating is safer than under-rating. Don't inflate to avoid scrutiny either.

8. **§3 must align with spec §2.1 vocabulary.** The spec already declares three actor types, honest-but-curious relay baseline, Sybil-at-WoT-radius, and operational censorship defense. Your §3 expands on those — it does not invent parallel terms.

9. **§6.4/§6.5 threats must reference §8.0 fallback table.** When discussing relay capability gaps, cite the documented client-side fallback strategy from the spec's relay requirements section.

10. **Output clean markdown directly to `docs/SCRUTINY_threat_model_v0_5_1.md`.** No preamble, no meta-commentary, no "here's the document." Just the document.

11. **Overwrite the existing partial Opus file.** It served its purpose as salvage material. The new output replaces it completely.

## Verification checklist

Before declaring done, confirm:
- [ ] 34 threats across 8 categories, all T-XX-NN prefixed
- [ ] Category taxonomy table at §6 head
- [ ] All 6 new v0.5.1 threats covered:
  - T-DI-05 Cherry-pick attribution laundering
  - T-DI-06 Attached content integrity (diff-in-transit + Blossom split-world)
  - T-DC-03 Identifier mirror fidelity
  - T-AV-04 Artifact hosting fragility
  - T-AV-05 Prose-only patch abuse
  - T-PI-04 Snapshot pin staleness
- [ ] Zero instances of banned terms (see anti-traps #2)
- [ ] Every §X.Y cross-reference resolves to a real spec section
- [ ] Every adversary name in §6 headers exists in §4
- [ ] Every asset name in §6 headers exists in §3b
- [ ] §3 uses spec §2.1 terminology, not invented parallels
- [ ] All MUST/SHOULD/MAY claims match current spec verbatim
- [ ] Target length 950-1050 lines
- [ ] File saved at `docs/SCRUTINY_threat_model_v0_5_1.md`