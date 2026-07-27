# SCRUTINY Fabric — Test Vectors v0.5.1

**Status:** Draft  
**Target Spec:** `docs/protocol-spec.md` §1–§10  

Each test vector defines input events (Nostr JSON) and the expected canonical view computed per §7.5 of the protocol specification. All diffs are valid unified-diff output suitable for `git apply --check`.

### Conventions

| Item | Pattern | Note |
|---|---|---|
| Root pubkey | `"aa...aa"` (64×`a`) | Sovereign author for product/patches in T1–T6 |
| Foreign pubkey | `"bb...bb"` (64×`b`) | Different actor for disputes/bindings |
| Event IDs | `"000..00"` through `"050..05"` | Sequential; real Nostr IDs are 64-char random hex |
| Created timestamps | epoch seconds increasing by 1000 per event | Deterministic ordering |

---

## TV-1: Root Event Materialization

**Purpose:** `materialize(rootEvent)` → three virtual surfaces per §5.1. `i` and `imeta` surfaces sorted lexicographically. Absent dimensions materialize as zero-byte files.

### Input Events

**E0 — Product root (`scrutiny-product`)**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000000",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700000000,
  "content": "ACME Widget v2.0 — enterprise widget platform.",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-product"],
    ["i", "purl:pkg:generic/acme/widget@2.0.0"],
    ["i", "cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*"],
    ["i", "gtin:00012345678905"]
  ]
}
```

### Expected Canonical View

**Virtual surfaces (§5.1 serialization):**

| Surface | Value |
|---|---|
| `content` | `ACME Widget v2.0 — enterprise widget platform.\n` |
| `i` | `cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*\ngtin:00012345678905\npurl:pkg:generic/acme/widget@2.0.0\n` |
| `imeta` | (zero bytes) |

**Lexical sort proof:** `cpe:…` starts with `c`, `gtin:…` starts with `g`, `purl:…` starts with `p`. Order: cpe < gtin < purl.

**Computed metadata:**

| Field | Value |
|---|---|
| `tip` | `00000000…0` (root itself) |
| `chain_depth` | 0 |
| `warnings` | [] |

### Exercises

`materialize()` — tag extraction, `i` sort, surface LF normalization, empty-surface creation.

---

## TV-2: Single Canonical Patch

**Purpose:** Root-author `scrutiny-patch` applies via unified diff. Content updates and `i` additions reflected in canonical view. NIP-10 `e reply` threading respected.

### Input Events

**E0** — Product root (same as TV-1).

**E1 — Canonical patch (`scrutiny-patch`)**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000001",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700001000,
  "content": "Add FIPS certification note and identifier.\n\n```diff\ndiff --git a/content b/content\n--- a/content\n+++ b/content\n@@ -1 +1 @@\n-ACME Widget v2.0 — enterprise widget platform.\n+ACME Widget v2.0 — enterprise widget platform. FIPS 140-3 validated.\ndiff --git a/i b/i\n--- a/i\n+++ b/i\n@@ -1,3 +1,4 @@\n cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*\n+fips:140-3-4321\n gtin:00012345678905\n purl:pkg:generic/acme/widget@2.0.0\n```",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-patch"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "reply", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
  ]
}
```

### Expected Canonical View

| Surface | Value |
|---|---|
| `content` | `ACME Widget v2.0 — enterprise widget platform. FIPS 140-3 validated.\n` |
| `i` | `cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*\nfips:140-3-4321\ngtin:00012345678905\npurl:pkg:generic/acme/widget@2.0.0\n` |
| `imeta` | (zero bytes) |

| Field | Value |
|---|---|
| `tip` | `00000000…1` (E1 patch) |
| `chain_depth` | 1 |
| `warnings` | [] |

**Lexical sort:** `cpe` < `fips` < `gtin` < `purl`. FIPS inserted between cpe and gtin.

### Diff Verification Points

| Check | Expected |
|---|---|
| Content context line | Exact match against E0 content |
| `i` context lines | Match TV-1's sorted `i` surface line-for-line |
| `git apply --check` | Exit 0 |
| Post-application `i` line count | 4 |
| E1 `i` tag mirrors diff addition | Has exactly `["i", "fips:140-3-4321"]` |

### Exercises

`applyPatch()`, NIP-10 `e reply` threading, `e root` anchor, root-author identity check, two-surface diff, multi-hunk patch, `i` tag mirroring.

---

## TV-3: Kind-5 Deletion Cascade (Depth 2)

**Purpose:** Kind 5 targeting a mid-chain patch recursively invalidates it and all descendants (§10 topology cascade). Canonical view reverts to last surviving ancestor.

### Input Events

**E0** — Product root (TV-1).

**E1** — Canonical patch (TV-2).

**E2 — Second canonical patch, replying to E1**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000002",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700002000,
  "content": "Add SWID tag identifier.\n\n```diff\ndiff --git a/i b/i\n--- a/i\n+++ b/i\n@@ -1,4 +1,5 @@\n cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*\n fips:140-3-4321\n gtin:00012345678905\n purl:pkg:generic/acme/widget@2.0.0\n+swid:acme-widget-2.0\n```",
"tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-patch"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000001", "", "reply", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["i", "swid:acme-widget-2.0"]
  ]
}
```

**E3 — Kind 5 deletion targeting E1**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000003",
  "kind": 5,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700003000,
  "content": "Retracting — FIPS cert number was incorrect.",
  "tags": [
    ["e", "0000000000000000000000000000000000000000000000000000000000000001"]
  ]
}
```

### Expected Canonical View

| Surface | Value |
|---|---|
| `content` | `ACME Widget v2.0 — enterprise widget platform.\n` |
| `i` | `cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*\ngtin:00012345678905\npurl:pkg:generic/acme/widget@2.0.0\n` |
| `imeta` | (zero bytes) |

| Field | Value |
|---|---|
| `tip` | `00000000…0` (reverted to root) |
| `chain_depth` | 0 |
| `surviving_events` | [E0] |
| `invalidated` | [E1, E2] (E2 cascade-invalidated even though not directly targeted) |

### Cascade Validation Points

| Check | Expected |
|---|---|
| E1 pubkey == E3 pubkey? | Yes — deletion is authoritative (§10) |
| E2 (replying to E1) removed? | Yes — recursive descendant invalidation |
| Canonical state matches root? | Yes — identical to TV-1 output |
| `i` surface has fips? | No — reverted out |
| `swid` present? | No — its carrier (E2) was cascaded |
| E1 mirrors its diff addition | Has `["i", "fips:140-3-4321"]` (§4.4.1) |
| E2 mirrors its diff addition | Has `["i", "swid:acme-widget-2.0"]` |

### Exercises

Kind-5 validation (pubkey match), recursive descendant pruning, ancestor-state reversion, depth ≥ 2 cascade, `i` tag mirroring on multi-patch chains.

---

## TV-4: Invalid Patch Halt

**Purpose:** A patch whose diff context does not match the current surface state fails pre-validation (§5.3). The chain halts. No later patches are applied. An error annotation is surfaced.

### Input Events

**E0** — Product root (TV-1).

**E1 — Patch with deliberately wrong context line**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000001",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700001000,
  "content": "Attempt to change title — but context is wrong.\n\n```diff\ndiff --git a/content b/content\n--- a/content\n+++ b/content\n@@ -1 +1 @@\n-ACME Widget v1.0 — legacy widget platform.\n+ACME Widget v3.0 — next-generation widget platform.\n```",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-patch"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "reply", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
  ]
}
```

**Context mismatch:** Root content is `ACME Widget v2.0 …` but patch removes `ACME Widget v1.0 …`. These do not match.

### Expected Result

| Check | Expected |
|---|---|
| `applyPatch(E1_diff, root_surfaces)` | Throws / returns error |
| `preValidationResult` | Failure |
| Canonical view | Root state (TV-1) — unchanged |
| `tip` | `00000000…0` |
| Error annotation includes | E1's event ID, surface name (`content`), reason ("context mismatch") |

### What must NOT happen

- Must NOT silently skip E1 and continue
- Must NOT apply partial changes
- Must NOT leave surfaces in an inconsistent state

### Exercises

Pre-validation gate, `git apply --check` equivalence, halt semantics, error surfacing, state rollback.

---

## TV-5: Foreign Dispute Exclusion

**Purpose:** A `scrutiny-patch` by a different pubkey (non-root-author) is **excluded from the canonical chain** (§7.5). Its diff is never applied to the canonical view.

### Input Events

**E0** — Product root (TV-1, pubkey = `aa…aa`).

**E1 — Foreign-authored patch**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000001",
  "kind": 1,
  "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "created_at": 1700001000,
  "content": "Third-party correction to description.\n\n```diff\ndiff --git a/content b/content\n--- a/content\n+++ b/content\n@@ -1 +1 @@\n-ACME Widget v2.0 — enterprise widget platform.\n+ACME Widget v2.0 — deprecated enterprise widget platform.\n```",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-patch"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "reply", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
  ]
}
```

### Expected Canonical View

| Check | Expected |
|---|---|
| Canonical view content | `ACME Widget v2.0 — enterprise widget platform.` (unchanged) |
| Canonical tip | `00000000…0` |
| Chain depth | 0 |
| E1 in chain? | No — filtered by author check |
| E1 available as overlay? | Yes — returned separately for UI rendering |

**Author check:** `E1.pubkey !== E0.pubkey` → excluded from canonical chain per §7.1.

### Exercises

Author-based filtering, canonical vs overlay separation, non-modification guarantee.

---

## TV-6: Fork Resolution (Two Tips)

**Purpose:** When the root author publishes two concurrent patches (both replying to root via NIP-10, neither replying to the other), a fork exists. Default head selection: latest `created_at` wins. Equal timestamps: lowest event ID lexicographically wins.

### Input Events

**E0** — Product root (TV-1).

**E1 — Fork branch A (earlier)**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000001",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700001000,
  "content": "Branch A — security assessment note.\n\n```diff\ndiff --git a/content b/content\n--- a/content\n+++ b/content\n@@ -1 +1 @@\n-ACME Widget v2.0 — enterprise widget platform.\n+ACME Widget v2.0 — enterprise widget platform. [Security review pending]\n```",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-patch"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "reply", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
  ]
}
```

**E2 — Fork branch B (later)**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000002",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700005000,
  "content": "Branch B — QA sign-off note.\n\n```diff\ndiff --git a/content b/content\n--- a/content\n+++ b/content\n@@ -1 +1 @@\n-ACME Widget v2.0 — enterprise widget platform.\n+ACME Widget v2.0 — enterprise widget platform. [QA approved 2024-03]\n```",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-patch"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "reply", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
  ]
}
```

### Expected Result (time-based resolution)

| Check | Expected |
|---|---|
| Fork detected? | Yes — 2 tips (E1, E2), both replying to E0 |
| Default head | E2 (`created_at` 1700005000 > 1700001000) |
| Canonical content | `…[QA approved 2024-03]` (E2's change) |
| Alternate tip surfaced? | E1 listed as alternate for client inspection |

### Tiebreak Sub-Test

Change E1's `created_at` to `1700005000` (equal to E2). E1's ID (`000…1`) < E2's ID (`000…2`) lexicographically → E1 wins.

| Check (tiebreak) | Expected |
|---|---|
| Equal `created_at` | Both 1700005000 |
| Default head | E1 (lower event ID) |
| Canonical content | `…[Security review pending]` |

### Exercises

Fork detection, NIP-10 tree traversal for multiple tips, `created_at` comparison, event ID tiebreak.

---

## TV-7: Binding Structure & Endpoint Resolution

**Purpose:** A `scrutiny-binding` connects a Product and Metadata via `e` tags with `root` and `link` markers. Parsing must extract markers correctly. Author hints are advisory and must be verified.

### Input Events

**E0 — Product root**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000000",
  "kind": 1,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1700000000,
  "content": "ACME Widget v2.0.",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-product"],
    ["i", "cpe:2.3:a:acme:widget:2.0:*:*:*:*:*:*:*"]
  ]
}
```

**E1 — Metadata event**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000001",
  "kind": 1,
  "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "created_at": 1700001000,
  "content": "CVE-2024-0001: ACME Widget buffer overflow in parser.",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-metadata"],
    ["i", "cve:CVE-2024-0001"]
  ]
}
```

**E2 — Binding**

```json
{
  "id": "0000000000000000000000000000000000000000000000000000000000000002",
  "kind": 1,
  "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "created_at": 1700002000,
  "content": "Vulnerability: CVE-2024-0001 affects ACME Widget v2.0.",
  "tags": [
    ["t", "scrutiny-fabric"],
    ["t", "scrutiny-v051"],
    ["t", "scrutiny-binding"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000000", "", "root", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["e", "0000000000000000000000000000000000000000000000000000000000000001", "", "link", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]
  ]
}
```

### Expected Parsing Results

| Extraction | Expected Value |
|---|---|
| Root endpoint (`root` marker) | `00000000…0` (E0) |
| Linked endpoint (`link` marker) | `00000000…1` (E1) |
| Root author hint matches fetched pubkey? | Yes — `aa…aa` == `aa…aa` |
| Link author hint matches fetched pubkey? | Yes — `bb…bb` == `bb…bb` |

### Query Compatibility Check

| Query Filter | Should Return E2? |
|---|---|
| `{"#e": ["0000…0"], "#t": ["scrutiny-binding"]}` | Yes — root endpoint |
| `{"#e": ["0000…1"], "#t": ["scrutiny-binding"]}` | Yes — link endpoint (both use `e` tag) |

### Author-Hint Guard Sub-Test

If the `root` tag claimed author `cccc…cc` but the fetched event has pubkey `aaaa…aa`, the parser MUST reject the hint and use the actual pubkey. Build a separate test case with a lying hint.

| Check | Expected |
|---|---|
| Fetch E0 → pubkey = `aa…aa` | True |
| Hint in `e` tag = `cc…cc` | Mismatch |
| Parser uses | Actual fetched pubkey (`aa…aa`) |
| Warning raised | Yes |

### Exercises

Marker extraction (`root` vs `link`), `#e` query compatibility, author-hint verification, mismatch detection.

---

## Engine Operations Coverage Matrix

| Operation | TV-1 | TV-2 | TV-3 | TV-4 | TV-5 | TV-6 | TV-7 |
|---|---|---|---|---|---|---|---|---|
| `materialize()` | ✅ | — | — | — | — | — | — |
| `applyPatch()` (via diff) | — | ✅ | ✅ | ✅ | — | ✅ | — |
| Author-check filter (§7.5) | — | ✅ | — | — | ✅ | ✅ | — |
| Kind-5 cascade (§10) | — | — | ✅ | — | — | — | — |
| Pre-validation gate (§5.3) | — | — | — | ✅ | — | — | — |
| Fork detection + tip selection (§7.2) | — | — | — | — | — | ✅ | — |
| Binding marker parsing (§4.3) | — | — | — | — | — | — | ✅ |
| `i` tag mirroring on patches (§4.4.1) | — | ✅ | ✅ | — | — | — | — |
| Lexical `i` sort (§5.1) | ✅ | ✅ | — | — | — | — | — |
| Empty-surface creation (§5.1) | ✅ | — | — | — | — | — | — |
| `#e` relay filter compatibility | — | — | — | — | — | — | ✅ |
| Author hint verification | — | — | — | — | — | — | ✅ |
| NIP-10 `e reply` threading | — | ✅ | ✅ | — | ✅ | ✅ | — |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| 0.5.1 | 2026-05-03 | Initial draft — 7 vectors covering core engine operations |