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
["t", "scrutiny_<type>"]
```

Where `<type>` is one of: `product`, `metadata`, `binding`, `update`, `retract`.

All SCRUTINY Fabric events SHOULD include a version marker:

```json
["t", "scrutiny_v03"]
```

**Rationale:** The `scrutiny_fabric` tag enables broad filtering; the type tag enables type-specific queries; the version tag supports future protocol evolution.

---

## 3. Event Types

SCRUTINY Fabric defines five event types, all using `kind: 1`:

- **ProductEvent:** Anchor node representing a specific product/model/version
- **MetadataEvent:** Security-relevant information node (tests, vulnerabilities, certifications, audits, reviews)
- **BindingEvent:** Typed edge connecting two events (Product↔Metadata, Product↔Product, Metadata↔Metadata)
- **UpdateEvent:** Auditable modification of an existing SCRUTINY event
- **RetractionEvent:** Auditable withdrawal of an existing SCRUTINY event

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

MetadataEvents MAY reference external artifacts (files, reports, datasets) using artifact reference tags (Section 10).

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

See Section 10 for complete artifact reference rules. Brief summary:

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

Authoritative UpdateEvents (Section 7) MAY add or modify context labels (scope, limitations, validity window), but MUST NOT:
- Change endpoint event IDs
- Add, remove, or change the `scrutiny:binding:relationship` label

If a binding is incorrect, the author MUST:
1. Publish an authoritative RetractionEvent for the incorrect BindingEvent
2. Optionally publish a new corrected BindingEvent

---

## 7. UpdateEvent

**Purpose:** Append-only modification of an existing SCRUTINY event. Preserves audit history while allowing the original author to correct or enhance their event.

### 7.1 Required Fields

- **kind:** `1`
- **content:** Human-readable commit message explaining what changed and why. This message is displayed in generic Nostr clients when the update appears as a reply.
- **tags:**
  - `["t", "scrutiny_fabric"]` (REQUIRED)
  - `["t", "scrutiny_update"]` (REQUIRED)
  - `["t", "scrutiny_v03"]` (RECOMMENDED)
  - `["e", "<target_event_id>", "", "root"]` (REQUIRED)

### 7.2 Content Field Semantics

The `content` field is a **commit message** explaining what changed and why. It is shown as reply text and does not replace the target event's content. To replace content, use the `scrutiny:update:content` label (Section 7.5).

**Example:** "Fixed typo in vendor name: 'Vendr' → 'Vendor'"

### 7.3 Authoritative Updates

**An UpdateEvent is authoritative if and only if:**

```
UpdateEvent.pubkey == TargetEvent.pubkey
```

**Authoritative updates** are merged into the effective view of the target event (Section 7.6).

**Non-authoritative updates** are ignored during effective view computation.

### 7.4 Update Ordering

Apply authoritative updates in deterministic order: sort by `created_at` ascending; tie-break by lexicographic `id` ascending.

### 7.5 Updateable Fields

UpdateEvents can modify these fields of the effective view:

#### A. NIP-32 Labels (L/l tags)

Labels are updated via **namespace replacement**. Include any labels you want to change:

```json
["L", "scrutiny:product:vendor"],
["l", "NXP Semiconductors", "scrutiny:product:vendor"]
```

**Merge rule:** For each label namespace present in the UpdateEvent, replace all values in the effective view with the UpdateEvent's values for that namespace. Label namespaces NOT present in the UpdateEvent are preserved unchanged.

**Example — Updating ECC curves:**

UpdateEvent contains:
```json
["L", "scrutiny:product:ecc_curves"],
["l", "P-256", "scrutiny:product:ecc_curves"],
["l", "P-384", "scrutiny:product:ecc_curves"],
["l", "Curve25519", "scrutiny:product:ecc_curves"]
```

Result: The effective view's `scrutiny:product:ecc_curves` namespace is replaced with these three values. Other label namespaces are preserved.

#### B. Content Field

To replace the effective view's content, include a content update label:

```json
["L", "scrutiny:update:content"],
["l", "<new_content>", "scrutiny:update:content"]
```

**Merge rule:** If the UpdateEvent contains a `scrutiny:update:content` label, replace the effective view's content with the label's value. If no such label is present, preserve the effective view's current content.

**Example:**
```json
["L", "scrutiny:update:content"],
["l", "NXP J3A080 v3 (EOL) — Dual-interface smartcard, formerly EAL4+ certified", "scrutiny:update:content"]
```

#### C. Non-Label Tags (r, x, m, size, i)

Artifact reference tags and canonical identifier tags are updated via **tag-type replacement**:

```json
["r", "https://new-mirror.example.com/report.pdf"],
["x", "abc123..."],
["m", "application/pdf"]
```

**Merge rule:** For each tag type (e.g., `r`, `x`, `m`, `size`, `i`) present in the UpdateEvent, replace all tags of that type in the effective view with the UpdateEvent's tags of that type. Tag types NOT present in the UpdateEvent are preserved unchanged.

### 7.6 Immutable Fields

The following fields are **immutable** and cannot be modified by UpdateEvents:

- Protocol identification tags (`t` tags including `scrutiny_fabric`, `scrutiny_v03`, `scrutiny_product`, etc.)
- Event kind
- Event pubkey
- Event ID
- `created_at` timestamp

If any of these need to change, the author must retract the event and publish a new one.

### 7.7 Merge Rules Summary

To compute the effective view (authoritative updates only):

- Start with the target event's content and tags.
- For each update in order:
  - Replace any label namespaces present in the update (Section 7.5.A).
  - Replace content only if `scrutiny:update:content` is present (Section 7.5.B).
  - Replace tag types present (`r`, `x`, `m`, `size`, `i`) (Section 7.5.C).
- Immutable fields never change (Section 7.6).

### 7.8 Example

```json
{
  "kind": 1,
  "pubkey": "author_pubkey_hex...",
  "created_at": 1708590000,
  "content": "Product status changed to EOL as of 2024-01-15.",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_update"],
    ["t", "scrutiny_v03"],
    ["e", "abc123...", "", "root"],
    ["L", "scrutiny:product:status"],
    ["l", "eol", "scrutiny:product:status"],
    ["L", "scrutiny:product:eol_date"],
    ["l", "2024-01-15", "scrutiny:product:eol_date"],
    ["L", "scrutiny:update:content"],
    ["l", "NXP J3A080 v3 (EOL) — Dual-interface smartcard. End of life: 2024-01-15.", "scrutiny:update:content"]
  ],
  "sig": "signature_hex..."
}
```

---

## 8. RetractionEvent

**Purpose:** Append-only withdrawal of an existing SCRUTINY event. Marks an event as retracted while preserving it in the audit trail.

### 8.1 Required Fields

- **kind:** `1`
- **content:** Human-readable explanation of why the event is being retracted. This explanation is critical for transparency.
- **tags:**
  - `["t", "scrutiny_fabric"]` (REQUIRED)
  - `["t", "scrutiny_retract"]` (REQUIRED)
  - `["t", "scrutiny_v03"]` (RECOMMENDED)
  - `["e", "<target_event_id>", "", "root"]` (REQUIRED)

### 8.2 Authoritative Retraction

**A RetractionEvent is authoritative if and only if:**

```
RetractionEvent.pubkey == TargetEvent.pubkey
```

Only the original author can retract their event.

### 8.3 Retraction Semantics

When an authoritative RetractionEvent targets an event, clients SHOULD:

1. **Mark the target event as RETRACTED**
2. **Hide the target event in normal views by default**
3. **Preserve the target event in audit/history views**
4. **Display the retraction explanation** if users explicitly navigate to the retracted event

### 8.4 Retraction is Irreversible

Once an event is retracted, it cannot be "un-retracted." If an author retracts in error, they should publish a new event with the correct information.

### 8.5 Example

```json
{
  "kind": 1,
  "pubkey": "researcher_pubkey_hex...",
  "created_at": 1708620000,
  "content": "I am retracting this vulnerability report. After further analysis and peer review, I was unable to replicate the timing side-channel attack under realistic operating conditions. The original finding was based on a measurement artifact in my test setup. I apologize for any confusion caused.",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_retract"],
    ["t", "scrutiny_v03"],
    ["e", "def456...", "", "root"]
  ],
  "sig": "signature_hex..."
}
```


---

## 9. Field Encoding Rules

### 9.1 NIP-32 Self-Labeling for Categorical Fields

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

### 9.2 Canonical Identifiers (i tags)

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
- `i` tags are immutable

---

## 10. Artifact References & Verification

MetadataEvents often reference external artifacts (reports, datasets, power traces, test results).

### 10.1 Baseline Artifact Reference

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

### 10.3 Multiple URLs

If an artifact is mirrored at multiple locations, include multiple `r` tags:

```json
["r", "https://primary.example.com/file.pdf"],
["r", "https://mirror1.example.org/file.pdf"],
["r", "https://mirror2.example.net/file.pdf"]
```

### 10.4 Blossom Protocol Support

**Blossom** is a protocol for storing blobs on media servers with hash-based addressing.

SCRUTINY Fabric supports Blossom URLs in `r` tags:

```json
["r", "https://blossom.example.com/<sha256_hex>"],
["x", "<sha256_hex>"]
```

**Blossom relay discovery:** Clients MAY discover Blossom servers via NIP-34 or other mechanisms (out of scope for this spec).

### 10.5 Large Files

For very large artifacts (>100MB), publishers SHOULD:
- Use Blossom or dedicated artifact hosting
- Include multiple mirror URLs
- Consider splitting artifacts or providing summary excerpts in the `content` field

---

## 11. Trust & Admission Semantics

SCRUTINY Fabric uses a **whitelist-based trust model** where users define which pubkeys they trust, and nodes are "admitted" into their view based on trusted references.

### 11.1 User Trust Configuration

Each user maintains:
- **Whitelist:** Set of trusted pubkeys (follow list)
- **Trust depth:** How many hops to traverse (typically 1 or 2)

Trust depth 1: Only events published by whitelisted pubkeys  
Trust depth 2: Events published by whitelisted pubkeys + events published by their follows

### 11.2 Admission Rule (Direction A: Trust the Edges)

**A node N is "admitted" into a user's view if:**

1. N is published by a whitelisted pubkey, OR
2. N is referenced by an `e` tag inside a BindingEvent published by a whitelisted pubkey

**"Referenced" means:** The node's event ID appears in an `["e", ...]` tag in a trusted BindingEvent.

**Rationale:** Many valuable nodes (products, metadata) exist but are not connected. Trusted curators publish BindingEvents that vouch for nodes, even if the node authors themselves are unknown.

### 11.3 Ranking & Scoring

Clients MAY rank admitted nodes by:
- **Trust score:** Number of distinct trusted pubkeys that reference the node
- **PoW difficulty:** Higher difficulty = higher rank (optional, see Section 14)
- **Recency:** Newer events ranked higher
- **User reactions:** Zaps (NIP-57), reactions (NIP-25) from trusted pubkeys

### 11.4 Repost as Admission Edge (Optional)

Clients MAY treat Nostr reposts (`kind: 6` or `kind: 16`) by trusted pubkeys as admission edges:

- If a trusted pubkey reposts a SCRUTINY event, admit that event into view

This is optional; conservative clients may require explicit BindingEvents.

### 11.5 Filtering & Queries

Users can further filter admitted nodes by:
- Product vendor/category
- Metadata type/source
- Date range
- Relationship type (when traversing bindings)

---

## 12. Discovery & Graph Traversal

### 12.1 Node-First Traversal Algorithm

**Starting from a ProductEvent:**

1. **Seed:** User searches for a ProductEvent (by CPE, vendor+name, or NIP-50 full-text)
2. **Fetch bindings:** Query for BindingEvents that reference the ProductEvent in an `e` tag:
   ```
   { "kinds": [1], "#t": ["scrutiny_binding"], "#e": ["<product_event_id>"] }
   ```
3. **Filter by trust:** Keep only BindingEvents published by whitelisted pubkeys
4. **Admit referenced nodes:** Extract all `e` tags from trusted BindingEvents; admit those nodes
5. **Recurse:** For each admitted node, repeat steps 2-4 (bounded by trust depth or hop limit)

### 12.2 Relay Query Patterns

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

### 12.3 NIP-50 Full-Text Search

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

### 12.4 Graph Visualization

SCRUTINY clients MAY provide graph visualizations:
- Nodes: Products and Metadata
- Edges: BindingEvents (arrows for directed, lines for symmetric)
- Colors: By trust score or node type
- Interactive: Click to expand node details, traverse edges

---

## 13. Compatibility with Generic Clients

SCRUTINY Fabric events are designed to be readable in standard Nostr clients (Damus, Primal, Amethyst, Snort, Coracle, etc.) without custom support.

### 13.1 ProductEvent in Generic Clients

Displays as a normal text note. The `content` field includes product name/vendor/version. Users can see:
- Author (product vendor or trusted curator)
- Timestamp
- Replies (BindingEvents that reference this product)

### 13.2 MetadataEvent in Generic Clients

Displays as a normal text note with a summary and optional URL. Users see:
- Description of the metadata (vulnerability, test result, certification)
- Link to artifact (if present in `content`)
- Replies (BindingEvents that reference this metadata)

### 13.3 BindingEvent in Generic Clients

Displays as a **reply** to one or both endpoints (depending on relationship type):

- **Directed (A → B):** Appears as a reply to A (root) in thread views
- **Symmetric:** Appears as a reply to both A and B

The `content` field describes the relationship in plain language:

> "This metadata describes a vulnerability in ProductX (CVE-2024-1234)"

Users can see:
- The binding author (who created the link)
- Links to referenced events (if client renders `e` tags)
- Timestamp

### 13.4 UpdateEvent in Generic Clients

Displays as a **reply** to the target event. The `content` field contains the commit message:

> "Fixed typo in vendor name: 'NXP' → 'NXP Semiconductors'. Also added P-384 and Curve25519 curves."

Users can see:
- The update author (who made the change)
- What changed (from the commit message)
- Links to the target event

### 13.5 RetractionEvent in Generic Clients

Displays as a **reply** to the target event. The `content` field explains the retraction:

> "I am retracting this vulnerability report. After further analysis, I was unable to replicate..."

Users can see:
- The retraction author (same as original event author)
- The reason for retraction
- Links to the retracted event

### 13.6 Limitations in Generic Clients

Generic clients will NOT:
- Understand SCRUTINY protocol semantics (relationship types, trust admission)
- Compute effective views (updates merged)
- Verify artifact hashes
- Display SCRUTINY-specific fields (labels, `i` tags) in structured UI

For full SCRUTINY functionality, users need a SCRUTINY-aware client.

---

## 14. Optional Features

### 14.1 Proof-of-Work (NIP-13)

Events MAY include a `nonce` tag to demonstrate computational effort:

```json
["nonce", "<random_number>", "<target_difficulty>"]
```

SCRUTINY clients MAY:
- Require minimum PoW for admission (anti-spam)
- Rank higher-PoW events higher
- Display PoW difficulty to users

PoW is not required for protocol correctness.

### 14.2 Accessibility (NIP-31)

Events SHOULD include an `alt` tag with a plain-text summary for screen readers and clients with limited formatting:

```json
["alt", "ProductEvent: NXP J3A080 v3 smartcard with EAL4+ certification"]
```

### 14.3 Lightning Zaps (NIP-57)

Users MAY zap SCRUTINY events to reward quality contributions. Clients MAY rank zapped events higher.

### 14.4 Reactions (NIP-25)

Users MAY react to SCRUTINY events (`kind: 7`). Clients MAY use reactions as signals for ranking.

### 14.5 Reports (NIP-56)

Users MAY report spam/malicious SCRUTINY events (`kind: 1984`). Clients MAY downrank or hide reported events.

---

## 15. Complete JSON Examples

### 15.1 ProductEvent Example

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

### 15.2 MetadataEvent Example (Vulnerability)

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

### 15.3 BindingEvent Examples

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

### 15.4 UpdateEvent Example

```json
{
  "id": "ghi789...",
  "kind": 1,
  "pubkey": "researcher_pubkey_hex...",
  "created_at": 1708580000,
  "content": "Corrected affected version range. The vulnerability affects firmware 3.0.1 specifically, not all 3.x versions. Versions 3.0.0 and 3.0.2+ are not affected.",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_update"],
    ["t", "scrutiny_v03"],
    ["e", "def456...", "", "root"],
    ["L", "scrutiny:binding:scope"],
    ["l", "Affects firmware version 3.0.1 only", "scrutiny:binding:scope"]
  ],
  "sig": "signature_hex..."
}
```

If the UpdateEvent pubkey matches the original MetadataEvent pubkey (def456), clients compute an effective view with the corrected scope.

### 15.5 RetractionEvent Example

```json
{
  "id": "jkl012...",
  "kind": 1,
  "pubkey": "researcher_pubkey_hex...",
  "created_at": 1708620000,
  "content": "I am retracting this vulnerability report. After further analysis and peer review, I was unable to replicate the timing side-channel under realistic conditions. The original finding was based on a measurement artifact in my test setup.",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_retract"],
    ["t", "scrutiny_v03"],
    ["e", "def456...", "", "root"]
  ],
  "sig": "signature_hex..."
}
```

Clients should mark event `def456` as RETRACTED and hide it by default in normal views. The event remains visible in audit/history views with the retraction explanation.

---

## 16. Implementation Guidance

### 16.1 For SCRUTINY Client Developers

**Minimum viable client:**
1. Display ProductEvents with labels rendered as key-value pairs
2. Compute effective views by applying authoritative UpdateEvents in order
3. Display retracted events only in audit/history views with retraction notice
4. Query for BindingEvents referencing a product (`#e` tag query)
5. Apply whitelist filter to BindingEvents
6. Fetch and display admitted MetadataEvents
7. Support basic search (by CPE/vendor/name)

**Full-featured client:**
- Compute effective views (apply authoritative updates)
- Verify artifact hashes (r/x tags)
- Graph visualization
- NIP-50 full-text search
- PoW ranking
- Zap/reaction display

### 16.2 For SCRUTINY Relay Operators

**Recommended relay features:**
- Index `#t`, `#i`, `#e` tags (standard)
- Implement NIP-50 full-text search over `content` and tags
- Optionally index NIP-32 labels for advanced filtering
- Support PoW filtering (NIP-13)

### 16.3 For Metadata Producers

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

### 16.4 For Product Vendors

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

## 17. Risks & Mitigations

### 17.1 Spam & Malicious Bindings

**Risk:** Attackers publish fake BindingEvents linking random products to fake vulnerabilities.

**Mitigations:**
- Whitelist-based trust model filters out untrusted actors
- PoW requirements increase spam cost
- Reporting (NIP-56) flags malicious content
- Competing BindingEvents (`contests` relationship) allow disputes

### 17.2 Key Compromise

**Risk:** A trusted pubkey is compromised; attacker publishes malicious content.

**Mitigations:**
- Users maintain multiple trusted sources (no single point of failure)
- RetractionEvents allow legitimate owner to retract compromised events
- Future: Key rotation/revocation schemes

### 17.3 Artifact Tampering

**Risk:** Attacker modifies artifact at URL; users download malicious file.

**Mitigations:**
- Hash verification (`x` tag) detects tampering
- Multiple mirrors (`r` tags) provide redundancy
- Blossom content-addressed storage eliminates URL-based tampering

### 17.4 Low Adoption

**Risk:** Not enough producers contribute metadata.

**Mitigations:**
- Bootstrap with existing datasets (CVEs, sec-certs, jcalgtest)
- Mirror existing databases into SCRUTINY format

### 17.5 Relay Censorship

**Risk:** Relays refuse to store/serve certain events.

**Mitigations:**
- Users can add multiple relays (including self-hosted)
- Events can be re-broadcasted from backups (Git, IPFS, etc.)
- Permissionless design means anyone can run a relay

---

## 18. Future Work

- **Key rotation/revocation:** Secure migration to new keys after compromise
- **Delegation:** Allow organizations to delegate signing authority
- **Aggregate metrics:** Automatic computation of product security scores
- **Integration with NIP-34 (Git patches):** Link product updates to code diffs
- **NIP-54 (Wiki) integration:** Collaborative product documentation

---

## 19. References

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
