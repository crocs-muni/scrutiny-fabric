# SCRUTINY Fabric — Event Specification v0.3

SCRUTINY Fabric uses standard Nostr `kind: 1` text notes to create a graph linking security products to security-relevant metadata (vulnerability reports, certifications, test results, audits, reviews, replications, and disputes).

---

## 1. Overview & Principles

**Problem:** Security-relevant metadata for products is scattered across disconnected databases, often behind permission barriers, and subject to censorship or removal.

**Solution:** SCRUTINY Fabric is a permissionless metadata overlay that solves the **discoverability problem** by creating auditable, cryptographically-signed bindings between products and their security metadata.

### Core Principles

- **Permissionless:** Anyone can publish events; no gatekeeper controls contributions
- **Auditable:** Append-only history via UpdateEvents; retractions are visible
- **Verifiable:** Nostr signatures authenticate authors; SHA-256 hashes verify artifact integrity
- **Interoperable:** All SCRUTINY objects are standard `kind: 1` notes, readable in any Nostr client

### Design Philosophy

- **kind:1 only:** No custom event kinds; maximum client compatibility
- **No JSON payloads:** Human-readable `content` field; structured data in tags
- **Trust-by-reference:** Users whitelist trusted pubkeys; nodes are "admitted" when referenced by trusted BindingEvents
- **Generic-client-first:** BindingEvents should display as readable replies in normal Nostr clients

---

## 2. Protocol Identifiers

All SCRUTINY Fabric events MUST include these tag-based protocol identifiers:

```json
["t", "scrutiny_fabric"],
["t", "srutiny_<type>"]
```

Where `<type>` is one of: `product`, `metadata`, `binding`, `update`.

All SCRUTINY Fabric events SHOULD include a version marker:

```json
["t", "scrutiny_v03"]
```

**Rationale:** The `scrutiny_fabric` tag enables broad filtering; the type tag enables type-specific queries; the version tag supports future protocol evolution.

---

## 3. Event Types

SCRUTINY Fabric defines four event types, all using `kind: 1`:

- **ProductEvent:** Anchor node representing a specific product/model/version
- **MetadataEvent:** Security-relevant information node (tests, vulnerabilities, certifications, audits, reviews)
- **BindingEvent:** Typed edge connecting two events (Product↔Metadata, Product↔Product, Metadata↔Metadata)
- **UpdateEvent:** Auditable correction/retraction of an existing SCRUTINY event

---

## 4. ProductEvent

**Purpose:** Immutable anchor representing a specific product release, model, or version. Primary discovery object.

### 4.1 Required Fields

- **kind:** `1`
- **content:** Human-readable product title/description. SHOULD include product name, vendor, version. MAY include hashtags for visibility in generic clients.
- **tags:**
  - `["t", "scrutiny_fabric"]` (REQUIRED)
  - `["t", "scrutiny_product"]` (REQUIRED)
  - `["t", "scrutiny_v03"]` (RECOMMENDED)

### 4.2 Recommended Fields (NIP-32 Labels)

ProductEvents SHOULD use NIP-32 self-labeling for categorical/classification fields:

**Identity:**
- `["L", "scrutiny:product:vendor"]`
- `["l", "<vendor_name>", "scrutiny:product:vendor"]`
- `["L", "scrutiny:product:name"]`
- `["l", "<product_name>", "scrutiny:product:name"]`
- `["L", "scrutiny:product:version"]`
- `["l", "<version>", "scrutiny:product:version"]`
- `["L", "scrutiny:product:category"]`
- `["l", "<category>", "scrutiny:product:category"]` (e.g., `smartcard`, `crypto_library`, `tpm`, `hsm`, `firmware`)

**Lifecycle:**
- `scrutiny:product:status` (`active`, `archived`, `eol`, `deprecated`)
- `scrutiny:product:release_date` (ISO 8601: `YYYY-MM-DD`)
- `scrutiny:product:eol_date` (ISO 8601)
- `scrutiny:product:support_until` (ISO 8601)

**Technical/Crypto:**
- `scrutiny:product:form_factor` (e.g., `contact`, `contactless`, `dual_interface`)
- `scrutiny:product:chip` (chip model identifier)
- `scrutiny:product:crypto_suite` (e.g., `RSA_ECC_AES_SHA256`)
- `scrutiny:product:key_length_max` (e.g., `4096`)
- `scrutiny:product:ecc_curves` (e.g., `P-256_P-384_Curve25519`)
- `scrutiny:product:hash_functions` (e.g., `SHA256_SHA384_SHA512`)

**Documentation URLs:**
- `scrutiny:product:datasheet_url`
- `scrutiny:product:manual_url`
- `scrutiny:product:sdk_url`
- `scrutiny:product:sbom_url`

### 4.3 Canonical Identifiers (i tags)

ProductEvents SHOULD include one or more `i` tags for canonical external identifiers:

```json
["i", "<prefix>:<value>"]
```

**Supported prefixes:**
- `cpe` — CPE 2.3 identifier (lowercase recommended)
- `purl` — Package URL (PURL)
- `cc` — Common Criteria certificate ID

**Examples:**

```json
["i", "cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"],
["i", "purl:pkg:github/openssl/openssl@3.0.0"],
["i", "cc:BSI-DSZ-CC-0674-2011"]
```

**Rules:**
- Multiple `i` tags are allowed
- Values SHOULD be lowercase where applicable
- Format MUST be `prefix:value`

### 4.4 Multiple Values in Labels

To express multiple values for a label namespace, include multiple `l` tags with the same namespace:

```json
["L", "scrutiny:product:ecc_curves"],
["l", "P-256", "scrutiny:product:ecc_curves"],
["l", "P-384", "scrutiny:product:ecc_curves"],
["l", "Curve25519", "scrutiny:product:ecc_curves"]
```

---

## 5. MetadataEvent

**Purpose:** Security-relevant information node. Can describe vulnerabilities, test results, certifications, audits, research papers, reviews, replications, or disputes.

MetadataEvents MAY reference external artifacts (files, reports, datasets) using artifact reference tags (Section 9).

### 5.1 Required Fields

- **kind:** `1`
- **content:** Human-readable summary of the metadata. SHOULD describe what the metadata represents and its significance. MAY include hashtags.
- **tags:**
  - `["t", "scrutiny_fabric"]` (REQUIRED)
  - `["t", "scrutiny_metadata"]` (REQUIRED)
  - `["t", "scrutiny_v03"]` (RECOMMENDED)

### 5.2 Recommended Fields (NIP-32 Labels)

**Classification:**
- `scrutiny:metadata:measurement_category` (e.g., `vulnerability`, `certification`, `audit`, `test`, `analysis`, `review`, `replication`, `dispute`)
- `scrutiny:metadata:measurement_type` (specific test type, e.g., `timing_attack`, `power_analysis`, `randomness_test`)

**Source/Provenance:**
- `scrutiny:metadata:source` (organization/individual who produced metadata)
- `scrutiny:metadata:lab` (testing laboratory)
- `scrutiny:metadata:operator` (person/team who conducted test)
- `scrutiny:metadata:date` (ISO 8601: `YYYY-MM-DD`)

**Tooling:**
- `scrutiny:metadata:tool` (tool name, e.g., `jcalgtest`, `ChipWhisperer`, `Riscure Inspector`)
- `scrutiny:metadata:tool_version`
- `scrutiny:metadata:tool_vendor`

**Vulnerability-Specific:**
- `scrutiny:metadata:vuln:cve` (CVE ID)
- `scrutiny:metadata:vuln:cwe` (CWE ID)
- `scrutiny:metadata:vuln:cvss_score` (e.g., `7.5`)
- `scrutiny:metadata:vuln:cvss_vector` (CVSS vector string)
- `scrutiny:metadata:vuln:severity` (`critical`, `high`, `medium`, `low`)

**Certification-Specific:**
- `scrutiny:metadata:cert:scheme` (e.g., `CC`, `FIPS`, `EMVCo`)
- `scrutiny:metadata:cert:level` (e.g., `EAL4+`, `FIPS 140-2 Level 3`)
- `scrutiny:metadata:cert:certificate_id`
- `scrutiny:metadata:cert:valid_from` (ISO 8601)
- `scrutiny:metadata:cert:valid_until` (ISO 8601)
- `scrutiny:metadata:cert:lab` (certification lab)

### 5.3 Canonical Identifiers (i tags)

MetadataEvents SHOULD include `i` tags for canonical identifiers:

```json
["i", "cve:2024-1234"],
["i", "cwe:120"],
["i", "cc:BSI-DSZ-CC-0674-2011"]
```

### 5.4 Artifact References

See Section 9 for complete artifact reference rules. Brief summary:

If the metadata references an external file (report, dataset, trace), include:

```json
["r", "https://example.com/report.pdf"],
["x", "<sha256_hex_64_chars>"],
["m", "application/pdf"],
["size", "1048576"]
```

---

## 6. BindingEvent

**Purpose:** Typed edge connecting two Nostr events, typically linking Products to Metadata or expressing relationships between Products.

BindingEvents MAY target any Nostr event (not only SCRUTINY events), enabling integration with existing Nostr content (e.g., long-form articles, announcements).

### 6.1 Required Fields

- **kind:** `1`
- **content:** Human-readable description of the binding. SHOULD read naturally in generic clients. SHOULD include context about the relationship.
- **tags:**
  - `["t", "scrutiny_fabric"]` (REQUIRED)
  - `["t", "scrutiny_binding"]` (REQUIRED)
  - `["t", "scrutiny_v03"]` (RECOMMENDED)
  - Endpoint `e` tags (see Section 6.3) (REQUIRED)

### 6.2 Relationship Type (NIP-32 Label)

BindingEvents SHOULD include a relationship label:

```json
["L", "scrutiny:binding:relationship"],
["l", "<relationship_value>", "scrutiny:binding:relationship"]
```

**If no relationship label is present, clients MUST interpret the relationship as `related_to` (generic link).**

**Relationship values (recommended set):**

*Directed relationships (A → B):*
- `test_of` — metadata describes test results for product
- `vulnerability_in` — metadata describes vulnerability affecting product
- `patch_for` — product/metadata provides patch for vulnerability
- `certification_of` — metadata is certification report for product
- `audit_of` — metadata is audit report for product
- `analysis_of` — metadata provides analysis of product/other metadata
- `documentation_of` — metadata provides documentation for product
- `benchmark_of` — metadata provides benchmark results for product
- `contains` — product A contains component product B
- `depends_on` — product A depends on product B
- `supersedes` — product/metadata A supersedes (replaces) product/metadata B

*Review/Evidence relationships (directed):*
- `confirms` — metadata confirms claims in another metadata
- `replicates` — metadata replicates results from another metadata
- `contests` — metadata disputes claims in another metadata
- `refutes` — metadata refutes claims in another metadata

*Symmetric relationships (A ↔ B):*
- `same_as` — two events refer to the same real-world entity (identity link)
- `related_to` — generic association (default)

Clients MAY display unknown relationship values as generic links.

### 6.3 Endpoint Encoding (NIP-10 Marked e Tags)

BindingEvents MUST include exactly **two** endpoint `e` tags using NIP-10 markers:

```json
["e", "<event_id>", "<relay_hint_or_empty>", "<marker>"]
```

**For directed relationships (A → B):**
- Source endpoint A MUST use marker `"root"`
- Target endpoint B MUST use marker `"reply"`

Interpretation: **root → reply**

**For symmetric relationships (unordered pair):**
- Both endpoints MUST use marker `"reply"` (do not use `"root"`)

Interpretation: unordered association

**Example (directed):**

```json
["e", "product_event_id_abc123", "", "root"],
["e", "metadata_event_id_def456", "", "reply"],
["L", "scrutiny:binding:relationship"],
["l", "vulnerability_in", "scrutiny:binding:relationship"]
```

Interpretation: "Metadata def456 describes a vulnerability in Product abc123"

**Example (symmetric):**

```json
["e", "product_event_id_abc123", "", "reply"],
["e", "product_event_id_xyz789", "", "reply"],
["L", "scrutiny:binding:relationship"],
["l", "same_as", "scrutiny:binding:relationship"]
```

Interpretation: "Products abc123 and xyz789 are the same product"

**Rationale:** Using `root` + `reply` for directed edges makes the binding appear as a reply to the source node in generic clients' thread views. Using `reply` + `reply` for symmetric edges ensures both nodes show the binding as a reply.


### 6.4 Binding Immutability Rule

**The endpoints and relationship type of a BindingEvent are immutable.**

Authoritative UpdateEvents (Section 8) MAY add or modify context labels (scope, limitations, validity window), but MUST NOT:
- Change endpoint event IDs
- Add, remove, or change the `scrutiny:binding:relationship` label

If a binding is incorrect, the author MUST:
1. Publish an authoritative UpdateEvent with `change_type = retraction`
2. Optionally publish a new corrected BindingEvent

---

## 7. UpdateEvent

**Purpose:** Append-only correction, clarification, or retraction of an existing SCRUTINY event. Preserves audit history.

### 7.1 Required Fields

- **kind:** `1`
- **content:** Human-readable description of the update and its reason. SHOULD explain what changed and why.
- **tags:**
  - `["t", "scrutiny_fabric"]` (REQUIRED)
  - `["t", "scrutiny_update"]` (REQUIRED)
  - `["t", "scrutiny_v03"]` (RECOMMENDED)
  - `["e", "<target_event_id>", "", "root"]` (REQUIRED)
  - `["e", "<target_event_id>", "", "reply"]` (REQUIRED)

**Note:** Both `root` and `reply` markers MUST point to the same target event ID (NIP-10 convention for direct replies).

### 7.2 Recommended Labels

```json
["L", "scrutiny:update:change_type"],
["l", "<type>", "scrutiny:update:change_type"]
```

**Change types:**
- `correction` — corrects an error in the target event
- `addition` — adds new information to the target event
- `clarification` — clarifies ambiguous information
- `deprecation` — marks the target event as deprecated (but not wrong)
- `retraction` — soft-deletes the target event (author admits error/withdrawal)

Optional reason field:

```json
["L", "scrutiny:update:reason"],
["l", "<reason_text>", "scrutiny:update:reason"]
```

### 7.3 Authoritative vs. Non-Authoritative Updates

**An UpdateEvent is authoritative if and only if:**

```
UpdateEvent.pubkey == TargetEvent.pubkey
```

**Authoritative updates** modify the effective view of the target event (Section 7.5).

**Non-authoritative updates** are treated as annotations/commentary; clients MAY display them but MUST NOT apply them to the effective view by default.

### 7.4 Update Ordering (for Effective View Computation)

When computing the effective view of an event, clients SHOULD:

1. Collect all authoritative UpdateEvents targeting the event
2. Sort by:
   - `created_at` ascending
   - `id` ascending (tie-breaker for same-second updates)

### 7.5 Effective View Merge Semantics

Clients compute the **effective view** of an event by applying authoritative updates in order (Section 7.4) using these deterministic merge rules:

**A) NIP-32 labels (L/l tags): namespace replacement**

- For each label namespace `N` (e.g., `scrutiny:product:vendor`), if an authoritative UpdateEvent contains one or more `["l", value, N]` tags, the client MUST replace the entire prior value-set for namespace `N` with the new set.
- If an UpdateEvent does not mention namespace `N`, the effective view retains the previous values for `N`.

**B) Non-NIP-32 tags (e.g., r, x, m, size, i): tag-name replacement**

- If an authoritative UpdateEvent contains one or more tags with tag name `T` (e.g., one or more `["r", ...]` tags), the client MUST replace all prior tags named `T` with the new set.
- If an UpdateEvent contains no tags named `T`, the effective view retains the prior tags named `T`.

**C) Protocol identification tags (t tags) are immutable**

Clients MUST NOT apply UpdateEvent `t` tags to the target's effective view. The target event's `t` tags (including `scrutiny_fabric`, `scrutiny_v03`, and `scrutiny_<type>`) remain unchanged.

**D) content field replacement**

If an UpdateEvent's `content` is non-empty and substantive (not just hashtags), clients MAY prepend/append it to the original content (implementation-defined), but SHOULD NOT fully replace the original content to preserve audit history.

### 7.6 Retraction Semantics

If an authoritative UpdateEvent includes:

```json
["l", "retraction", "scrutiny:update:change_type"]
```

Clients SHOULD:
- Mark the target event as **RETRACTED**
- Hide the target event in normal views by default
- Preserve the target event in audit/history views
- Display a retraction notice if users explicitly navigate to the event

**Rationale:** Soft deletion preserves transparency and audit trails.

### 7.7 NIP-09 Deletion Events (Optional Interoperability)

SCRUTINY Fabric does not require NIP-09 (`kind: 5`) deletion events for protocol correctness. Clients MAY optionally consume NIP-09 deletions as an additional hint, but the canonical removal mechanism is `UpdateEvent(change_type=retraction)`.

---

## 8. Field Encoding Rules

### 8.1 NIP-32 Self-Labeling for Categorical Fields

Use NIP-32 labels (`L`/`l` tags) for categorical/classification-like fields:

**Declaration:**

```json
["L", "<namespace>"]
```

**Values:**

```json
["l", "<value>", "<namespace>"]
```

**Namespace pattern:** `scrutiny:<category>:<field>`

**Examples:**

```json
["L", "scrutiny:product:vendor"],
["l", "NXP", "scrutiny:product:vendor"],

["L", "scrutiny:metadata:measurement_category"],
["l", "vulnerability", "scrutiny:metadata:measurement_category"]
```

**Multiple values:** Include multiple `["l", ...]` tags with the same namespace.

### 8.2 Canonical Identifiers (i tags)

Use `i` tags for external canonical identifiers on **ProductEvent** and **MetadataEvent** only:

```json
["i", "<prefix>:<value>"]
```

**Supported prefixes:**
- `cpe` (CPE 2.3)
- `purl` (Package URL)
- `cve` (CVE ID)
- `cwe` (CWE ID)
- `cc` (Common Criteria cert ID)

**Rules:**
- Values SHOULD be lowercase where applicable
- Multiple `i` tags allowed
- Do NOT use `i` tags on BindingEvents

---

## 9. Artifact References & Verification

MetadataEvents often reference external artifacts (reports, datasets, power traces, test results).

### 9.1 Baseline Artifact Reference

To reference an external artifact, include these tags in a MetadataEvent:

- `["r", "<url>"]` — Resource URL (MUST be HTTPS if present)
- `["x", "<sha256_hex>"]` — SHA-256 hash of artifact (MUST be exactly 64 hex chars if present)
- `["m", "<mime_type>"]` — MIME type (RECOMMENDED)
- `["size", "<bytes>"]` — File size in bytes (RECOMMENDED)

**The URL SHOULD also appear in the `content` field for visibility in generic clients.**

**Example:**

```json
{
  "kind": 1,
  "content": "CVE-2024-1234 vulnerability report\n\nFull report: https://example.com/reports/cve-2024-1234.pdf",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_metadata"],
    ["t", "scrutiny_v03"],
    ["i", "cve:2024-1234"],
    ["r", "https://example.com/reports/cve-2024-1234.pdf"],
    ["x", "a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"],
    ["m", "application/pdf"],
    ["size", "524288"]
  ]
}
```

### 9.2 Hash Verification Rule (Client Requirement)

**If both `r` and `x` tags are present, clients MUST:**

1. Download the artifact from the URL
2. Compute its SHA-256 hash
3. Verify that the computed hash equals the value in the `x` tag
4. Only treat the artifact as authentic if verification succeeds

**Clients MAY display unverified artifacts (hash mismatch or missing `x`), but MUST clearly label them as "UNVERIFIED" or "HASH MISMATCH".**

### 9.3 Multiple URLs (Mirroring/Fallback)

If an artifact is mirrored at multiple locations, include multiple `r` tags:

```json
["r", "https://primary.example.com/file.pdf"],
["r", "https://mirror1.example.org/file.pdf"],
["r", "https://mirror2.example.net/file.pdf"]
```

The same `x` hash applies to all mirrors. Clients SHOULD try URLs in order until verification succeeds.

### 9.4 Blossom Protocol Support

**Blossom** is a protocol for storing blobs on media servers with hash-based addressing.

SCRUTINY Fabric supports Blossom URLs in `r` tags:

```json
["r", "https://blossom.example.com/<sha256_hex>"],
["x", "<sha256_hex>"]
```

**Clients MUST still verify the downloaded content hash matches the `x` tag.**

**Blossom relay discovery:** Clients MAY discover Blossom servers via NIP-34 or other mechanisms (out of scope for this spec).

### 9.5 Large Files

For very large artifacts (>100MB), publishers SHOULD:
- Use Blossom or dedicated artifact hosting
- Include multiple mirror URLs
- Consider splitting artifacts or providing summary excerpts in the `content` field

---

## 10. Trust & Admission Semantics

SCRUTINY Fabric uses a **whitelist-based trust model** where users define which pubkeys they trust, and nodes are "admitted" into their view based on trusted references.

### 10.1 User Trust Configuration

Each user maintains:
- **Whitelist:** Set of trusted pubkeys (follow list)
- **Trust depth:** How many hops to traverse (typically 1 or 2)

Trust depth 1: Only events published by whitelisted pubkeys  
Trust depth 2: Events published by whitelisted pubkeys + events published by their follows

### 10.2 Admission Rule (Direction A: Trust the Edges)

**A node N is "admitted" into a user's view if:**

1. N is published by a whitelisted pubkey, OR
2. N is referenced by an `e` tag inside a BindingEvent published by a whitelisted pubkey

**"Referenced" means:** The node's event ID appears in an `["e", ...]` tag in a trusted BindingEvent.

**Rationale:** Many valuable nodes (products, metadata) exist but are not connected. Trusted curators publish BindingEvents that vouch for nodes, even if the node authors themselves are unknown.

### 10.3 Ranking & Scoring

Clients MAY rank admitted nodes by:
- **Trust score:** Number of distinct trusted pubkeys that reference the node
- **PoW difficulty:** Higher difficulty = higher rank (optional, see Section 11)
- **Recency:** Newer events ranked higher
- **User reactions:** Zaps (NIP-57), reactions (NIP-25) from trusted pubkeys

### 10.3 Repost as Admission Edge (Optional)

Clients MAY treat Nostr reposts (`kind: 6` or `kind: 16`) by trusted pubkeys as admission edges:

- If a trusted pubkey reposts a SCRUTINY event, admit that event into view

This is optional; conservative clients may require explicit BindingEvents.

### 10.5 Filtering & Queries

Users can further filter admitted nodes by:
- Product vendor/category
- Metadata type/source
- Date range
- Relationship type (when traversing bindings)

---

## 11. Discovery & Graph Traversal

### 11.1 Node-First Traversal Algorithm

**Starting from a ProductEvent:**

1. **Seed:** User searches for a ProductEvent (by CPE, vendor+name, or NIP-50 full-text)
2. **Fetch bindings:** Query for BindingEvents that reference the ProductEvent in an `e` tag:
   ```
   { "kinds": [1], "#t": ["scrutiny_binding"], "#e": ["<product_event_id>"] }
   ```
3. **Filter by trust:** Keep only BindingEvents published by whitelisted pubkeys
4. **Admit referenced nodes:** Extract all `e` tags from trusted BindingEvents; admit those nodes
5. **Recurse:** For each admitted node, repeat steps 2-4 (bounded by trust depth or hop limit)

### 11.2 Relay Query Patterns

**Find ProductEvents by CPE:**

```json
{
  "kinds": [1],
  "#t": ["scrutiny_product"],
  "#i": ["cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"]
}
```

**Find MetadataEvents by CVE:**

```json
{
  "kinds": [1],
  "#t": ["scrutiny_metadata"],
  "#i": ["cve:2024-1234"]
}
```

**Find BindingEvents for a specific product:**

```json
{
  "kinds": [1],
  "#t": ["scrutiny_binding"],
  "#e": ["<product_event_id>"]
}
```

**Find all SCRUTINY events by a specific pubkey:**

```json
{
  "kinds": [1],
  "#t": ["scrutiny_fabric"],
  "authors": ["<pubkey_hex>"]
}
```

### 11.3 NIP-50 Full-Text Search

SCRUTINY-aware relays SHOULD implement NIP-50 search over `content` AND tags.

**Example:** Search for "smartcard NXP":

```json
{
  "kinds": [1],
  "#t": ["scrutiny_product"],
  "search": "smartcard NXP"
}
```

Relay support for NIP-50 varies; clients should gracefully degrade to tag-only queries if unavailable.

### 11.4 Graph Visualization

SCRUTINY clients MAY provide graph visualizations:
- Nodes: Products and Metadata
- Edges: BindingEvents (arrows for directed, lines for symmetric)
- Colors: By trust score or node type
- Interactive: Click to expand node details, traverse edges

---

## 12. Compatibility with Generic Clients

SCRUTINY Fabric events are designed to be readable in standard Nostr clients (Damus, Primal, Amethyst, Snort, Coracle, etc.) without custom support.

### 12.1 ProductEvent in Generic Clients

Displays as a normal text note. The `content` field includes product name/vendor/version. Users can see:
- Author (product vendor or trusted curator)
- Timestamp
- Replies (BindingEvents that reference this product)

### 12.2 MetadataEvent in Generic Clients

Displays as a normal text note with a summary and optional URL. Users see:
- Description of the metadata (vulnerability, test result, certification)
- Link to artifact (if present in `content`)
- Replies (BindingEvents that reference this metadata)

### 12.3 BindingEvent in Generic Clients

Displays as a **reply** to one or both endpoints (depending on relationship type):

- **Directed (A → B):** Appears as a reply to A (root) in thread views
- **Symmetric:** Appears as a reply to both A and B

The `content` field describes the relationship in plain language:

> "This metadata describes a vulnerability in ProductX (CVE-2024-1234)"

Users can see:
- The binding author (who created the link)
- Links to referenced events (if client renders `e` tags)
- Timestamp

### 12.4 UpdateEvent in Generic Clients

Displays as a **reply** to the target event. The `content` field explains the update:

> "Correction: The affected version is 3.0.1, not 3.0.0 as originally stated."

### 12.5 Limitations in Generic Clients

Generic clients will NOT:
- Understand SCRUTINY protocol semantics (relationship types, trust admission)
- Compute effective views (updates merged)
- Verify artifact hashes
- Display SCRUTINY-specific fields (labels, `i` tags) in structured UI

For full SCRUTINY functionality, users need a SCRUTINY-aware client.

---

## 13. Optional Features

### 13.1 Proof-of-Work (NIP-13)

Events MAY include a `nonce` tag to demonstrate computational effort:

```json
["nonce", "<random_number>", "<target_difficulty>"]
```

SCRUTINY clients MAY:
- Require minimum PoW for admission (anti-spam)
- Rank higher-PoW events higher
- Display PoW difficulty to users

PoW is not required for protocol correctness.

### 13.2 Accessibility (NIP-31)

Events SHOULD include an `alt` tag with a plain-text summary for screen readers and clients with limited formatting:

```json
["alt", "ProductEvent: NXP J3A080 v3 smartcard with EAL4+ certification"]
```

### 13.3 Lightning Zaps (NIP-57)

Users MAY zap SCRUTINY events to reward quality contributions. Clients MAY rank zapped events higher.

### 13.4 Reactions (NIP-25)

Users MAY react to SCRUTINY events (`kind: 7`). Clients MAY use reactions as signals for ranking.

### 13.5 Reports (NIP-56)

Users MAY report spam/malicious SCRUTINY events (`kind: 1984`). Clients MAY downrank or hide reported events.

---

## 14. Complete JSON Examples

### 14.1 ProductEvent Example

```json
{
  "id": "abc123...",
  "kind": 1,
  "pubkey": "vendor_pubkey_hex...",
  "created_at": 1708560000,
  "content": "NXP J3A080 v3 — Dual-interface smartcard with EAL4+ Common Criteria certification\n\n#smartcard #NXP #CommonCriteria",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_product"],
    ["t", "scrutiny_v03"],
    ["i", "cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"],
    ["i", "cc:BSI-DSZ-CC-0674-2011"],
    ["L", "scrutiny:product:vendor"],
    ["l", "NXP", "scrutiny:product:vendor"],
    ["L", "scrutiny:product:name"],
    ["l", "J3A080", "scrutiny:product:name"],
    ["L", "scrutiny:product:version"],
    ["l", "3", "scrutiny:product:version"],
    ["L", "scrutiny:product:category"],
    ["l", "smartcard", "scrutiny:product:category"],
    ["L", "scrutiny:product:form_factor"],
    ["l", "dual_interface", "scrutiny:product:form_factor"],
    ["L", "scrutiny:product:status"],
    ["l", "active", "scrutiny:product:status"],
    ["L", "scrutiny:product:release_date"],
    ["l", "2011-08-15", "scrutiny:product:release_date"],
    ["L", "scrutiny:product:ecc_curves"],
    ["l", "P-256", "scrutiny:product:ecc_curves"],
    ["l", "P-384", "scrutiny:product:ecc_curves"],
    ["L", "scrutiny:product:crypto_suite"],
    ["l", "RSA_ECC_AES_3DES_SHA256", "scrutiny:product:crypto_suite"],
    ["L", "scrutiny:product:datasheet_url"],
    ["l", "https://www.nxp.com/docs/en/data-sheet/J3A080.pdf", "scrutiny:product:datasheet_url"],
    ["alt", "ProductEvent: NXP J3A080 v3 smartcard"]
  ],
  "sig": "signature_hex..."
}
```

### 14.2 MetadataEvent Example (Vulnerability)

```json
{
  "id": "def456...",
  "kind": 1,
  "pubkey": "researcher_pubkey_hex...",
  "created_at": 1708570000,
  "content": "CVE-2024-1234: Timing side-channel vulnerability in RSA implementation\n\nA timing side-channel attack allows recovery of private keys through careful measurement of RSA signature operations. Affects firmware versions 3.x.\n\nFull report: https://example.com/reports/cve-2024-1234.pdf\n\n#vulnerability #CVE #RSA #sidechannel",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_metadata"],
    ["t", "scrutiny_v03"],
    ["i", "cve:2024-1234"],
    ["i", "cwe:208"],
    ["r", "https://example.com/reports/cve-2024-1234.pdf"],
    ["r", "https://mirror.example.org/cve-2024-1234.pdf"],
    ["x", "a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"],
    ["m", "application/pdf"],
    ["size", "524288"],
    ["L", "scrutiny:metadata:measurement_category"],
    ["l", "vulnerability", "scrutiny:metadata:measurement_category"],
    ["L", "scrutiny:metadata:measurement_type"],
    ["l", "timing_attack", "scrutiny:metadata:measurement_type"],
    ["L", "scrutiny:metadata:source"],
    ["l", "Independent Security Researcher", "scrutiny:metadata:source"],
    ["L", "scrutiny:metadata:date"],
    ["l", "2024-02-15", "scrutiny:metadata:date"],
    ["L", "scrutiny:metadata:vuln:cvss_score"],
    ["l", "7.5", "scrutiny:metadata:vuln:cvss_score"],
    ["L", "scrutiny:metadata:vuln:severity"],
    ["l", "high", "scrutiny:metadata:vuln:severity"],
    ["alt", "CVE-2024-1234: Timing side-channel in RSA implementation"]
  ],
  "sig": "signature_hex..."
}
```

### 14.3 BindingEvent Examples

#### Example A: Directed (vulnerability_in)

```json
{
  "id": "ghi789...",
  "kind": 1,
  "pubkey": "curator_pubkey_hex...",
  "created_at": 1708580000,
  "content": "CVE-2024-1234 affects NXP J3A080 v3\n\nThis vulnerability (timing side-channel in RSA) has been confirmed to affect the J3A080 smartcard firmware version 3.x. Users should apply the security patch or migrate to version 4.x.\n\nVulnerability report: nostr:note1def456...\nAffected product: nostr:note1abc123...\n\n#vulnerability #NXP #security",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_binding"],
    ["t", "scrutiny_v03"],
    ["e", "def456...", "", "root"],
    ["e", "abc123...", "", "reply"],
    ["L", "scrutiny:binding:relationship"],
    ["l", "vulnerability_in", "scrutiny:binding:relationship"],
    ["L", "scrutiny:binding:scope"],
    ["l", "Affects firmware version 3.x only", "scrutiny:binding:scope"],
    ["L", "scrutiny:binding:confidence"],
    ["l", "high", "scrutiny:binding:confidence"],
    ["alt", "Binding: CVE-2024-1234 affects NXP J3A080 v3"]
  ],
  "sig": "signature_hex..."
}
```

Interpretation: Metadata event `def456` (CVE report) describes a vulnerability in Product event `abc123` (J3A080).

#### Example B: Directed (contains)

```json
{
  "id": "jkl012...",
  "kind": 1,
  "pubkey": "vendor_pubkey_hex...",
  "created_at": 1708590000,
  "content": "NXP J3A080 contains STMicroelectronics Secure Element\n\nThe J3A080 smartcard integrates an ST33K1M5 secure element as its cryptographic coprocessor.\n\nContainer product: nostr:note1abc123...\nComponent product: nostr:note1xyz789...\n\n#hardware #component",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_binding"],
    ["t", "scrutiny_v03"],
    ["e", "abc123...", "", "root"],
    ["e", "xyz789...", "", "reply"],
    ["L", "scrutiny:binding:relationship"],
    ["l", "contains", "scrutiny:binding:relationship"],
    ["alt", "Binding: J3A080 contains ST33K1M5 secure element"]
  ],
  "sig": "signature_hex..."
}
```

Interpretation: Product `abc123` (J3A080) contains Product `xyz789` (ST33K1M5).

#### Example C: Symmetric (same_as)

```json
{
  "id": "mno345...",
  "kind": 1,
  "pubkey": "curator_pubkey_hex...",
  "created_at": 1708600000,
  "content": "Identity link: NXP J3A080 v3 (two catalog entries)\n\nThese two ProductEvents refer to the same physical product (NXP J3A080 version 3), listed under different catalog systems.\n\nProduct A: nostr:note1abc123...\nProduct B: nostr:note1pqr678...\n\n#identity #duplicate",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_binding"],
    ["t", "scrutiny_v03"],
    ["e", "abc123...", "", "reply"],
    ["e", "pqr678...", "", "reply"],
    ["L", "scrutiny:binding:relationship"],
    ["l", "same_as", "scrutiny:binding:relationship"],
    ["alt", "Binding: Products abc123 and pqr678 are the same"]
  ],
  "sig": "signature_hex..."
}
```

Interpretation: Products `abc123` and `pqr678` are the same entity (unordered pair).

### 14.4 UpdateEvent Example (Correction)

```json
{
  "id": "stu678...",
  "kind": 1,
  "pubkey": "researcher_pubkey_hex...",
  "created_at": 1708610000,
  "content": "Correction to CVE-2024-1234 report\n\nThe originally reported affected version was incorrect. The vulnerability affects firmware version 3.0.1 specifically, not all 3.x versions. Version 3.0.0 and 3.0.2+ are not affected.\n\nOriginal report: nostr:note1def456...",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_update"],
    ["t", "scrutiny_v03"],
    ["e", "def456...", "", "root"],
    ["e", "def456...", "", "reply"],
    ["L", "scrutiny:update:change_type"],
    ["l", "correction", "scrutiny:update:change_type"],
    ["L", "scrutiny:update:reason"],
    ["l", "Corrected affected version range after further testing", "scrutiny:update:reason"],
    ["L", "scrutiny:binding:scope"],
    ["l", "Affects firmware version 3.0.1 only", "scrutiny:binding:scope"],
    ["alt", "Update: Correction to CVE-2024-1234 affected versions"]
  ],
  "sig": "signature_hex..."
}
```

If the UpdateEvent pubkey matches the original MetadataEvent pubkey (def456), clients compute an effective view with the corrected scope.

### 14.5 UpdateEvent Example (Retraction)

```json
{
  "id": "vwx901...",
  "kind": 1,
  "pubkey": "researcher_pubkey_hex...",
  "created_at": 1708620000,
  "content": "Retraction of CVE-2024-1234 report\n\nAfter further analysis, I was unable to replicate the reported timing side-channel under realistic conditions. The original finding was based on a measurement error. I am retracting this vulnerability report.\n\nRetracted report: nostr:note1def456...\n\n#retraction",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_update"],
    ["t", "scrutiny_v03"],
    ["e", "def456...", "", "root"],
    ["e", "def456...", "", "reply"],
    ["L", "scrutiny:update:change_type"],
    ["l", "retraction", "scrutiny:update:change_type"],
    ["L", "scrutiny:update:reason"],
    ["l", "Unable to replicate; measurement error in original analysis", "scrutiny:update:reason"],
    ["alt", "Update: Retraction of CVE-2024-1234"]
  ],
  "sig": "signature_hex..."
}
```

Clients should mark event `def456` as RETRACTED and hide it by default.

---

## 15. Implementation Guidance

### 15.1 For SCRUTINY Client Developers

**Minimum viable client:**
1. Display ProductEvents with labels rendered as key-value pairs
2. Query for BindingEvents referencing a product (`#e` tag query)
3. Apply whitelist filter to BindingEvents
4. Fetch and display admitted MetadataEvents
5. Support basic search (by CPE/vendor/name)

**Full-featured client:**
- Compute effective views (apply authoritative updates)
- Verify artifact hashes (r/x tags)
- Graph visualization
- NIP-50 full-text search
- PoW ranking
- Zap/reaction display

### 15.2 For SCRUTINY Relay Operators

**Recommended relay features:**
- Index `#t`, `#i`, `#e` tags (standard)
- Implement NIP-50 full-text search over `content` and tags
- Optionally index NIP-32 labels for advanced filtering
- Support PoW filtering (NIP-13)

### 15.3 For Metadata Producers

**Publishing workflow:**
1. Create MetadataEvent with detailed `content` and labels
2. Upload artifact to stable HTTPS hosting (+ Blossom mirror)
3. Include `r/x/m/size` tags with correct SHA-256
4. Publish MetadataEvent to multiple relays
5. Create BindingEvents linking metadata to relevant products
6. Monitor for questions/disputes; publish UpdateEvents if needed

**Best practices:**
- Use high PoW for important metadata (harder to fake)
- Include detailed context in `content` (generic client UX)
- Mirror artifacts at multiple URLs
- Respond to disputes with clarifications or retractions

### 15.4 For Product Vendors

**Bootstrapping product presence:**
1. Create ProductEvent with complete labels (vendor/name/version/category)
2. Include CPE/PURL in `i` tags if available
3. Link to official documentation (datasheets, manuals)
4. Publish certifications as MetadataEvents + BindingEvents
5. Maintain ProductEvents for all supported versions

**Responding to vulnerabilities:**
- Publish patch/update as new ProductEvent
- Create BindingEvent linking patch to vulnerability (`patch_for`)
- Publish UpdateEvent to deprecate old ProductEvent

---

## 16. Risks & Mitigations

### 16.1 Spam & Malicious Bindings

**Risk:** Attackers publish fake BindingEvents linking random products to fake vulnerabilities.

**Mitigations:**
- Whitelist-based trust model filters out untrusted actors
- PoW requirements increase spam cost
- Reporting (NIP-56) flags malicious content
- Competing BindingEvents (`contests` relationship) allow disputes

### 16.2 Key Compromise

**Risk:** A trusted pubkey is compromised; attacker publishes malicious content.

**Mitigations:**
- Users maintain multiple trusted sources (no single point of failure)
- UpdateEvents allow legitimate owner to retract compromised events
- Future: Key rotation/revocation schemes

### 16.3 Artifact Tampering

**Risk:** Attacker modifies artifact at URL; users download malicious file.

**Mitigations:**
- Hash verification (`x` tag) detects tampering
- Multiple mirrors (`r` tags) provide redundancy
- Blossom content-addressed storage eliminates URL-based tampering

### 16.4 Low Adoption

**Risk:** Not enough producers contribute metadata.

**Mitigations:**
- Bootstrap with existing datasets (CVEs, sec-certs, jcalgtest)
- Mirror existing databases into SCRUTINY format

### 16.5 Relay Censorship

**Risk:** Relays refuse to store/serve certain events.

**Mitigations:**
- Users can add multiple relays (including self-hosted)
- Events can be re-broadcasted from backups (Git, IPFS, etc.)
- Permissionless design means anyone can run a relay

---

## 17. Future Work

- **Key rotation/revocation:** Secure migration to new keys after compromise
- **Delegation:** Allow organizations to delegate signing authority
- **Aggregate metrics:** Automatic computation of product security scores
- **Integration with NIP-34 (Git patches):** Link product updates to code diffs
- **NIP-54 (Wiki) integration:** Collaborative product documentation

---

## 18. References

- [NIP-01](https://nips.nostr.com/1) — Basic Protocol
- [NIP-10](https://nips.nostr.com/10) — Event Markers (root/reply/mention)
- [NIP-13](https://nips.nostr.com/13) — Proof of Work
- [NIP-25](https://nips.nostr.com/25) — Reactions
- [NIP-31](https://nips.nostr.com/31) — Alt Tag (Accessibility)
- [NIP-32](https://nips.nostr.com/32) — Labeling
- [NIP-50](https://nips.nostr.com/50) — Search Capability
- [NIP-56](https://nips.nostr.com/56) — Reporting
- [NIP-57](https://nips.nostr.com/57) — Lightning Zaps
- [NIP-94](https://nips.nostr.com/94) — File Metadata
- [Blossom Protocol](https://github.com/hzrd149/blossom) — Blob Storage
