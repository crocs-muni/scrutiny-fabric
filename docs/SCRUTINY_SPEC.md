#  Protocol - Event Specification v0.2

## 1. Protocol Overview

SCRUTINY Fabric is a permissionless, decentralized metadata overlay protocol built on Nostr (NIP-01) for binding security-relevant metadata to products. All events use `kind: 1` (text notes) for maximum client compatibility.

### 1.1 Core Principles

- **Permissionless:** Anyone can publish events
- **Auditable:** Full history via reply-as-update pattern
- **Verifiable:** Cryptographic signatures + hash verification
- **Interoperable:** Standard Nostr events readable by all clients

### 1.2 Protocol Identifiers

All SCRUTINY Fabric events MUST include these hashtag tags (`t` tags):

```python
["t", "scrutiny_fabric"]  # Namespace marker
["t", "scrutiny_v02"]     # Protocol version
["t", "scrutiny_<type>"]  # Event type (product, metadata, binding, etc.)

```

### 1.3 Label Namespace Convention

SCRUTINY Fabric uses NIP-32 label namespaces with colon notation:

```text
scrutiny:<category>:<field>
```

Examples:

- `scrutiny:product:vendor`
- `scrutiny:metadata:tool`
- `scrutiny:test:date`

---

## 2. Event Type: ProductEvent

**Purpose:** Immutable anchor representing a specific product release, model, or version.

**Event Kind:** `1`

**Use Cases:**

- Certified cryptographic devices
- Smart cards
- Hardware security modules
- Cryptographic libraries
- Security software

### 2.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Human-readable product title and description with protocol hashtags |
| `t` tags | Array | `scrutiny_fabric`, `scrutiny_product`, `scrutiny_v02` |

### 2.2 Recommended Labels

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
| `scrutiny:product:vendor` | Manufacturer name | `"NXP Semiconductors Germany GmbH"` | Required for procurement |
| `scrutiny:product:name` | Product model/name | `"J3A080 Secure Smart Card Controller Revision 3"` | Full official name |
| `scrutiny:product:version` | Version/revision | `"3"` | Semantic version if applicable |
| `scrutiny:product:category` | Device type | `"smartcard"` | Lowercase, underscore-separated |

### 2.3 Optional Labels

#### Identity

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:product:cpe23` | Common Platform Enumeration | `"cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"` |
| `scrutiny:product:purl` | Package URL | `"pkg:github/openssl/openssl@3.0.0"` |

#### Lifecycle

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:product:status` | Current status | `"active"` \| `"archived"` \| `"eol"` \| `"deprecated"` |
| `scrutiny:product:release_date` | Release date (ISO 8601) | `"2011-03-31"` |
| `scrutiny:product:eol_date` | End-of-life date | `"2021-03-31"` |
| `scrutiny:product:support_until` | Support end date | `"2026-03-31"` |

#### Technical Specifications

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:product:form_factor` | Physical form | `"smartcard"` \| `"hsm"` \| `"tpm"` \| `"usb_token"` |
| `scrutiny:product:chip` | Processor/chip model | `"NXP SmartMX2"` |
| `scrutiny:product:memory_ram` | RAM capacity (bytes) | `"10240"` |
| `scrutiny:product:memory_eeprom` | EEPROM capacity (bytes) | `"147456"` |
| `scrutiny:product:javacard_version` | JavaCard version | `"3.0.4"` |
| `scrutiny:product:globalplatform` | GlobalPlatform version | `"2.2.1"` |

#### Cryptographic Capabilities

Multiple labels allowed:

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:product:crypto_suite` | Supported algorithm | `"AES"`, `"RSA"`, `"ECC"` |
| `scrutiny:product:key_length_max` | Maximum key size (bits) | `"4096"` |
| `scrutiny:product:ecc_curves` | Supported curves | `"P-256"`, `"P-384"` |
| `scrutiny:product:hash_function` | Hash algorithms | `"SHA-256"`, `"SHA-3"` |

#### Documentation

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:product:canonical_url` | Official product page | `"https://www.nxp.com/..."` |
| `scrutiny:product:datasheet_url` | Technical datasheet | `"https://..."` |
| `scrutiny:product:manual_url` | User manual | `"https://..."` |
| `scrutiny:product:sdk_url` | Software development kit | `"https://..."` |
| `scrutiny:product:sbom_url` | Software bill of materials | `"https://..."` |

#### Relationships

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:product:supersedes` | Event ID of older product | `"<hex_event_id>"` |
| `scrutiny:product:successor` | Event ID of newer product | `"<hex_event_id>"` |
| `scrutiny:product:contains` | Event ID of contained product/component | `"<hex_event_id>"` |
| `scrutiny:product:depends_on` | Event ID of dependency | `"<hex_event_id>"` |

#### Product-to-Product Relationships

SCRUTINY Fabric supports explicit product-to-product relationships (e.g., composition and dependencies).
Relationship edges SHOULD be encoded redundantly using:

1) NIP-32 labels (for structured semantics), AND
2) Nostr `e` tags (for efficient backlink queries).

For a relationship from ProductEvent A → ProductEvent B:

- Add NIP-32 label declaration and value:

  ["L", "scrutiny:product:contains"]
  ["l", "<target_product_event_id>", "scrutiny:product:contains"]

- Add an `e` tag referencing the target product event id, with the marker set to the relationship namespace:

  ["e", "<target_product_event_id>", "", "scrutiny:product:contains"]

Clients SHOULD render relationship lists (e.g., "Contains: …", "Depends on: …") as clickable links to the referenced ProductEvents.

Relationship namespaces:
- scrutiny:product:contains    (A contains B; BOM/composition)
- scrutiny:product:depends_on  (A depends on B; library/firmware dependency)

##### Query Guidance

To find products that reference a given product via any relationship:
```json
{"kinds":[1], "#t":["scrutiny_product"], "#e":["<product_event_id>"]}
```

To filter by relationship type, clients SHOULD inspect the `e` tag marker OR the NIP-32 label namespace.

### 2.4 Complete Example

```json
{
  "id": "a1b2c3d4e5f6...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "📦 SCRUTINY Product – NXP J3A080 Secure Smart Card Controller Revision 3\n\nManufacturer: NXP Semiconductors Germany GmbH\nVersion: 3\nCategory: ICs, Smart Cards and Smart Card-Related Devices and Systems\nSecurity Level: EAL5+\nStatus: archived\n\n#scrutiny_fabric #scrutiny_product #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_product"],
    ["t", "scrutiny_v02"],

    ["L", "scrutiny:product:vendor"],
    ["l", "NXP Semiconductors Germany GmbH", "scrutiny:product:vendor"],

    ["L", "scrutiny:product:name"],
    ["l", "J3A080 Secure Smart Card Controller Revision 3", "scrutiny:product:name"],

    ["L", "scrutiny:product:version"],
    ["l", "3", "scrutiny:product:version"],

    ["L", "scrutiny:product:category"],
    ["l", "smartcard", "scrutiny:product:category"],

    ["L", "scrutiny:product:status"],
    ["l", "archived", "scrutiny:product:status"],

    ["L", "scrutiny:product:cpe23"],
    ["l", "cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*", "scrutiny:product:cpe23"],

    ["L", "scrutiny:product:release_date"],
    ["l", "2011-03-31", "scrutiny:product:release_date"],

    ["L", "scrutiny:product:eol_date"],
    ["l", "2019-09-01", "scrutiny:product:eol_date"],

    ["L", "scrutiny:product:form_factor"],
    ["l", "smartcard", "scrutiny:product:form_factor"],

    ["L", "scrutiny:product:chip"],
    ["l", "NXP SmartMX", "scrutiny:product:chip"],

    ["L", "scrutiny:product:javacard_version"],
    ["l", "2.2.2", "scrutiny:product:javacard_version"],

    ["L", "scrutiny:product:globalplatform"],
    ["l", "2.1.1", "scrutiny:product:globalplatform"],

    ["L", "scrutiny:product:crypto_suite"],
    ["l", "AES", "scrutiny:product:crypto_suite"],
    ["l", "DES", "scrutiny:product:crypto_suite"],
    ["l", "3DES", "scrutiny:product:crypto_suite"],
    ["l", "ECC", "scrutiny:product:crypto_suite"],

    ["L", "scrutiny:product:hash_function"],
    ["l", "SHA-1", "scrutiny:product:hash_function"],
    ["l", "SHA-256", "scrutiny:product:hash_function"],

    ["L", "scrutiny:product:canonical_url"],
    ["l", "https://www.commoncriteriaportal.org/nfs/ccpfiles/files/epfiles/0674a_pdf.pdf", "scrutiny:product:canonical_url"],


    ["L", "scrutiny:product:contains"],
    ["l", "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "scrutiny:product:contains"],
    ["e", "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "", "scrutiny:product:contains"],

    ["L", "scrutiny:product:depends_on"],
    ["l", "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321", "scrutiny:product:depends_on"],
    ["e", "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321", "", "scrutiny:product:depends_on"],

    ["alt", "SCRUTINY product: NXP J3A080 Secure Smart Card Controller Revision 3"],

    ["t", "vendor_nxp"],
    ["t", "smartcard"],
    ["t", "eal5"],

    ["nonce", "1000", "10"]
  ],
  "sig": "..."
}
```

### 2.5 Client Interpretation Guidelines

**Display Grouping:**

- **Core Information:** vendor, name, version, category, status
- **Identifiers:** cpe23, purl
- **Lifecycle:** release_date, eol_date, support_until
- **Technical Specs:** form_factor, chip, memory, platform versions
- **Crypto Capabilities:** crypto_suite, key_length_max, ecc_curves, hash_function
- **Documentation:** All URL fields

**Validation Rules:**

- Dates MUST be ISO 8601 format (YYYY-MM-DD)
- CPE MUST follow CPE 2.3 specification (13 colon-separated fields)
- PURL MUST follow Package URL specification
- Memory capacity values MUST be positive integers representing bytes
- Clients SHOULD format memory values as KB/MB/GB for display (using 1024-based units)
- Crypto suite values SHOULD be uppercase algorithm names

---

## 3. Event Type: MetadataEvent

**Purpose:** Pointer to relevant external data.

**Event Kind:** `1`

**Use Cases:**

- Test results (timing, power traces, randomness)
- Vulnerability reports
- Security audit documents
- Certification reports
- Academic research data

### 3.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Human-readable description with protocol hashtags |
| `t` tags | Array | `scrutiny_fabric`, `scrutiny_metadata`, `scrutiny_v02` |

### 3.2 Recommended Labels

#### File Reference

| Tag | Description | Example | Notes |
|-----|-------------|---------|-------|
| `url` | HTTPS URL to data file | `"https://example.com/data.csv"` | Required if metadata references external file |
| `x` | SHA-256 hash of file at URL | `"e788a8c65036038c67147b8d1c6637e562ff985f3a1c84b4c96c15feb71529fc"` | Must be exactly 64 hex chars. Required if `url` present |
| `m` | MIME type of file | `"text/csv"` | Recommended if `url` present |
| `size` | File size in bytes | `"645056"` | Recommended if `url` present |

#### Measurement Classification

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
| `scrutiny:metadata:tool` | Measurement/analysis tool | `"JCAlgTest"` | Software or hardware tool used |
| `scrutiny:metadata:measurement_category` | High-level category | `"timing"` \| `"power"` \| `"randomness"` \| `"sidechannel"` | Broad classification |
| `scrutiny:metadata:measurement_type` | Specific measurement | `"operation_timing"` \| `"power_trace"` \| `"dieharder_test"` | Detailed type |
| `scrutiny:metadata:source` | Data provider | `"CRoCS"` | Person or org |

### 3.3 Optional Labels

#### Test Methodology

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:methodology` | Brief description | `"NIST SP 800-90B entropy assessment"` |
| `scrutiny:metadata:standard` | Standard followed | `"ISO/IEC 19790"` |
| `scrutiny:metadata:test_protocol_url` | Test protocol document | `"https://..."` |

#### Lab/Environment

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:lab` | Lab name | `"TÜV Informationstechnik"` |
| `scrutiny:metadata:lab_accreditation` | Accreditation standard | `"ISO/IEC 17025"` |
| `scrutiny:metadata:operator` | Technician/researcher | `"John Doe"` |

#### Statistical Validity

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:sample_size` | Number of measurements | `"1000"` |
| `scrutiny:metadata:statistical_confidence` | Confidence level | `"95%"` |
| `scrutiny:metadata:p_value` | Statistical significance | `"0.001"` |
| `scrutiny:metadata:iterations` | Test repetitions | `"250"` |

#### Tool Details

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:tool_version` | Tool version | `"1.6.0"` |
| `scrutiny:metadata:tool_vendor` | Tool manufacturer | `"OpenSC Project"` |
| `scrutiny:metadata:tool_config` | Config description/hash | `"default_config_v2"` |

#### Data Classification

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:data_type` | Data processing level | `"raw"` \| `"processed"` \| `"summary"` \| `"report"` |

#### Reproducibility

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:reproducible` | Can be reproduced | `"yes"` \| `"no"` \| `"partial"` |
| `scrutiny:metadata:reproduction_steps_url` | How to reproduce | `"https://..."` |

#### Temporal

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:measurement_date` | When measured | `"2015-07-24"` |
| `scrutiny:metadata:analysis_date` | When analyzed | `"2015-08-01"` |

#### Test Hardware

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:test:reader` | Card reader model | `"PC/SC terminal Gemplus USB Smart Card Reader 3"` |
| `scrutiny:test:atr` | Answer to reset (hex) | `"3b f8 13 00 00 81 31 fe 45 4a 43 4f 50 76 32 34 31 b7"` |

#### Visualization

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:metadata:visualization_type` | Graph type | `"graph"` \| `"heatmap"` \| `"waveform"` \| `"3d_plot"` |
| `scrutiny:metadata:axis_x` | X-axis label | `"Data Length (bytes)"` |
| `scrutiny:metadata:axis_y` | Y-axis label | `"Time (ms)"` |

#### Vulnerability-Specific (Use Case 2, 4)

For vulnerability disclosure metadata:

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:vuln:cve` | CVE identifier | `"CVE-2024-1234"` |
| `scrutiny:vuln:cwe` | CWE identifier | `"CWE-120"` |
| `scrutiny:vuln:cvss_score` | CVSS base score | `"9.8"` |
| `scrutiny:vuln:cvss_vector` | CVSS vector string | `"CVSS:3.1/AV:N/AC:L/..."` |
| `scrutiny:vuln:severity` | Severity classification | `"critical"` \| `"high"` \| `"medium"` \| `"low"` |
| `scrutiny:vuln:exploitability` | Exploit status | `"none"` \| `"theoretical"` \| `"poc"` \| `"weaponized"` |
| `scrutiny:vuln:kev` | In CISA KEV catalog | `"true"` \| `"false"` |
| `scrutiny:vuln:epss` | EPSS probability score | `"0.92"` |
| `scrutiny:vuln:status` | Disclosure status | `"draft"` \| `"disclosed"` \| `"vendor_acknowledged"` \| `"patched"` |
| `scrutiny:vuln:disclosure_date` | Public disclosure date | `"2024-01-15"` |
| `scrutiny:vuln:patch_available` | Patch exists | `"yes"` \| `"no"` \| `"workaround"` |
| `scrutiny:vuln:patch_url` | Patch location | `"https://github.com/.../commit/abc123"` |

#### Certification (Use Case 3)

For certification reports and related evidence:

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
| `scrutiny:cert:scheme` | Certification scheme / country | `"DE"` | Common Criteria scheme identifier |
| `scrutiny:cert:level` | Assurance level | `"EAL5+"` | Multiple labels allowed |
| `scrutiny:cert:id` | Certificate identifier | `"BSI-DSZ-CC-0674-2011"` | Scheme-issued ID |
| `scrutiny:cert:status` | Administrative status | `"revoked"` | See suggested values below |
| `scrutiny:cert:not_valid_before` | Validity window start (ISO 8601) | `"2011-03-31"` | X.509-style bound |
| `scrutiny:cert:not_valid_after` | Validity window end (ISO 8601) | `"2021-03-31"` | X.509-style bound |

**Allowed `scrutiny:cert:status` values:**

- `revoked` — explicitly invalidated (security issue, mis-issuance, etc.)
- `withdrawn` — withdrawn by scheme (administrative/legal; not necessarily “security breach” wording)
- `suspended` — temporarily suspended (pending investigation or maintenance)
- `superseded` — replaced by a newer certificate for a successor configuration
- `archived` — historical record, not actively maintained (common in CC portals)
- `unknown` — scheme status cannot be determined / not published
- `scope_changed` — certification scope changed (generic)
- `scope_reduced` — certification scope reduced
- `scope_extended` — certification scope extended

Status changes SHOULD be expressed via UpdateEvent (e.g., a later update changing `scrutiny:cert:status`). Clients SHOULD compute “valid”/“expired” from `not_valid_before`/`not_valid_after` rather than relying on status.

### 3.5 Complete Example (Performance Test)

```json
{
  "id": "b2c3d4e5f6a1...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "🧾 SCRUTINY Metadata – NXP J3A080 Performance: symmetric, asymmetric\n\nURL: https://github.com/crocs-muni/jcalgtest_results/blob/main/.../NXP_J3A080__PERFORMANCE_SYMMETRIC_ASYMMETRIC....csv\nSHA256: e788a8c65036038c67147b8d1c6637e562ff985f3a1c84b4c96c15feb71529fc\n\n#scrutiny_fabric #scrutiny_metadata #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_metadata"],
    ["t", "scrutiny_v02"],

    ["url", "https://github.com/crocs-muni/jcalgtest_results/blob/main/javacard/Profiles/performance/fixed/NXP_J3A080____PERFORMANCE_SYMMETRIC_ASYMMETRIC_DATAFIXED_1437777165525__3b_f8_13_00_00_81_31_fe_45_4a_43_4f_50_76_32_34_31_b7.csv"],
    ["x", "e788a8c65036038c67147b8d1c6637e562ff985f3a1c84b4c96c15feb71529fc"],
    ["m", "text/csv"],
    ["size", "645056"],
    ["alt", "NXP J3A080 Performance: symmetric, asymmetric cryptographic operations"],

    ["L", "scrutiny:metadata:tool"],
    ["l", "JCAlgTest", "scrutiny:metadata:tool"],

    ["L", "scrutiny:metadata:tool_version"],
    ["l", "1.6.0", "scrutiny:metadata:tool_version"],

    ["L", "scrutiny:metadata:measurement_category"],
    ["l", "timing", "scrutiny:metadata:measurement_category"],

    ["L", "scrutiny:metadata:measurement_type"],
    ["l", "operation_timing", "scrutiny:metadata:measurement_type"],

    ["L", "scrutiny:metadata:source"],
    ["l", "provided by PetrS", "scrutiny:metadata:source"],

    ["L", "scrutiny:metadata:measurement_date"],
    ["l", "2015-07-24", "scrutiny:metadata:measurement_date"],

    ["L", "scrutiny:metadata:data_type"],
    ["l", "processed", "scrutiny:metadata:data_type"],

    ["L", "scrutiny:test:reader"],
    ["l", "PC/SC terminal Gemplus USB Smart Card Reader 3", "scrutiny:test:reader"],

    ["L", "scrutiny:test:atr"],
    ["l", "3b f8 13 00 00 81 31 fe 45 4a 43 4f 50 76 32 34 31 b7", "scrutiny:test:atr"],

    ["L", "scrutiny:metadata:sample_size"],
    ["l", "250", "scrutiny:metadata:sample_size"],

    ["t", "jcalgtest"],
    ["t", "timing"],
    ["t", "performance"],

    ["nonce", "2000", "10"]
  ],
  "sig": "..."
}
```

### 3.6 Complete Example (Vulnerability Disclosure)

```json
{
  "id": "c3d4e5f6a1b2...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "🧾 SCRUTINY Metadata – CVE-2024-1234: Buffer overflow in NXP J3A080 APDU handler\n\nCritical vulnerability allowing arbitrary code execution via crafted APDU commands.\n\nURL: https://researcher.example.com/advisories/nxp-j3a080-buffer-overflow.pdf\nSHA256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08\n\n#scrutiny_fabric #scrutiny_metadata #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_metadata"],
    ["t", "scrutiny_v02"],

    ["url", "https://researcher.example.com/advisories/nxp-j3a080-buffer-overflow.pdf"],
    ["x", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"],
    ["m", "application/pdf"],
    ["size", "245760"],
    ["alt", "CVE-2024-1234 vulnerability report for NXP J3A080"],

    ["L", "scrutiny:metadata:measurement_category"],
    ["l", "vulnerability", "scrutiny:metadata:measurement_category"],

    ["L", "scrutiny:metadata:measurement_type"],
    ["l", "security_audit", "scrutiny:metadata:measurement_type"],

    ["L", "scrutiny:vuln:cve"],
    ["l", "CVE-2024-1234", "scrutiny:vuln:cve"],

    ["L", "scrutiny:vuln:cwe"],
    ["l", "CWE-120", "scrutiny:vuln:cwe"],

    ["L", "scrutiny:vuln:cvss_score"],
    ["l", "9.8", "scrutiny:vuln:cvss_score"],

    ["L", "scrutiny:vuln:cvss_vector"],
    ["l", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "scrutiny:vuln:cvss_vector"],

    ["L", "scrutiny:vuln:severity"],
    ["l", "critical", "scrutiny:vuln:severity"],

    ["L", "scrutiny:vuln:exploitability"],
    ["l", "poc", "scrutiny:vuln:exploitability"],

    ["L", "scrutiny:vuln:status"],
    ["l", "disclosed", "scrutiny:vuln:status"],

    ["L", "scrutiny:vuln:disclosure_date"],
    ["l", "2024-01-15", "scrutiny:vuln:disclosure_date"],

    ["L", "scrutiny:vuln:patch_available"],
    ["l", "no", "scrutiny:vuln:patch_available"],

    ["L", "scrutiny:metadata:source"],
    ["l", "Jane Doe Security Research", "scrutiny:metadata:source"],

    ["t", "vulnerability"],
    ["t", "critical"],
    ["t", "buffer_overflow"],

    ["nonce", "3000", "10"]
  ],
  "sig": "..."
}
```

### 3.7 Complete Example (Certification Report)

```json
{
  "id": "c7d8e9f0a1b2...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "🧾 SCRUTINY Metadata – Common Criteria certificate for NXP J3A080 Revision 3\n\nCertificate report: https://www.commoncriteriaportal.org/nfs/ccpfiles/files/epfiles/0674a_pdf.pdf\nSHA256: d37ca43c43ed26e0d4059e77f4d793d3e6a69614ee0661e663e992672b1c76a7\n\n#scrutiny_fabric #scrutiny_metadata #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_metadata"],
    ["t", "scrutiny_v02"],

    ["url", "https://www.commoncriteriaportal.org/nfs/ccpfiles/files/epfiles/0674a_pdf.pdf"],
    ["x", "d37ca43c43ed26e0d4059e77f4d793d3e6a69614ee0661e663e992672b1c76a7"],
    ["m", "application/pdf"],
    ["alt", "Common Criteria certificate report for NXP J3A080 Revision 3"],

    ["L", "scrutiny:cert:scheme"],
    ["l", "DE", "scrutiny:cert:scheme"],

    ["L", "scrutiny:cert:level"],
    ["l", "EAL5+", "scrutiny:cert:level"],
    ["l", "AVA_VAN.5", "scrutiny:cert:level"],

    ["L", "scrutiny:cert:id"],
    ["l", "BSI-DSZ-CC-0674-2011", "scrutiny:cert:id"],

    ["L", "scrutiny:cert:not_valid_before"],
    ["l", "2011-03-31", "scrutiny:cert:not_valid_before"],

    ["L", "scrutiny:cert:not_valid_after"],
    ["l", "2021-03-31", "scrutiny:cert:not_valid_after"],

    ["t", "certification"],
    ["t", "common_criteria"],
    ["t", "eal5"],

    ["nonce", "3500", "10"]
  ],
  "sig": "..."
}
```

### 3.8 Client Interpretation Guidelines

**Hash Verification:**
If both `url` and `x` tags are present, clients MUST verify the SHA-256 hash matches the fetched file before trusting the metadata.

**Display Grouping:**

- **File Information:** url, size, m (MIME), x (hash)
- **Classification:** measurement_category, measurement_type, data_type
- **Tool Information:** tool, tool_version, tool_vendor
- **Test Conditions:** lab, operator, environment details, reader, atr
- **Statistical Data:** sample_size, confidence, p_value, iterations
- **Temporal:** measurement_date, analysis_date
- **Vulnerability Data:** All `scrutiny:vuln:*` labels (if applicable)
- **Certification:** cert:scheme, cert:level, cert:id, cert:status, cert:not_valid_before, cert:not_valid_after (if applicable)

**Validation Rules:**

- If `x` tag is present, it MUST be exactly 64 hexadecimal characters
- If `url` tag is present, it MUST use HTTPS scheme
- If `url` tag is present, `x` tag SHOULD also be present for integrity verification
- Dates MUST be ISO 8601 format
- `scrutiny:cert:not_valid_before` and `scrutiny:cert:not_valid_after` MUST be ISO 8601 format (YYYY-MM-DD)
- `scrutiny:cert:status` SHOULD be one of: revoked, withdrawn, suspended, superseded, archived, unknown, scope_changed, scope_reduced, scope_extended
- CVSS scores MUST be 0.0-10.0
- EPSS scores MUST be 0.0-1.0

---

## 4. Event Type: BindingEvent

**Purpose:** Links one or more products to one or more metadata events, establishing semantic relationships.

**Event Kind:** `1`

**Use Cases:**

- Test result attribution
- Vulnerability disclosure
- Certification linking
- Performance benchmarks

### 4.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Human-readable description with Nostr URIs and protocol hashtags |
| `t` tags | Array | `scrutiny_fabric`, `scrutiny_binding`, `scrutiny_v02` |
| `e` tags (products) | Array | One or more product event IDs with marker `"mention"` |
| `e` tags (metadata) | Array | One or more metadata event IDs with marker `"mention"` |

### 4.2 Recommended Labels

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
| `scrutiny:binding:relationship` | Relationship type | `"test_of"` \| `"vulnerability_in"` \| `"certification_of"` | **Most critical field** |

### 4.3 Optional Labels

#### Temporal Validity

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:binding:not_valid_before` | Binding valid start | `"2015-07-24"` |
| `scrutiny:binding:not_valid_after` | Binding expiration | `"2025-07-24"` |
| `scrutiny:binding:supersedes` | Event ID of older binding | `"<hex_event_id>"` |

#### Context

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:binding:limitations` | Known limitations | `"Only applies to firmware v1.x"` |
| `scrutiny:binding:scope` | Scope of binding | `"partial"` \| `"complete"` \| `"sample_based"` |

### 4.4 Relationship Type Values

**Proposal: Semantic Relationship Taxonomy**
The `scrutiny:binding:relationship` label defines the semantic meaning of the product-metadata link. This is **critical** for client interpretation and automated processing.

| Value | Meaning | Product → Metadata |
|-------|---------|-------------------|
| `test_of` | Metadata is test result of product | Product was tested → Test results |
| `vulnerability_in` | Metadata describes vulnerability in product | Product is vulnerable → Vulnerability report |
| `patch_for` | Metadata is patch/fix for product | Product needs patch → Patch file/commit |
| `certification_of` | Metadata is certification report for product | Product was certified → Certificate document |
| `benchmark_of` | Metadata is performance benchmark of product | Product was benchmarked → Benchmark data |
| `audit_of` | Metadata is security audit of product | Product was audited → Audit report |
| `analysis_of` | Metadata is analysis/research about product | Product was analyzed → Research paper |
| `documentation_of` | Metadata is documentation for product | Product is documented by → Manual/guide |

**Rationale for Explicit Relationship Types:**

1. **Automated Processing:** DevSecOps tools need to know "is this a vulnerability or a test result?"
2. **Query Precision:** Users searching for "all vulnerabilities affecting X" vs "all test results for X"
3. **Display Logic:** Clients can show relationship-specific UI (red badge for vulnerabilities, green for certifications)
4. **Future Extensions:** New relationships (e.g., `compliance_with`, `incompatible_with`) can be added

**Usage Example:**

Binding a test result to a product:

```python
["L", "scrutiny:binding:relationship"],
["l", "test_of", "scrutiny:binding:relationship"],
```

Binding a vulnerability report to a product:

```python
["L", "scrutiny:binding:relationship"],
["l", "vulnerability_in", "scrutiny:binding:relationship"],

["L", "scrutiny:vuln:severity"],  # Can duplicate from MetadataEvent
["l", "critical", "scrutiny:vuln:severity"],
```

### 4.5 Complete Example (Test Result Binding)

```json
{
  "id": "d4e5f6a1b2c3...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "🔗 SCRUTINY Binding – JCAlgTest performance results for NXP J3A080\n\nProduct: nostr:note1qq79096rxvfggwnuqtv3wtd7t6p88herwkp28n9p2uj3hfc3t6vst7qg36\nMetadata: nostr:note1qqqktdg655pztqq83r9l24f8gjacy52tt4acs7cmg6f78m6qr3pst6rz7w\n\n#scrutiny_fabric #scrutiny_binding #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_binding"],
    ["t", "scrutiny_v02"],

    ["e", "a1b2c3d4e5f6...", "", "mention"],
    ["e", "b2c3d4e5f6a1...", "", "mention"],

    ["L", "scrutiny:binding:relationship"],
    ["l", "test_of", "scrutiny:binding:relationship"],

    ["L", "scrutiny:binding:not_valid_before"],
    ["l", "2015-07-24", "scrutiny:binding:not_valid_before"],

    ["L", "scrutiny:binding:scope"],
    ["l", "complete", "scrutiny:binding:scope"],

    ["nonce", "4000", "10"]
  ],
  "sig": "..."
}
```

### 4.6 Complete Example (Vulnerability Binding)

```json
{
  "id": "e5f6a1b2c3d4...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "🔗 SCRUTINY Binding – CVE-2024-1234 affects NXP J3A080 Revision 3\n\nProduct: nostr:note1qq79096rxvfggwnuqtv3wtd7t6p88herwkp28n9p2uj3hfc3t6vst7qg36\nVulnerability Report: nostr:note1a1b2c3d4e5f6...\n\n#scrutiny_fabric #scrutiny_binding #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_binding"],
    ["t", "scrutiny_v02"],

    ["e", "a1b2c3d4e5f6...", "", "mention"],
    ["e", "c3d4e5f6a1b2...", "", "mention"],

    ["L", "scrutiny:binding:relationship"],
    ["l", "vulnerability_in", "scrutiny:binding:relationship"],

    ["L", "scrutiny:binding:limitations"],
    ["l", "Affects only versions with default APDU buffer size", "scrutiny:binding:limitations"],

    ["L", "scrutiny:vuln:severity"],
    ["l", "critical", "scrutiny:vuln:severity"],

    ["t", "vulnerability"],
    ["t", "critical"],

    ["nonce", "5000", "10"]
  ],
  "sig": "..."
}
```

### 4.7 Client Interpretation Guidelines

**Multiple Bindings:**
A single BindingEvent can reference:

- Multiple products (e.g., vulnerability affects v1, v2, v3)
- Multiple metadata events (e.g., test results + analysis paper)

**Relationship-Specific Display:**
Clients SHOULD render bindings differently based on relationship type:

- `vulnerability_in`: Red warning badge
- `certification_of`: Green certification badge
- `test_of`: Blue info badge
- `patch_for`: Orange update badge

**Query Patterns:**

```python
# Find all test results for a product:
{"#e": ["<product_event_id>"], "#l": ["test_of"]}

# Find all vulnerabilities:
{"#l": ["vulnerability_in"]}

# Find critical vulnerabilities:
{"#l": ["vulnerability_in", "critical"]}
```

**Validation Rules:**

- At least one product `e` tag MUST be present
- At least one metadata `e` tag MUST be present
- Dates MUST be ISO 8601 format

---

## 5. Event Type: UpdateEvent

**Purpose:** Auditable updates to existing ProductEvents and MetadataEvents via NIP-10 reply pattern. Preserves full history.

**Event Kind:** `1`

**Use Cases:**

- Correcting errors
- Adding new information
- Deprecating outdated data
- Vendor responses

### 5.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Human-readable update description with Nostr URI and protocol hashtags |
| `t` tags | Array | `scrutiny_fabric`, `scrutiny_update`, `scrutiny_v02` |
| `e` tag (root) | Tag | Original event ID with marker `"root"` |
| `e` tag (reply) | Tag | Original event ID with marker `"reply"` |

**Note:** Per NIP-10, when replying directly to the root event, both `root` and `reply` markers reference the same event ID.

### 5.2 Recommended Labels

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
  | `scrutiny:update:change_type` | Type of change | `"correction"` \| `"addition"` \| `"retraction"` \| `"clarification"` \| `"deprecation"` | Change category |
| `scrutiny:update:severity` | Update importance | `"minor"` \| `"major"` \| `"critical"` | Impact level |

### 5.3 Optional Labels

#### Change Classification

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:update:reason` | Why update was made | `"typo"` \| `"new_information"` \| `"methodology_error"` \| `"disputed"` \| `"vendor_feedback"` |
| `scrutiny:update:field_changed` | Which field changed | `"product:version"`, `"metadata:tool_version"` |

#### New Data (for MetadataEvent updates)

| Namespace | Description | Example |
|-----------|-------------|---------|
| Standard tags | `url`, `x` | New file URL and hash |

### 5.4 Complete Example

```json
{
  "id": "f6a1b2c3d4e5...",
  "kind": 1,
  "pubkey": "1234567890abcdef...",
  "created_at": 1700000000,
  "content": "✏️ SCRUTINY Update – Corrected tool version for performance test\n\nRoot: nostr:note1qqqktdg655pztqq83r9l24f8gjacy52tt4acs7cmg6f78m6qr3pst6rz7w\n\nThe original metadata event listed tool version as 1.6.0, but it was actually 1.7.0.\n\n#scrutiny_fabric #scrutiny_update #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_update"],
    ["t", "scrutiny_v02"],

    ["e", "b2c3d4e5f6a1...", "", "root"],
    ["e", "b2c3d4e5f6a1...", "", "reply"],

    ["p", "1234567890abcdef..."],

    ["L", "scrutiny:update:change_type"],
    ["l", "correction", "scrutiny:update:change_type"],

    ["L", "scrutiny:update:severity"],
    ["l", "minor", "scrutiny:update:severity"],

    ["L", "scrutiny:update:reason"],
    ["l", "typo", "scrutiny:update:reason"],

    ["L", "scrutiny:update:field_changed"],
    ["l", "metadata:tool_version", "scrutiny:update:field_changed"],

    ["L", "scrutiny:metadata:tool_version"],
    ["l", "1.7.0", "scrutiny:metadata:tool_version"],

    ["nonce", "6000", "10"]
  ],
  "sig": "..."
}
```

### 5.5 Client Interpretation Guidelines

**Update Chain Resolution:**
Clients MUST:

1. Query for all events referencing the original event: `{"#e": ["<event_id>"], "#t": ["scrutiny_update"]}`
2. Sort by `created_at` (newest first)
3. Apply updates in chronological order

**Display:**

- Show update count badge on original event
- Allow expanding update history
- Highlight `critical` severity updates

**Deprecation Handling:**
If `change_type` is `deprecation`:

- Show "DEPRECATED" badge on original event
- Display deprecation reason prominently
- If `supersedes` tag present, link to new event

**Validation Rules:**

- `e` tags MUST reference an existing SCRUTINY Fabric event
- Update author MAY differ from original author (third-party corrections allowed)

---

## 6. Event Type: ContestationEvent

**Purpose:** Formal dispute of metadata accuracy with evidence. Enables transparent peer review.

**Event Kind:** `1`

**Use Cases:**

- Disputing test methodology
- Challenging vendor claims
- Reporting data fabrication
- Peer review disagreements

### 6.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Human-readable dispute description with Nostr URIs and protocol hashtags |
| `t` tags | Array | `scrutiny_fabric`, `scrutiny_contestation`, `scrutiny_v02` |
| `e` tag (root) | Tag | Contested event ID with marker `"root"` |
| `e` tag (reply) | Tag | Contested event ID with marker `"reply"` |
| `e` tag (mention) | Tag | Alternative metadata event ID with marker `"mention"` |

**Note:** The alternative metadata MUST be a proper MetadataEvent providing counter-evidence. Per NIP-10, both `root` and `reply` markers reference the same contested event.

### 6.2 Recommended Labels

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
| `scrutiny:contest:dispute_type` | Nature of dispute | `"data_quality"` \| `"methodology"` \| `"interpretation"` \| `"fabrication"` \| `"conflict_of_interest"` | Dispute classification |
| `scrutiny:contest:severity` | Dispute seriousness | `"minor_discrepancy"` \| `"major_error"` \| `"fraud"` | Impact assessment |

### 6.3 Optional Labels

#### Evidence

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:contest:reference` | Supporting literature | `"https://arxiv.org/..."` |

### 6.4 Complete Example

```json
{
  "id": "a1a2a3a4a5a6...",
  "kind": 1,
  "pubkey": "abcdef1234567890...",
  "created_at": 1700000000,
  "content": "⚖️ SCRUTINY Contestation – Methodology flaw in NXP J3A080 performance test\n\nContested: nostr:note1qqqktdg655pztqq83r9l24f8gjacy52tt4acs7cmg6f78m6qr3pst6rz7w\nAlternative Evidence: nostr:note1e5f6g7h8i9...\n\nThe original test used incorrect JCAlgTest configuration leading to artificially low timing values. Our replication with correct settings shows 10x slower performance.\n\nReference: https://arxiv.org/abs/2024.12345\n\n#scrutiny_fabric #scrutiny_contestation #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_contestation"],
    ["t", "scrutiny_v02"],

    ["e", "b2c3d4e5f6a1...", "", "root"],
    ["e", "b2c3d4e5f6a1...", "", "reply"],
    ["e", "c3c4c5c6c7c8...", "", "mention"],

    ["L", "scrutiny:contest:dispute_type"],
    ["l", "methodology", "scrutiny:contest:dispute_type"],

    ["L", "scrutiny:contest:severity"],
    ["l", "major_error", "scrutiny:contest:severity"],

    ["L", "scrutiny:contest:reference"],
    ["l", "https://arxiv.org/abs/2024.12345", "scrutiny:contest:reference"],

    ["t", "methodology_dispute"],

    ["nonce", "7000", "10"]
  ],
  "sig": "..."
}
```

### 6.5 Client Interpretation Guidelines

**Display:**

- Show "CONTESTED" badge on original event
- Display contest count
- Allow expanding to see all contestations
- Show severity color-coding (minor=yellow, major=orange, fraud=red)

**Trust Signals:**
Clients MAY use reputation metrics:

- Number of contestations from trusted sources
- Corroborating references

**Resolution:**
If original author publishes an UpdateEvent acknowledging the contestation:

- Link the update to the contestation
- Show "ACKNOWLEDGED" status
- If retraction, show prominently

**Validation Rules:**

- Alternative evidence MUST be a valid MetadataEvent with `url` + `x` tags
- Contested event MUST be a MetadataEvent
- Alternative evidence MUST have different hash than contested event

---

## 7. Event Type: ConfirmationEvent

**Purpose:** Independent verification/endorsement of existing metadata. Builds trust through replication.

**Event Kind:** `1`

**Use Cases:**

- Independent lab replication
- Peer review endorsement
- Vendor acknowledgment
- Cross-validation

### 7.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Human-readable confirmation description with Nostr URI and protocol hashtags |
| `t` tags | Array | `scrutiny_fabric`, `scrutiny_confirmation`, `scrutiny_v02` |
| `e` tag (root) | Tag | Confirmed event ID with marker `"root"` |
| `e` tag (reply) | Tag | Confirmed event ID with marker `"reply"` |

**Note:** Per NIP-10, when replying directly to the root event, both `root` and `reply` markers reference the same event ID.

### 7.2 Recommended Labels

| Namespace | Description | Example | Notes |
|-----------|-------------|---------|-------|
| `scrutiny:confirm:method` | How confirmation was done | `"independent_test"` \| `"peer_review"` \| `"vendor_audit"` \| `"cross_validation"` | Verification method |

### 7.3 Optional Labels

#### Replication

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:confirm:replicated` | Successfully replicated | `"yes"` \| `"no"` \| `"partial"` |
| `scrutiny:confirm:replication_conditions` | How replication differs | `"Used same hardware, different lab"` |
| `scrutiny:confirm:deviation_percent` | Measurement difference | `"2.5"` |

#### Endorsement

| Namespace | Description | Example |
|-----------|-------------|---------|
| `scrutiny:confirm:endorser_role` | Confirmer's role | `"independent_lab"` \| `"peer_researcher"` \| `"certification_body"` \| `"vendor"` |
| `scrutiny:confirm:endorser_credential` | Credentials | `"ISO17025"` \| `"PhD"` \| `"Industry_Expert"` |

#### Evidence

| Namespace | Description | Example |
|-----------|-------------|---------|
| `e` tag (mention) | Optional evidence MetadataEvent | Event ID with marker `"mention"` |

### 7.4 Complete Example

```json
{
  "id": "f1f2f3f4f5f6...",
  "kind": 1,
  "pubkey": "fedcba0987654321...",
  "created_at": 1700000000,
  "content": "✅ SCRUTINY Confirmation – Independent replication of NXP J3A080 performance results\n\nRoot: nostr:note1qqqktdg655pztqq83r9l24f8gjacy52tt4acs7cmg6f78m6qr3pst6rz7w\nOur Evidence: nostr:note1f6g7h8i9j0...\n\nWe independently tested the NXP J3A080 using the same methodology and obtained results within 2.5% of the original findings. This confirms the accuracy of the original test.\n\n#scrutiny_fabric #scrutiny_confirmation #scrutiny_v02",
  "tags": [
    ["t", "scrutiny_fabric"],
    ["t", "scrutiny_confirmation"],
    ["t", "scrutiny_v02"],

    ["e", "b2c3d4e5f6a1...", "", "root"],
    ["e", "b2c3d4e5f6a1...", "", "reply"],
    ["e", "d4d5d6d7d8d9...", "", "mention"],

    ["L", "scrutiny:confirm:method"],
    ["l", "independent_test", "scrutiny:confirm:method"],

    ["L", "scrutiny:confirm:replication_conditions"],
    ["l", "Used identical hardware setup in ISO17025 accredited lab", "scrutiny:confirm:replication_conditions"],

    ["L", "scrutiny:confirm:deviation_percent"],
    ["l", "2.5", "scrutiny:confirm:deviation_percent"],

    ["t", "confirmed"],
    ["t", "replicated"],

    ["nonce", "8000", "10"]
  ],
  "sig": "..."
}
```

### 7.5 Client Interpretation Guidelines

**Display:**

- Show "CONFIRMED" badge on original event
- Display confirmation count from trusted sources
- If replication evidence provided, link to it

**Trust Scoring:**
Clients MAY implement weighted trust scoring based on:

- Reputation of confirming author (via Web of Trust)
- Deviation percentage (lower = higher confidence)
- Number of independent confirmations

**Deviation Handling:**
If `deviation_percent` > threshold (e.g., 10%):

- Show "PARTIAL CONFIRMATION" instead
- Display deviation prominently
- Link to alternative measurements

**Validation Rules:**

- Confirmation author SHOULD differ from original author (self-confirmation has low value)
- If evidence provided, MUST be valid MetadataEvent
- `deviation_percent` MUST be numeric

---

## 8. Cross-Cutting Concerns

### 8.1 Proof-of-Work (NIP-13)

All events SHOULD include a `nonce` tag with difficulty ≥10 to prevent spam:

```python
["nonce", "<random_number>", "<target_difficulty>"]
```

Clients and relays MAY require higher difficulty for acceptance/ranking.

### 8.2 Accessibility (NIP-31)

All events SHOULD include an `alt` tag with plain-text summary:

```python
["alt", "Human-readable one-line description for screen readers"]
```

### 8.3 Deletion (NIP-09)

Deletion is **best-effort**. Clients SHOULD:

- Check for `kind: 5` delete events
- Display "DELETED" badge if found
- Still allow viewing original content (censorship resistance)

### 8.4 Hashtag Duplication

Critical searchable fields SHOULD be duplicated as t-tags:

```python
["L", "scrutiny:product:vendor"],
["l", "NXP", "scrutiny:product:vendor"],
["t", "vendor_nxp"],  # Duplicate for universal search
```

### 8.5 Query Patterns

#### Find all products by vendor:

```python
{"kinds": [1], "#t": ["scrutiny_product"], "#l": ["NXP"]}
```

#### Find all test results for a product:

```python
{"kinds": [1], "#e": ["<product_event_id>"], "#l": ["test_of"]}
```

#### Find all critical vulnerabilities:

```python
{"kinds": [1], "#t": ["scrutiny_metadata"], "#l": ["critical"]}
```

#### Find all events by CRoCS lab:

```python
{"kinds": [1], "#t": ["scrutiny_fabric"], "authors": ["<crocs_pubkey>"]}
```

---

## 9. Implementation Checklist

### 9.1 Publishing Client

- [ ] Generate valid Nostr keypair
- [ ] Implement NIP-32 label declaration (`L` tags) and application (`l` tags)
- [ ] Fetch file from URL and compute SHA-256 hash
- [ ] Validate all user inputs (CPE, PURL, dates, etc.)
- [ ] Add protocol hashtags to content and t-tags
- [ ] Compute NIP-13 PoW nonce
- [ ] Sign event with private key
- [ ] Broadcast to multiple relays

### 9.2 SCRUTINY-Aware Client

- [ ] Query events by `#t: scrutiny_fabric`
- [ ] Parse NIP-32 labels into structured data
- [ ] Group labels by category (product, metadata, test, etc.)
- [ ] Verify file hashes on MetadataEvents
- [ ] Resolve BindingEvents to show product-metadata relationships
- [ ] Display relationship-specific badges (test, vulnerability, certification)
- [ ] Show update/contestation/confirmation counts
- [ ] Implement trust scoring based on confirmations
- [ ] Handle deleted events with badges
- [ ] Support querying by CPE, PURL, CVE, vendor, etc.

### 9.3 Relay Operators

- [ ] Index `#t`, `#e`, `#L`, `#l` tags for fast queries
- [ ] Optionally enforce minimum PoW difficulty
- [ ] Consider event retention policy
- [ ] Monitor storage costs (MetadataEvents may link to large files)

---

## 10. Future Extensions

- **NIP-42 Authentication:** For private/permissioned relays
- **NIP-40 Expiration:** For temporary data
- **NIP-57 Zaps:** Monetary incentives for quality metadata
- **NIP-89 Handlers:** Recommend SCRUTINY-aware client apps
- **NIP-90 DVMs:** Automated data processing and summarization

---

## Appendix A: Complete Namespace Registry

```text
scrutiny:product:vendor
scrutiny:product:name
scrutiny:product:version
scrutiny:product:category
scrutiny:product:status
scrutiny:product:cpe23
scrutiny:product:purl
scrutiny:product:release_date
scrutiny:product:eol_date
scrutiny:product:support_until
scrutiny:product:form_factor
scrutiny:product:chip
scrutiny:product:memory_ram
scrutiny:product:memory_eeprom
scrutiny:product:javacard_version
scrutiny:product:globalplatform
scrutiny:product:crypto_suite
scrutiny:product:key_length_max
scrutiny:product:ecc_curves
scrutiny:product:hash_function
scrutiny:product:canonical_url
scrutiny:product:datasheet_url
scrutiny:product:manual_url
scrutiny:product:sdk_url
scrutiny:product:sbom_url
scrutiny:product:supersedes
scrutiny:product:successor
scrutiny:product:contains
scrutiny:product:depends_on

scrutiny:metadata:tool
scrutiny:metadata:tool_version
scrutiny:metadata:tool_vendor
scrutiny:metadata:tool_config
scrutiny:metadata:measurement_category
scrutiny:metadata:measurement_type
scrutiny:metadata:source
scrutiny:metadata:methodology
scrutiny:metadata:standard
scrutiny:metadata:test_protocol_url
scrutiny:metadata:lab
scrutiny:metadata:lab_accreditation
scrutiny:metadata:operator
scrutiny:metadata:environment_temp
scrutiny:metadata:environment_humidity
scrutiny:metadata:sample_size
scrutiny:metadata:statistical_confidence
scrutiny:metadata:p_value
scrutiny:metadata:iterations
scrutiny:metadata:data_type
scrutiny:metadata:reproducible
scrutiny:metadata:reproduction_steps_url
scrutiny:metadata:measurement_date
scrutiny:metadata:analysis_date
scrutiny:metadata:visualization_type
scrutiny:metadata:axis_x
scrutiny:metadata:axis_y

scrutiny:test:reader
scrutiny:test:atr
scrutiny:test:date

scrutiny:cert:scheme
scrutiny:cert:level
scrutiny:cert:id
scrutiny:cert:status
scrutiny:cert:not_valid_before
scrutiny:cert:not_valid_after

scrutiny:binding:relationship
scrutiny:binding:not_valid_before
scrutiny:binding:not_valid_after
scrutiny:binding:supersedes
scrutiny:binding:conditions
scrutiny:binding:limitations
scrutiny:binding:scope
scrutiny:binding:quality_score

scrutiny:update:change_type
scrutiny:update:severity
scrutiny:update:reason
scrutiny:update:field_changed

scrutiny:contest:dispute_type
scrutiny:contest:severity
scrutiny:contest:reference

scrutiny:confirm:method
scrutiny:confirm:replication_conditions
scrutiny:confirm:deviation_percent

scrutiny:vuln:cve
scrutiny:vuln:cwe
scrutiny:vuln:cvss_score
scrutiny:vuln:cvss_vector
scrutiny:vuln:severity
scrutiny:vuln:exploitability
scrutiny:vuln:kev
scrutiny:vuln:epss
scrutiny:vuln:status
scrutiny:vuln:disclosure_date
scrutiny:vuln:patch_available
scrutiny:vuln:patch_url
```
