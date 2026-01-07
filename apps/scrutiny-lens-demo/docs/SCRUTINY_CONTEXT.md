# SCRUTINY Nostr Events Viewer - Project Context

## Project Overview

This is a proof-of-concept Nostr events viewer for the **SCRUTINY (Decentralized Security Metadata Overlay)** protocol. A single-page React application that queries Nostr relays once on page load and displays security metadata bindings for products.

## What is SCRUTINY?

SCRUTINY is a Nostr-based protocol that links security products (like cryptographic smartcards, libraries) to their metadata (test results, vulnerabilities, power traces, certifications) in a permissionless, censorship-resistant way.

### Event Types

All events are `kind: 1` (text notes) with specific hashtags/tags:

1. **ProductEvent** (`scrutiny_product`)
   - Represents a specific product (e.g., OpenSSL 3.0.0)
   - Contains: vendor, product_name, product_version, CPE23/PURL identifiers
   - Tags: `d` (stable identifier), `url` (canonical URL), `l` labels (NIP-32)

2. **MetadataEvent** (`scrutiny_metadata`)
   - Contains external security data
   - REQUIRED: `url` (HTTPS URL) + `x` (SHA256 hash of file)
   - Example: test results, power traces, vulnerability reports

3. **BindingEvent** (`scrutiny_binding`)
   - Links Product to Metadata
   - Has two `e` tags with "mention" role:
     - One → ProductEvent ID
     - One → MetadataEvent ID
   - Acts as attestation/endorsement

4. **UpdateEvent** (`scrutiny_update`)
   - Author revises their original event
   - `e` tag with "root" role → original event
   - Same pubkey as original = replacement

5. **ContestationEvent** (`scrutiny_contestation`)
   - Third-party disputes metadata
   - `e` tag "root" → contested MetadataEvent
   - `e` tag "mention" → alternative MetadataEvent (proof)

6. **ConfirmationEvent** (`scrutiny_confirmation`)
   - Third-party endorses metadata
   - `e` tag "root" → confirmed event

## Technical Requirements

### Data Fetching

**Relay**: `wss://relay.damus.io`

**Query Filter**:
```javascript
{
  kinds: [1],
  // Include all SCRUTINY event types in all four variants (plain, #-prefixed, _v01, #..._v01)
  // This fetches products, metadata, bindings, updates, confirmations, and contestations
  "#t": [
    "scrutiny_mo", "#scrutiny_mo", "scrutiny_mo_v01", "#scrutiny_mo_v01",
    "scrutiny_binding", "#scrutiny_binding", "scrutiny_binding_v01", "#scrutiny_binding_v01",
    // Also accept other SCRUTINY event type tags in any of their variants
    "scrutiny_product", "#scrutiny_product", "scrutiny_product_v01", "#scrutiny_product_v01",
    "scrutiny_metadata", "#scrutiny_metadata", "scrutiny_metadata_v01", "#scrutiny_metadata_v01",
    "scrutiny_update", "#scrutiny_update", "scrutiny_update_v01", "#scrutiny_update_v01",
    "scrutiny_contestation", "#scrutiny_contestation", "scrutiny_contestation_v01", "#scrutiny_contestation_v01",
    "scrutiny_confirmation", "#scrutiny_confirmation", "scrutiny_confirmation_v01", "#scrutiny_confirmation_v01"
  ]
}
```

**Process**:
1. Connect to relay on page load (one-time fetch)
2. Subscribe with filter above
3. Collect all events until EOSE (end of stored events)
4. Close connection
5. Parse and categorize ALL events (products, metadata, bindings, updates, confirmations, contestations)
6. Display ONLY BindingEvents in main list

**Nostr Library**: Use whatever Shakespeare.diy recommends (likely `nostr-tools` or `NDK`)

### Event Identification

Events are identified by their `t` tags. The system accepts four variants for each base tag: plain, with leading `#`, the `_v01` version, and the `_v01` with leading `#`.

Events have multiple `t` tags:
- MUST have namespace: `scrutiny_mo` (or `#scrutiny_mo`, `scrutiny_mo_v01`, `#scrutiny_mo_v01`)
- MUST have type: one or more of `scrutiny_product`, `scrutiny_metadata`, `scrutiny_binding`, `scrutiny_update`, `scrutiny_contestation`, `scrutiny_confirmation` (each accepts the four variants)

### Filters (Phase 1)

The bindings list can be filtered by:
- **Date Range**: Unix timestamp start/end
- **Author**: npub or hex pubkey
- **D Tag**: Partial match on stable identifier (e.g., "org.vendor:product")
- **CPE23**: Partial match on CPE identifier in l tags
### Event Parsing Structure

```javascript
{
  id: event.id,
  pubkey: event.pubkey,
  created_at: event.created_at,
  content: event.content,
  tags: event.tags,
  eventType: // product/metadata/binding/update/contestation/confirmation
}
```

### Relationship Mapping

- **BindingEvent**: One or more `e` tags (mention) → Products AND Metadata (M:N relationship)
- **UpdateEvent**: One `e` tag (root) → original event
- **ContestationEvent**: `e` (root) → contested event, `e` (mention) → alternative
- **ConfirmationEvent**: One `e` tag (root) → confirmed event

## UI/UX Specifications

### Page Structure

**Main View**: Bindings List (Default Landing)
- Vertical list of BindingEvent cards
- Click card → Expand to detailed view

**Detailed View**: Single Binding (When clicked)
- **Top Center**: Binding info
- **Left Panel**: Product details
- **Right Panel**: Metadata details
- **Bottom**: Replies & Activity (tabs/collapsible)

### Main View: Bindings List

Each binding card shows:
- **Author** (npub: first 8 + "..." + last 4 chars)
- **Timestamp** (relative: "2 days ago")
- **Description** (first 100 chars from `content`)
- **Badges**:
  - Confirmation count (green)
  - Contestation count (red)
  - "Updated" indicator (orange)

### Detailed View Layout

#### Section 1: Binding Info (Top Center)
- Author pubkey
- Created timestamp
- Full `content` text
- Nostr event ID (with copy button)

#### Section 2: Product Details (Left Panel)
- **Note**: A binding can reference MULTIPLE products (displayed in a grid if more than one)
- **Title**: Product name
- **Info Card**:
  - Vendor
  - Product version
  - CPE23 / PURL
  - Release date
  - Canonical URL
  - Author pubkey
  - Event timestamp

#### Section 3: Metadata Details (Right Panel)
- **Note**: A binding can reference MULTIPLE metadata files (displayed in a grid if more than one)
- **Title**: Metadata type/description
- **Info Card**:
  - URL to external data
  - SHA256 hash (monospace, truncated, copy button)
  - Author pubkey
  - Event timestamp
  - File size/type (if available)
- **Action**: "View External Data" button

#### Section 4: Replies & Activity (Bottom)

**Updates**:
- If UpdateEvent from **same pubkey**:
  - **Replace** displayed content with updated version
  - Show "Updated" badge (orange) with timestamp
  - Add "View Original" toggle button
  - Clicking toggle shows old event

**Confirmations** (collapsible):
- List all ConfirmationEvents
- Show: Author, timestamp, message
- Green theme
- Badge count indicator

**Contestations** (collapsible):
- List all ContestationEvents
- Show: Author, timestamp, dispute message
- Link to alternative MetadataEvent
- Red/warning theme
- Badge count indicator

## Visual Design Guidelines (sec-certs.org Style)

### Color Scheme
```css
/* Backgrounds */
--bg-primary: #FFFFFF;
--bg-secondary: #F8F9FA;

/* Accent Colors */
--accent-primary: #2C5AA0;      /* Deep blue */
--accent-secondary: #17A2B8;     /* Teal */

/* Event Type Colors */
--color-product: #2C5AA0;        /* Navy blue */
--color-metadata: #17A2B8;       /* Teal */
--color-binding: #28A745;        /* Green */
--color-update: #FD7E14;         /* Orange */
--color-contestation: #DC3545;   /* Red */
--color-confirmation: #20C997;   /* Success green */

/* Text Colors */
--text-primary: #212529;         /* Dark gray */
--text-secondary: #495057;       /* Medium gray */
--text-tertiary: #6C757D;        /* Light gray */
--text-meta: #868E96;            /* Very light gray */

/* Borders */
--border-color: #DEE2E6;
```

### Typography
- **Font Family**: Roboto, system-ui, sans-serif
- **Monospace**: Roboto Mono, Courier New, monospace
- **Sizes**:
  - Page title: 32px, bold
  - Section headers: 24px, bold
  - Subsection headers: 18px, medium
  - Body text: 15px, regular
  - Metadata/labels: 13px, regular
  - Badges: 12px, medium, uppercase

### Component Styles

#### Cards
```css
background: #FFFFFF;
border: 1px solid #DEE2E6;
border-radius: 4px;
box-shadow: 0 1px 3px rgba(0,0,0,0.08);
padding: 20px;

/* Hover */
box-shadow: 0 2px 8px rgba(0,0,0,0.12);
```

#### Badges
```css
border-radius: 12px;
font-size: 12px;
font-weight: 500;
text-transform: uppercase;
padding: 4px 10px;
color: white;
```

#### Buttons
```css
/* Primary */
background: #2C5AA0;
color: white;
border: none;
border-radius: 4px;
padding: 8px 16px;
font-size: 14px;
font-weight: 500;

/* Secondary */
background: transparent;
color: #2C5AA0;
border: 1px solid #2C5AA0;
```

#### Tables
```css
/* Header */
background: #F8F9FA;
border: 1px solid #DEE2E6;

/* Row hover */
background: #E7F1FF;

/* Striped */
background: #F8F9FA;
```

#### Collapsible Sections
```css
/* Header */
background: #F8F9FA;
border: 1px solid #DEE2E6;
transition: all 200ms ease;

/* Content */
background: white;
```

### Layout
- **Max width**: 1200px
- **Responsive breakpoint**: 768px (stack vertically on mobile)
- **Spacing**:
  - Small: 8px
  - Medium: 16px
  - Large: 24px
  - Extra large: 32px

### Data Display

**Hashes/IDs**:
```css
font-family: monospace;
background: #F8F9FA;
color: #212529;
padding: 4px 8px;
border-radius: 4px;
/* Truncate long hashes with ellipsis */
```

**Timestamps**:
- Display: Relative ("2 days ago")
- Tooltip: Absolute date/time
- Color: `#868E96`

**Links**:
```css
color: #2C5AA0;
text-decoration: none;

/* Hover */
text-decoration: underline;
```

### Iconography
- **Style**: Line icons (Feather Icons or similar)
- **Size**: 16-20px
- **Common icons**:
  - Copy: clipboard
  - External: arrow-up-right
  - Download: download
  - Expand: chevron-down
  - Collapse: chevron-up
  - Updated: refresh-cw
  - Info: info

## Functional Requirements

### On Page Load
1. Show loading spinner
2. Connect to `wss://relay.damus.io`
3. Subscribe with filter
4. Collect events until EOSE
5. Close connection
6. Parse and categorize
7. Display BindingEvents list

### User Interactions
1. **Click binding card** → Show detailed view
2. **Click "View Original"** → Toggle old/new versions
3. **Expand/collapse** Confirmations/Contestations
4. **Copy buttons** → Copy hash/ID to clipboard
5. **"View External Data"** → Open URL in new tab
6. **Back button** → Return to bindings list

### Error Handling
- Loading spinner while fetching
- Error message if connection fails
- Handle missing events gracefully
- Show "No events found" if empty

### State Management

Group events by:
```javascript
{
  bindings: Map<id, Event>,      // All BindingEvents
  products: Map<id, Event>,      // Keyed by event ID
  metadata: Map<id, Event>,      // Keyed by event ID
  updates: Map<originalId, Event>,
  contestations: Map<targetId, Event[]>,
  confirmations: Map<targetId, Event[]>
}
```

## Implementation Priority

1. **Phase 1**: Basic relay connection and event fetching
2. **Phase 2**: Bindings list view
3. **Phase 3**: Detailed view (product + metadata)
4. **Phase 4**: Reply events (updates/contestations/confirmations)
5. **Phase 5**: Polish UI and visual enhancements

## Notes

- This is a **proof-of-concept** - prioritize functionality over edge cases
- Events are fetched **once** on page load (not live/real-time)
- Use sec-certs.org visual style for familiarity
- Focus on clarity and readability of security data