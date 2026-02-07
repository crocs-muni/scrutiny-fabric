# SCRUTINY Fabric — Event Specification v0.3

A permissionless, decentralized metadata overlay protocol built on Nostr (NIP-01) for binding security-relevant metadata to products. SCRUTINY Fabric uses standard Nostr `kind: 1` events for maximum client compatibility and relies on tags + NIP-32 labels for structure.

This spec defines **four** SCRUTINY event types:

- **ProductEvent** — anchor node for a specific product/model/version
- **MetadataEvent** — security-relevant information node (tests, vulns, certs, audits, reviews, replications, disputes, etc.)
- **BindingEvent** — generic typed edge between two SCRUTINY events
- **UpdateEvent** — auditable updates to an existing SCRUTINY event (including retraction)

---

## 1. Core principles

- **Permissionless:** anyone can publish events
- **Auditable:** append-only via UpdateEvents (reply pattern)
- **Verifiable:** Nostr signatures + file hash verification for external artifacts
- **Interoperable:** events remain valid Nostr text notes

---

## 2. Protocol identifiers (required)

All SCRUTINY Fabric events MUST include these `t` tags:

```python
["t", "scrutiny_fabric"]  # Namespace marker
["t", "scrutiny_v03"]     # Protocol version
["t", "scrutiny_<type>"]  # scrutiny_product | scrutiny_metadata | scrutiny_binding | scrutiny_update
```

---

## 3. Labels (NIP-32)

SCRUTINY uses NIP-32 label namespaces with colon notation:

```text
scrutiny:<category>:<field>
```

Labels are encoded using:

- Declaration: `["L", "<namespace>"]`
- Values: `["l", "<value>", "<namespace>"]`

Example:

```python
["L", "scrutiny:product:vendor"],
["l", "NXP", "scrutiny:product:vendor"],
```

---

## 4. Event Type: ProductEvent

**Type tag:** `scrutiny_product`  
**Nostr kind:** `1`  
**Purpose:** immutable anchor representing a specific product release/model/version. This is the primary discovery object.

### 4.1 Required

- `content` (human-readable title/description + protocol hashtags)
- `t` tags:
  - `scrutiny_fabric`
  - `scrutiny_product`
  - `scrutiny_v03`

### 4.2 Recommended labels (non-exhaustive)

- `scrutiny:product:vendor`
- `scrutiny:product:name`
- `scrutiny:product:version`
- `scrutiny:product:category`

### 4.3 Optional labels (examples)

Identity:

- `scrutiny:product:cpe23`
- `scrutiny:product:purl`

Lifecycle:

- `scrutiny:product:status` (`active|archived|eol|deprecated`)
- `scrutiny:product:release_date` (ISO 8601 `YYYY-MM-DD`)
- `scrutiny:product:eol_date` (ISO 8601)
- `scrutiny:product:support_until` (ISO 8601)

Technical + crypto:

- `scrutiny:product:form_factor`, `chip`, memory fields, platform versions
- `scrutiny:product:crypto_suite`, `key_length_max`, `ecc_curves`, `hash_function`

Documentation URLs:

- `scrutiny:product:canonical_url`, `datasheet_url`, `manual_url`, `sdk_url`, `sbom_url`

---

## 5. Event Type: MetadataEvent

**Type tag:** `scrutiny_metadata`  
**Nostr kind:** `1`  
**Purpose:** security-relevant metadata, evidence, claims, or references. Can describe Products, other Metadata, or even Bindings (e.g., critique a specific binding).

Examples:

- test results (timing/power/randomness/side-channel)
- vulnerability disclosures/advisories
- certification reports
- audit reports
- academic research
- replication studies, confirmations, disputes/contestation (modeled as metadata + bindings)

### 5.1 Required

- `content` (human-readable summary + protocol hashtags)
- `t` tags:
  - `scrutiny_fabric`
  - `scrutiny_metadata`
  - `scrutiny_v03`

### 5.2 File reference (for external artifacts)

If the metadata points to an external file, publishers SHOULD include:

- `["r", "https://..."]` (MUST be HTTPS if present)
- `["x", "<sha256hex>"]` (SHA-256; MUST be exactly 64 hex chars if present)
- `["m", "<mime_type>"]` (recommended)
- `["size", "<bytes>"]` (recommended)

### 5.3 Suggested metadata classification labels (optional)

- `scrutiny:metadata:measurement_category` (e.g. `timing|power|randomness|sidechannel|vulnerability|certification|audit|analysis|review`)
- `scrutiny:metadata:measurement_type`
- `scrutiny:metadata:tool`, `tool_version`, `tool_vendor`, `tool_config`
- `scrutiny:metadata:source`, `lab`, `operator`, etc.
- Vulnerability fields: `scrutiny:metadata:vuln:*` (CVE/CWE/CVSS/etc.)
- Certification fields: `scrutiny:metadata:cert:*`

### 5.4 Hash verification rule (client requirement)

If both `r` and `x` are present, clients MUST verify that the fetched file’s SHA-256 equals the `x` value before treating the artifact as authentic.

Clients MAY still display unverified artifacts, but MUST clearly label them as unverified.

---

## 6. Event Type: BindingEvent

**Type tag:** `scrutiny_binding`  
**Kind:** `1`  
**Purpose:** typed relationship between SCRUTINY events (Product/Metadata/Binding).

### 6.1 Required
- `content`
- `t` tags: `scrutiny_fabric`, `scrutiny_binding`, `scrutiny_v03`
- Endpoint `e` tags (Section 6.3)

### 6.2 Relationship label (optional-ish)

Publishers SHOULD include a relationship label using NIP-32 labels:

- `["L","scrutiny:binding:relationship"]`
- `["l","<value>","scrutiny:binding:relationship"]`

If a BindingEvent does NOT include any `scrutiny:binding:relationship` label, clients MUST interpret the binding relationship as the default value `related_to`.

For BindingEvents, authoritative updates MUST NOT add, change, or remove `scrutiny:binding:relationship` (even if it was missing originally); if the relationship was omitted or wrong, remediate by retracting the BindingEvent via an authoritative UpdateEvent and publishing a new BindingEvent with the correct relationship.

### 6.3 Endpoints (NIP-10 marked `e` tags)

Encode endpoints using NIP-10 marked `e` tags:

`["e", "<event-id>", "<relay-or-empty>", "<marker>", "<pubkey-optional>"]`

#### 6.3.1 1:1 (recommended)
Publishers SHOULD include exactly **two** endpoint `e` tags.

#### 6.3.2 Directional bindings (A → B)
For directional relationships (e.g., `contains`, `depends_on`, `supersedes`, `vulnerability_in`, `patch_for`):

- Endpoint **A** MUST use marker `"root"`
- Endpoint **B** MUST use marker `"reply"`

Interpretation: **root → reply**.

#### 6.3.3 Symmetric bindings (unordered)
For symmetric relationships (e.g., `same_as`):

- Both endpoints MUST use marker `"reply"` (not `"root"`)

Interpretation: unordered pair.

### 6.4 Relationship values (recommended set)
- Generic (default): `related_to`
- Evidence links: `test_of`, `benchmark_of`, `audit_of`, `analysis_of`, `documentation_of`, `certification_of`, `vulnerability_in`, `patch_for`
- Product graph: `contains`, `depends_on`, `supersedes`
- Review graph: `confirms`, `contests`, `refutes`, `replicates`, `supersedes`
- Identity (symmetric): `same_as`

Unknown values MAY be displayed as generic links.

### 6.5 Optional context labels
- `scrutiny:binding:scope`
- `scrutiny:binding:limitations`
- `scrutiny:binding:not_valid_before`
- `scrutiny:binding:not_valid_after`

---

## 7. Event Type: UpdateEvent (effective view + retraction)

**Type tag:** `scrutiny_update`  
**Nostr kind:** `1`  
**Purpose:** append-only updates to an existing SCRUTINY event.

UpdateEvents can target ProductEvents, MetadataEvents, and BindingEvents.

### 7.1 Required

- `content` (human-readable update description + hashtags)
- `t` tags:
  - `scrutiny_fabric`
  - `scrutiny_update`
  - `scrutiny_v03`
- NIP-10 reply tags referencing the target:
  - `["e", "<target_event_id>", "", "root"]`
  - `["e", "<target_event_id>", "", "reply"]`

### 7.2 Recommended labels

- `scrutiny:update:change_type` = `correction|addition|clarification|deprecation|retraction`
- optional: `scrutiny:update:reason`

### 7.3 Authoritative update rule

**Authoritative updates are only those signed by the same pubkey as the target event.**

- If `UpdateEvent.pubkey == TargetEvent.pubkey`: authoritative
- Else: non-authoritative annotation (clients MAY display but MUST NOT modify effective state by default)

### 7.4 Effective view computation

Clients compute an “effective view” of an event by applying **authoritative** UpdateEvents:

- Sort authoritative updates by:
  1. `created_at` ascending
  2. `id` ascending (tie-break)

### 7.5 Effective view merge semantics

Clients compute an effective view by applying authoritative updates in order (Section 7.4) using these deterministic merge rules:

A) **NIP-32 labels (`L`/`l`): namespace replacement**

- For each label namespace `N` (e.g., `scrutiny:product:vendor`), if an authoritative UpdateEvent contains one or more `l` labels of the form `["l", value, N]`, the client MUST replace the entire prior value-set for namespace `N` with the set present in that UpdateEvent.
- If an authoritative UpdateEvent does not mention namespace `N`, the effective view retains the previous value-set for `N`.

B) **Non-NIP-32 tags (e.g., `r`, `x`, `m`, `size`, `alt`): tag-name replacement**

Clients MUST NOT apply UpdateEvent `t` tags to the target’s effective view; the target event’s `t` tags (including `scrutiny_fabric`, `scrutiny_v03`, and `scrutiny_<type>`) are immutable under updates for effective-view computation.

- If an authoritative UpdateEvent contains one or more tags with a given tag name (e.g., one or more `r` tags), the client MUST replace all prior tags of that tag name on the target with the set present in that UpdateEvent.
- If an authoritative UpdateEvent has no tags of that name, the effective view retains the prior tags of that name.

### 7.6 Binding immutability rule

**Endpoints + relationship of a BindingEvent are immutable.**

- Updates MAY add or change context fields (e.g., limitations, scope, validity window)
- Updates MUST NOT change:
  - endpoint IDs (A/B)
  - `scrutiny:binding:relationship`

If a binding is wrong, it MUST be corrected by an authoritative UpdateEvent with:

- `scrutiny:update:change_type = retraction`

and then (optionally) publishing a new correct BindingEvent.

### 7.7 Retraction semantics (recommended client behavior)

If an authoritative UpdateEvent sets `change_type = retraction`, clients SHOULD:

- mark the target event as **RETRACTED**
- hide it by default in normal views
- keep it accessible via a “history / retracted” view

This provides soft deletion while preserving history.

---

## 8. Cross-cutting concerns

### 8.1 Proof-of-Work (NIP-13) (recommended)

Events MAY include a `nonce` tag with a chosen difficulty:

```python
["nonce", "<random_number>", "n"]
```

Clients MAY downrank events with low/no PoW.

### 8.2 Accessibility (NIP-31) (recommended)

Events SHOULD include an `alt` tag:

```python
["alt", "One-line plain text summary"]
```

### 8.3 NIP-09 deletions

SCRUTINY Fabric does not require NIP-09 deletion for protocol correctness. Clients MAY optionally consume NIP-09 as an interoperability hint, but SCRUTINY’s primary “removal” mechanism is `UpdateEvent(change_type=retraction)` to preserve audit history.

### 8.4 Index/search tags (`i` and `s`) (recommended)

To improve discoverability on typical Nostr relays, clients and publishers MAY use two optional tag keys:

- `i` for exact external identifiers (CPE/PURL/CVE/etc.)
- `s` for best-effort fuzzy human search tokens (vendor/product/category/tool)

These tags are **additive** and do not change the NIP-32 label rules (Section 3). They are not required for protocol correctness.

#### 8.4.1 Tag key `i` (identifier tags)

- Publishers SHOULD include one or more `["i", "<id>"]` tags for canonical external identifiers.
- The `<id>` string MUST use `prefix:value` format and SHOULD be lowercased where applicable.

Recommended prefixes and examples:

- CPE 2.3: `["i", "cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"]`
- PURL:    `["i", "purl:pkg:github/openssl/openssl@3.0.0"]`
- CVE:     `["i", "cve:2024-1234"]`
- CWE:     `["i", "cwe:120"]`
- Common Criteria cert id: `["i", "cc:BSI-DSZ-CC-0674-2011"]`

Scope guidance:

- ProductEvents SHOULD emit `i` tags for `cpe` / `purl` if known.
- MetadataEvents SHOULD emit `i` tags for `cve` / `cwe` / certification IDs if known.
- BindingEvents MAY include `i` tags if helpful for indexing, but SHOULD NOT be required.

#### 8.4.2 Tag key `s` (search tokens)

- Publishers SHOULD include one or more `["s", "<token>"]` tags as fuzzy human search tokens.
- Tokens SHOULD be lowercase, short, and safe for tag matching.

Examples:

- vendor token: `["s", "nxp"]`
- product token: `["s", "j3a080"]`
- category token: `["s", "smartcard"]`
- tool token: `["s", "jcalgtest"]`

Recommended tokenization guidance (best-effort):

- trim whitespace
- lowercase
- replace spaces with `_` (or remove spaces) consistently
- avoid punctuation where possible

Token generation is a client/publisher convenience and is not required for correctness.

#### 8.4.3 Query guidance (standard Nostr filters)

Clients can combine protocol type tags with `i` / `s` tags using standard Nostr filters:

- Find ProductEvent by CPE:

  `{ "kinds": [1], "#t": ["scrutiny_product"], "#i": ["cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"] }`

- Find ProductEvents by vendor token:

  `{ "kinds": [1], "#t": ["scrutiny_product"], "#s": ["nxp"] }`

- Find MetadataEvents by CVE:

  `{ "kinds": [1], "#t": ["scrutiny_metadata"], "#i": ["cve:2024-1234"] }`

---

## 9. Implementation notes (client trust/discovery)

- Clients typically start from a ProductEvent anchor, then fetch bindings that mention it, then fetch connected nodes.
- Clients SHOULD rank edges and nodes higher based on:
  - BindingEvent author pubkey is whitelisted/followed
  - multiple trusted authors assert similar bindings
  - PoW meets threshold
