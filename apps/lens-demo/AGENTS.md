# AI Agent Instructions for Scrutiny Events Viewer

**Project:** Scrutiny Lens Demo
**Version:** 1.0
**Last Updated:** October 24, 2025

---

## 1. Project Overview

### What is This Project?

This is a **Nostr-based Scrutiny protocol viewer** - a decentralized security metadata overlay system. It visualizes security product information, metadata (test results, certifications, vulnerabilities), and their cryptographically-signed bindings on the Nostr network.

### Technology Stack

```yaml
Framework: React 18.3+ with TypeScript
Build Tool: Vite 6.3+
State Management: Zustand (via AppContext), TanStack Query for data fetching
Nostr Integration: @nostrify/nostrify + @nostrify/react
UI Library: shadcn/ui (48+ Radix UI components + Tailwind CSS 3.x)
Graph Visualization: @xyflow/react
Styling: TailwindCSS 3.x with custom design system
Testing: Vitest + React Testing Library
```

### Key Dependencies

- **@nostrify/nostrify**: Core Nostr protocol implementation
- **@nostrify/react**: React hooks for Nostr (`useNostr`, `useAuthor`)
- **nostr-tools**: NIP-19 encoding/decoding utilities
- **@tanstack/react-query**: Data fetching and caching
- **@xyflow/react**: Interactive graph visualization
- **date-fns**: Date formatting and manipulation
- **shadcn/ui components**: Pre-built accessible UI components

---

## 2. Architecture Summary

### Data Fetching Strategy

The application uses a **three-phase data fetching model** via the `useScrutinyEvents` hook:

```typescript
Phase 1: Query all SCRUTINY tagged events
  ↓ (Fetch products, metadata, bindings, updates, confirmations, contestations)

Phase 1.5: Extract e-tag mentions from bindings
  ↓ (Fetch any missing referenced products/metadata)

Phase 2: Query events that reference products/metadata/bindings
  ↓ (Fetch updates, confirmations, contestations for known events)

Phase 3: Fetch alternative metadata from contestations
  ↓ (Get alternative metadata referenced in contestation events)

Result: Categorized events + Relationship mappings
```

### Event Types (All kind:1 with specific t tags)

```typescript
type EventType =
  | 'product'        // Hardware/software product (e.g., "OpenSSL 3.0.0")
  | 'metadata'       // External security data (test results, certs, etc.)
  | 'binding'        // Links product(s) to metadata
  | 'update'         // Author updates their own event
  | 'confirmation'   // Third-party endorses an event
  | 'contestation'   // Third-party disputes metadata with alternative
  | 'unknown';       // Not a SCRUTINY event
```

**Tag Variants:** Each event type accepts **4 tag variants**:

- Plain: `scrutiny_product`
- Hashed: `#scrutiny_product`
- V01: `scrutiny_product_v01`
- Hashed V01: `#scrutiny_product_v01`

**Legacy Support:** Also accepts hyphenated variants (e.g., `scrutiny-product`, `scrutiny-product-v0`)

### Data Structure

```typescript
interface ScrutinyData {
  categorized: CategorizedEvents;     // Events grouped by type
  relationships: Relationships;        // ID mappings between events
  allEvents: NostrEvent[];            // All unique fetched events
}

interface CategorizedEvents {
  bindings: Map<id, Event>;           // All binding events
  products: Map<id, Event>;           // All product events
  metadata: Map<id, Event>;           // All metadata events
  updates: Map<originalId, Event>;    // Updates keyed by original event ID
  confirmations: Map<targetId, Event[]>;  // Confirmations by target
  contestations: Map<targetId, Event[]>;  // Contestations by target
}

interface Relationships {
  bindingToProducts: Map<bindingId, productId[]>;
  bindingToMetadata: Map<bindingId, metadataId[]>;
  productToBindings: Map<productId, bindingId[]>;
  metadataToBindings: Map<metadataId, bindingId[]>;
  contestationToAlternative: Map<contestationId, alternativeMetadataId>;
}
```

---

## 3. Key Components and Their Purpose

### Core Application Components

#### `App.tsx` (Root)

- Sets up providers: `NostrProvider` → `QueryClientProvider` → `AppProvider`
- Renders `AppRouter` with error boundary
- Configures Nostr relay pool and React Query defaults

#### `AppRouter.tsx`

- Client-side routing with React Router
- Routes: `/` (Index), `/:nip19` (NIP19Page), `*` (NotFound)
- Includes `ScrollToTop` component for route changes

#### `AppProvider.tsx`

- Global app configuration context
- Manages theme (light/dark) and relay URL
- Persists settings to localStorage
- Provides `useAppContext` hook

### Data Hooks

#### `useScrutinyEvents` (Primary Data Source)

**Location:** `src/hooks/useScrutinyEvents.ts`

**Purpose:** Fetches and processes all SCRUTINY events from relay

**Returns:**

```typescript
{
  data: ScrutinyData | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**Usage Pattern:**

```typescript
const { data, isLoading, error } = useScrutinyEvents();

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

const { categorized, relationships } = data;
```

#### `useAuthor`

**Purpose:** Fetch kind:0 profile metadata for a pubkey

**Returns:**

```typescript
{
  data: { metadata: NostrMetadata } | undefined;
  isLoading: boolean;
}
```

**Usage:** Display author names, profile pictures, etc.

### Page Components

#### `Index.tsx` (Main View)

- Landing page showing bindings list
- Integrates `FilterBar` for filtering bindings
- Renders `BindingCard` components in a grid
- Shows `DetailedView` when binding is selected
- Includes "Powered by Nostr" footer

#### `NIP19Page.tsx` (NIP-19 Router)

- Handles Nostr identifier routing (`/npub1...`, `/note1...`, etc.)
- Decodes NIP-19 identifiers and shows appropriate views
- Supports: npub, nprofile, note, nevent, naddr
- Shows 404 for invalid/unsupported identifiers

#### `NotFound.tsx`

- 404 error page with navigation options

### Display Components

#### `BindingCard.tsx`

**Purpose:** Display summary of a binding event in the list

**Shows:**

- Binding description (content preview)
- Author name (with njump.me link)
- Created timestamp (relative)
- Activity indicators (confirmations count)
- Click to expand to `DetailedView`

#### `ProductCard.tsx`

**Purpose:** Display product information in detailed view

**Shows:**

- Product name, vendor, version
- CPE 2.3, PURL, ATR identifiers (with validation)
- Certification details (type, EAL, security level, validity dates)
- Country flags for certification schemes
- Technical specifications (crypto algorithms, JavaCard versions)
- URLs and links
- Activity (confirmations, other bindings)
- Update indicator (toggle between original/updated)

**Helper Functions:**

- `validateCPE23()` - Validates CPE 2.3 format
- `validatePURL()` - Validates Package URL format
- `getCountryFlag()` - Maps country codes to flag emojis
- `formatDate()` - Formats ISO dates
- `getUrlDomain()` - Extracts domain from URL

#### `MetadataCard.tsx`

**Purpose:** Display metadata file information

**Shows:**

- File name/title (truncated, click to expand)
- URL to external file (with verified badge if hash present)
- SHA-256 hash (truncated with copy button)
- File type, size
- Labels (source, type, tool)
- "View External File" button
- Activity (confirmations, contestations with alternatives)
- Update indicator

#### `DetailedView.tsx`

**Purpose:** Expanded view of a single binding with related events

**Structure:**

DetailedView/
├─ BackButton (return to list)
├─ BindingDetailsCard (binding info)
├─ ProductsSection
│   └─ ProductCard[] (grid layout, multiple products)
├─ MetadataSection
│   └─ MetadataCard[] (grid layout, multiple metadata)
├─ GraphPanel (relationship visualization)
└─ Footer

### Filtering Components

#### `FilterBar.tsx`

**Purpose:** Filter bindings list by various criteria

**Filters:**

- Date range (start/end Unix timestamps)
- Author (pubkey hex or npub)
- D tag (stable identifier, partial match)
- CPE 2.3 (identifier, partial match)

**Features:**

- "Clear All" button
- Filter count badge
- Real-time filtering via `applyFilters()` utility

### Graph Visualization

#### `GraphPanel.tsx`

**Purpose:** Container for graph visualization with toolbar

**Features:**

- Collapsible panel
- Graph toolbar integration
- Passes data to `GraphVisualization`

#### `GraphVisualization.tsx`

**Purpose:** Interactive graph using @xyflow/react

**Node Types:**

- `BindingNode` (center, green border)
- `ProductNode` (left side, blue border)
- `MetadataNode` (right side, orange border)
- `ReplyNode` (confirmations/contestations)

**Features:**

- Click node → scroll to corresponding card
- Hover for tooltips
- Export to PNG/SVG
- Search/filter nodes
- Static or force-directed layout

#### `GraphToolbar.tsx`

**Purpose:** Controls for graph visualization

**Actions:**

- Search nodes
- Toggle edge labels
- Export graph (PNG/SVG)
- Reset view
- Fit to view

### Utility Components

#### `EventId.tsx`

**Purpose:** Display Nostr event ID with copy functionality

**Features:**

- Truncated display (first 8 + last 4 chars)
- Click to copy full ID
- Toast notification on copy

#### `RawEventDialog.tsx`

**Purpose:** Show raw Nostr event JSON

**Features:**

- Syntax-highlighted JSON
- Theme-aware colors
- Copy JSON button
- Scrollable content area
- Fixed toolbar

#### `ContentWithImages.tsx`

**Purpose:** Render event content with rich formatting

**Supports:**

- URL auto-linking
- Image embedding (from URLs)
- Line breaks and whitespace preservation

#### `NoteContent.tsx`

**Purpose:** Render Nostr text note content with links

**Supports:**

- Clickable URLs
- Nostr URI links (nostr:npub..., nostr:note...)
- Hashtag formatting
- Whitespace preservation

#### `RelaySelector.tsx`

**Purpose:** Switch between Nostr relays

**Presets:**

- Ditto, Nostr.Band, Damus, Primal
- Custom relay input

---

## 4. Development Guidelines

### Code Style Preferences

#### React Patterns

```typescript
// ✅ Use functional components with hooks
export function MyComponent({ prop }: Props) {
  const [state, setState] = useState<Type>(initial);
  const data = useQuery(...);

  return <div>...</div>;
}

// ❌ Avoid class components
class MyComponent extends React.Component { }
```

#### TypeScript Strict Mode

```typescript
// ✅ Always define types, never use 'any'
interface Props {
  event: ScrutinyEvent;
  onClick: (id: string) => void;
}

// ❌ Avoid 'any'
const data: any = ...;
```

#### Async/Await Pattern

```typescript
// ✅ Use async/await with error handling
try {
  const data = await nostr.query(filter, { signal });
  return processData(data);
} catch (error) {
  console.error('Query failed:', error);
  throw error;
}
```

### State Management

#### Local State (useState)

Use for component-specific UI state:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [selectedId, setSelectedId] = useState<string | null>(null);
```

#### Global State (Zustand via AppContext)

Use for app-wide configuration:

```typescript
const { theme, relayUrl, setTheme, setRelayUrl } = useAppContext();
```

#### Server State (TanStack Query)

Use for data fetching:

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['key'],
  queryFn: async () => fetchData(),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### UI Component Patterns

#### shadcn/ui Usage

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Use variants
<Button variant="outline" size="sm">Click</Button>
<Badge variant="destructive">Error</Badge>
```

#### Conditional Rendering

```typescript
// ✅ Use early returns for loading/error states
if (isLoading) return <Skeleton />;
if (error) return <Alert>{error.message}</Alert>;
if (!data) return <EmptyState />;

// Render success state
return <DataDisplay data={data} />;
```

#### Class Name Merging

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  props.className
)} />
```

### File Organization

src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── auth/           # Authentication components
│   ├── graph/          # Graph visualization components
│   └── *.tsx           # Feature components
├── pages/              # Route page components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and business logic
├── contexts/           # React context providers
└── test/               # Testing utilities

### Import Conventions

```typescript
// External dependencies first
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal modules with @ alias
import { useNostr } from '@/hooks/useNostr';
import { Button } from '@/components/ui/button';
import type { ScrutinyEvent } from '@/lib/scrutiny';

// Relative imports only for same directory
import { HelperComponent } from './HelperComponent';
```

---

## 5. Testing Strategy

### Component Testing

#### Basic Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(
      <TestApp>
        <MyComponent prop="value" />
      </TestApp>
    );

    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

#### Testing with User Interactions

```typescript
import { fireEvent } from '@testing-library/react';

it('handles click events', () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);

  fireEvent.click(screen.getByText('Click me'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Event Parsing Tests

#### Test Event Type Identification

```typescript
import { determineEventType } from '@/lib/scrutiny';

describe('determineEventType', () => {
  it('identifies all tag variants', () => {
    expect(determineEventType([['t', 'scrutiny_product']])).toBe('product');
    expect(determineEventType([['t', '#scrutiny_product']])).toBe('product');
    expect(determineEventType([['t', 'scrutiny_product_v01']])).toBe('product');
    expect(determineEventType([['t', '#scrutiny_product_v01']])).toBe('product');
  });

  it('prioritizes reply events', () => {
    // Update event that also has product tag
    const tags = [
      ['t', 'scrutiny_update'],
      ['t', 'scrutiny_product'],
    ];
    expect(determineEventType(tags)).toBe('update');
  });
});
```

### Filter Logic Tests

```typescript
import { applyFilters } from '@/lib/scrutiny';

describe('applyFilters', () => {
  it('filters by date range', () => {
    const events = [
      { created_at: 1000, ...mockEvent },
      { created_at: 2000, ...mockEvent },
      { created_at: 3000, ...mockEvent },
    ];

    const filtered = applyFilters(events, {
      dateRange: { start: 1500, end: 2500 },
      author: null,
      dTag: null,
      cpe23: null,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].created_at).toBe(2000);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run dev

# Coverage report
npm run test -- --coverage
```

---

## 6. Common Tasks

### Task 1: Adding a New Event Type Display

**Scenario:** Add support for a new SCRUTINY event type (e.g., `scrutiny_vulnerability`)

**Steps:**

1. **Update type definitions** in `src/lib/scrutiny.ts`:

```typescript
type EventType =
  | 'product'
  | 'metadata'
  | 'binding'
  | 'update'
  | 'confirmation'
  | 'contestation'
  | 'vulnerability'  // New type
  | 'unknown';
```

2. **Update `determineEventType()` function**:

```typescript
if (includesAny('scrutiny_vulnerability')) return 'vulnerability';
```

3. **Add to categorization** in `categorizeEvents()`:

```typescript
interface CategorizedEvents {
  // ...existing
  vulnerabilities: Map<string, ScrutinyEvent>;  // New category
}

// In categorizeEvents():
case 'vulnerability':
  categories.vulnerabilities.set(event.id, scrutinyEvent);
  break;
```

4. **Update query in `useScrutinyEvents`**:

```typescript
'#t': [
  // ...existing tags
  'scrutiny_vulnerability',
  '#scrutiny_vulnerability',
  'scrutiny_vulnerability_v01',
  '#scrutiny_vulnerability_v01',
]
```

5. **Create display component** `VulnerabilityCard.tsx`:

```typescript
export function VulnerabilityCard({ vulnerability }: Props) {
  const labels = extractLabels(vulnerability);
  const cveId = labels['cve_id']?.value;
  const severity = labels['severity']?.value;

  return (
    <Card className="border-2 border-red-500">
      {/* Display vulnerability details */}
    </Card>
  );
}
```

6. **Add to `DetailedView.tsx`**:

```typescript
{/* Vulnerabilities Section */}
{vulnerabilities.length > 0 && (
  <div>
    <h2>Vulnerabilities</h2>
    <div className="grid gap-4">
      {vulnerabilities.map(vuln => (
        <VulnerabilityCard key={vuln.id} vulnerability={vuln} />
      ))}
    </div>
  </div>
)}
```

### Task 2: Extending Filtering Capabilities

**Scenario:** Add filter by certification EAL level

**Steps:**

1. **Update filter interface** in `src/lib/scrutiny.ts`:

```typescript
export interface EventFilters {
  dateRange: { start: number | null; end: number | null };
  author: string | null;
  dTag: string | null;
  cpe23: string | null;
  eal: string | null;  // New filter
}
```

2. **Update `applyFilters()` function**:

```typescript
if (filters.eal) {
  const labels = extractLabels(event);
  const eal = labels['eal']?.value;
  if (!eal || !eal.includes(filters.eal)) {
    return false;
  }
}
```

3. **Add UI control in `FilterBar.tsx`**:

```typescript
const [eal, setEal] = useState('');

<Input
  placeholder="EAL level (e.g., EAL4+)"
  value={eal}
  onChange={(e) => {
    setEal(e.target.value);
    onFilterChange({ ...filters, eal: e.target.value || null });
  }}
/>
```

### Task 3: Modifying Graph Visualization

**Scenario:** Change node colors based on event status

**Steps:**

1. **Update node styling** in `src/components/graph/ProductNode.tsx`:

```typescript
export function ProductNode({ data }: NodeProps<ProductNodeData>) {
  const product = data.event;
  const labels = extractLabels(product);
  const status = labels['status']?.value;

  const borderColor = status?.includes('active')
    ? '#28A745'  // Green for active
    : status?.includes('revoked')
    ? '#DC3545'  // Red for revoked
    : '#2C5AA0'; // Blue default

  return (
    <div style={{ border: `3px solid ${borderColor}` }}>
      {/* Node content */}
    </div>
  );
}
```

2. **Update edge styling** in `GraphVisualization.tsx`:

```typescript
const edges: Edge[] = products.map((productId, index) => ({
  id: `binding-product-${index}`,
  source: binding.id,
  target: productId,
  type: 'smoothstep',
  animated: hasUpdate,  // Animate if binding has update
  style: {
    stroke: hasUpdate ? '#FD7E14' : '#2C5AA0',
    strokeWidth: 2,
  },
}));
```

### Task 4: Adding New UI Components

**Scenario:** Add a statistics dashboard showing event counts

**Steps:**

1. **Create component** `src/components/StatsDashboard.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsProps {
  categorized: CategorizedEvents;
}

export function StatsDashboard({ categorized }: StatsProps) {
  const stats = [
    { label: 'Bindings', count: categorized.bindings.size, icon: '🔗' },
    { label: 'Products', count: categorized.products.size, icon: '📦' },
    { label: 'Metadata', count: categorized.metadata.size, icon: '📄' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(stat => (
        <Card key={stat.label}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span>{stat.icon}</span>
              <span>{stat.label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stat.count}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

2. **Add to `Index.tsx`**:

```typescript
import { StatsDashboard } from '@/components/StatsDashboard';

<StatsDashboard categorized={data.categorized} />
```

---

## 7. Project-Specific Conventions

### Event Type Determination Logic

**Critical Priority Order:**

```typescript
// MUST check reply events FIRST before base events
// Reply events contain BOTH their reply tag AND the original event's tag

if (includesAny('scrutiny_update')) return 'update';           // 1st
if (includesAny('scrutiny_contestation')) return 'contestation'; // 2nd
if (includesAny('scrutiny_confirmation')) return 'confirmation'; // 3rd

// Then check base events
if (includesAny('scrutiny_product')) return 'product';
if (includesAny('scrutiny_metadata')) return 'metadata';
if (includesAny('scrutiny_binding')) return 'binding';
```

**Why?** An UpdateEvent will have both `scrutiny_update` AND the original event's type tag (e.g., `scrutiny_product`). Checking updates first ensures correct classification.

### NIP-19 Identifier Handling

**Always decode before using:**

```typescript
import { nip19 } from 'nostr-tools';

// Decode npub to hex pubkey
const decoded = nip19.decode(npub);
if (decoded.type === 'npub') {
  const pubkeyHex = decoded.data;  // Use this in queries
}

// Encode hex pubkey to npub
const npub = nip19.npubEncode(pubkeyHex);
```

**URL routing:**

- Root-level routes: `/:nip19` catches all NIP-19 identifiers
- Supported: `npub1...`, `note1...`, `nevent1...`, `nprofile1...`, `naddr1...`
- Invalid/unsupported identifiers show 404

### Relay Connection Patterns

**Single relay (default):**

```typescript
const { nostr } = useNostr();
const relay = nostr.relay('wss://relay.damus.io');
const events = await relay.query(filter, { signal });
```

**Multiple relays:**

```typescript
const relayGroup = nostr.group([
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
]);
const events = await relayGroup.query(filter, { signal });
```

**Always use timeouts:**

```typescript
const signal = AbortSignal.any([
  context.signal,
  AbortSignal.timeout(30000)  // 30 second timeout
]);
```

### Update Replacement Logic

**When to replace original with update:**

```typescript
function shouldReplace(original, update): boolean {
  // 1. Update must reference original with root tag
  const hasRootTag = update.tags.some(t =>
    t[0] === 'e' && t[1] === original.id && t[3] === 'root'
  );
  if (!hasRootTag) return false;

  // 2. Same author only
  if (update.pubkey !== original.pubkey) return false;

  // 3. Must be newer
  if (update.created_at <= original.created_at) return false;

  // 4. Must have update tag (any variant)
  const hasUpdateTag = update.tags.some(t =>
    t[0] === 't' &&
    ['scrutiny_update', '#scrutiny_update',
     'scrutiny_update_v01', '#scrutiny_update_v01'].includes(t[1])
  );

  return hasUpdateTag;
}
```

**Display pattern:**

```typescript
const { display, isUpdated } = getDisplayEvent(original, update, showOriginal);

// Show "Updated" badge with toggle
{isUpdated && (
  <Badge
    onClick={() => setShowOriginal(!showOriginal)}
    className="cursor-pointer"
  >
    {showOriginal ? 'Original' : 'Updated'}
  </Badge>
)}
```

### Label Extraction (NIP-32)

**Format:** `["l", "<name>", "<value>", "<type>"]`

```typescript
const labels = extractLabels(event);

// Access labels
const cpe23 = labels['cpe23']?.value;
const vendor = labels['vendor']?.value;
const eal = labels['eal']?.value;

// Check if label exists
if (labels['cpe23']) {
  console.log('Has CPE:', labels['cpe23'].value);
}
```

### E-Tag Relationships

**Roles:**

- `mention`: References another event (binding → product/metadata)
- `root`: Original event for updates/confirmations/contestations
- `reply`: Direct reply (not commonly used in SCRUTINY)

```typescript
// Get all mentions
const mentions = extractETags(event, 'mention');

// Get root event ID
const rootId = extractETags(event, 'root')[0];

// Get all e-tags regardless of role
const allETags = extractETags(event, null);
```

### Content Parsing Hints

**Binding content format:**

```
Product: nostr:note1abc...
Metadata: nostr:note1def...

This binding attaches test results to OpenSSL 3.0.0
```

**Parsing logic:**

```typescript
const productMatch = line.match(/^Product:\s+nostr:(note1[a-z0-9]+)/i);
const metadataMatch = line.match(/^Metadata:\s+nostr:(note1[a-z0-9]+)/i);
```

This helps determine product vs. metadata when events aren't in the categorized maps.

---

## 8. Validation and Error Handling

### Input Validation

**CPE 2.3 Format:**

```typescript
function validateCPE23(cpe: string): boolean {
  // Format: cpe:2.3:part:vendor:product:version:update:edition:lang:sw_ed:target_sw:target_hw:other
  const pattern = /^cpe:2\.3:[aho\*\-](:([a-zA-Z0-9\._\-~%]*|\*)){10}$/;
  return pattern.test(cpe);
}
```

**PURL Format:**

```typescript
function validatePURL(purl: string): boolean {
  // Format: pkg:type/namespace/name@version
  const pattern = /^pkg:[a-z]+\/([a-zA-Z0-9\-._]+\/)?[a-zA-Z0-9\-._]+(@[a-zA-Z0-9\-._+]+)?(\?.*)?$/;
  return pattern.test(purl);
}
```

### Error Boundaries

**Wrap risky components:**

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

### Loading States

**Use skeleton loaders:**

```typescript
import { Skeleton } from '@/components/ui/skeleton';

if (isLoading) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}
```

### Empty States

**Show helpful messages:**

```typescript
if (bindings.length === 0) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground">
          No bindings found. Try another relay?
        </p>
        <RelaySelector className="mt-4" />
      </CardContent>
    </Card>
  );
}
```

---

## 9. Performance Optimization

### Memoization

**Expensive computations:**

```typescript
const filteredBindings = useMemo(
  () => applyFilters(bindings, filters),
  [bindings, filters]
);

const productCards = useMemo(
  () => productIds.map(id =>
    categorized.products.get(id)
  ).filter(Boolean),
  [productIds, categorized.products]
);
```

### Query Optimization

**Batch requests when possible:**

```typescript
// ✅ Single query with multiple IDs
const events = await relay.query([{
  kinds: [1],
  ids: [...productIds, ...metadataIds]
}]);

// ❌ Multiple separate queries
const products = await relay.query([{ kinds: [1], ids: productIds }]);
const metadata = await relay.query([{ kinds: [1], ids: metadataIds }]);
```

**Chunk large ID lists:**

```typescript
const chunkSize = 100;
const allEvents = [];

for (let i = 0; i < ids.length; i += chunkSize) {
  const chunk = ids.slice(i, i + chunkSize);
  const events = await relay.query([{ kinds: [1], ids: chunk }]);
  allEvents.push(...events);
}
```

### React Query Caching

**Configure stale times:**

```typescript
useQuery({
  queryKey: ['scrutiny-events'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000,      // 5 minutes
  gcTime: 10 * 60 * 1000,        // 10 minutes (formerly cacheTime)
});
```

---

## 10. Design System

### Color Palette

```css
/* Event Types */
--product: #2C5AA0;        /* Navy blue */
--metadata: #FD7E14;       /* Orange */
--binding: #28A745;        /* Green */
--update: #FD7E14;         /* Orange */
--confirmation: #20C997;   /* Success green */
--contestation: #DC3545;   /* Red */

/* UI Colors */
--primary: #2C5AA0;
--secondary: #17A2B8;
--muted: #6C757D;
--border: #DEE2E6;
```

### Typography

```typescript
// Font families (configured in src/main.tsx)
font-sans: ['Inter Variable', 'Inter', 'system-ui']
font-mono: ['Roboto Mono', 'monospace']

// Sizes (Tailwind)
text-xs: 12px
text-sm: 14px
text-base: 16px
text-lg: 18px
text-xl: 20px
text-2xl: 24px
```

### Spacing

```typescript
// Tailwind spacing scale
gap-2: 8px
gap-4: 16px
gap-6: 24px
gap-8: 32px

// Component padding
p-4: 16px (standard card padding)
p-6: 24px (large card padding)
```

### Component Patterns

**Card variants:**

```typescript
<Card className="border-2 border-product">      {/* Product */}
<Card className="border-2 border-metadata">     {/* Metadata */}
<Card className="border-2 border-binding">      {/* Binding */}
```

**Badge variants:**

```typescript
<Badge variant="outline">Default</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Info</Badge>
<Badge className="bg-confirmation">Confirmed</Badge>
```

---

## 11. Documentation Files

### Key Documentation to Reference

1. **`AGENTS.md`** - Base system prompt for AI agents (this file's parent)
2. **`docs/ARCHITECTURE.md`** - Detailed architecture and data flow
3. **`docs/SCRUTINY_CONTEXT.md`** - SCRUTINY protocol specification
4. **`docs/GRAPH_VISUALIZATION.md`** - Graph feature specification
5. **`docs/NOSTR_COMMENTS.md`** - Comment system (if implemented)
6. **`docs/NOSTR_INFINITE_SCROLL.md`** - Infinite scroll patterns
7. **`docs/AI_CHAT.md`** - AI chat integration (if implemented)

### When to Consult Documentation

- **Adding new features:** Check `ARCHITECTURE.md` for patterns
- **Understanding SCRUTINY protocol:** Read `SCRUTINY_CONTEXT.md`
- **Modifying graph:** Review `GRAPH_VISUALIZATION.md`
- **Implementing feeds:** Reference `NOSTR_INFINITE_SCROLL.md`
- **General guidance:** Start with `AGENTS.md`

---

## 12. Deployment and Build

### Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Run all tests + build
npm test

# Deploy to Nostr
npm run deploy
```

### Build Output

dist/
├── index.html
├── 404.html (copy of index.html for SPA routing)
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── _redirects (for Netlify/Vercel)

### Environment Variables

**Not required for basic functionality**, but can be configured:

```env
# Optional: Override default relay
VITE_NOSTR_RELAY=wss://relay.damus.io
```

---

## 13. Common Issues and Solutions

### Issue: Events Not Loading

**Symptoms:** Empty list, no bindings displayed

**Solutions:**

1. Check relay connection: Ensure `wss://relay.damus.io` is accessible
2. Verify query filter: Check console logs for query results
3. Check event categorization: Look for "unknown" events in console
4. Inspect network tab: Verify WebSocket connection established

### Issue: Updates Not Showing

**Symptoms:** "Updated" badge not appearing, old data displayed

**Solutions:**

1. Verify update event has correct `e` tag with `role="root"`
2. Check pubkey matches original event
3. Ensure update timestamp is newer
4. Confirm update has `scrutiny_update` tag (any variant)
5. Check `shouldReplace()` logic in `scrutiny.ts`

### Issue: Graph Not Rendering

**Symptoms:** Blank graph area, no nodes visible

**Solutions:**

1. Check ReactFlow import: `import { ReactFlow } from '@xyflow/react'`
2. Verify node/edge data structure
3. Check container has explicit height
4. Ensure `@xyflow/react` CSS is imported
5. Check console for ReactFlow errors

### Issue: Filters Not Working

**Symptoms:** Filtering doesn't change displayed bindings

**Solutions:**

1. Verify `applyFilters()` is called with current filters
2. Check filter state updates (use React DevTools)
3. Ensure filtered array is used in rendering
4. Check memoization dependencies
5. Validate filter input formats (hex pubkey, Unix timestamp, etc.)

---

## 14. Testing Checklist

Before considering a feature complete:

- [ ] Component renders without errors
- [ ] Loading states display correctly
- [ ] Error states handled gracefully
- [ ] Empty states show helpful messages
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Unit tests pass (if applicable)
- [ ] Component tests pass
- [ ] Manual testing in browser completed
- [ ] Responsive design checked (mobile, tablet, desktop)
- [ ] Dark mode tested
- [ ] Accessibility verified (keyboard navigation, screen readers)
- [ ] Performance acceptable (no lag, smooth interactions)

---

## 15. Resources

### External Documentation

- **Nostr Protocol:** <https://github.com/nostr-protocol/nips>
- **Nostrify Docs:** <https://nostrify.dev/>
- **React Query:** <https://tanstack.com/query/latest/docs/react/overview>
- **shadcn/ui:** <https://ui.shadcn.com/>
- **TailwindCSS:** <https://tailwindcss.com/docs>
- **ReactFlow:** <https://reactflow.dev/>
- **Vite:** <https://vitejs.dev/>
- **Vitest:** <https://vitest.dev/>

### Internal Code References

**Key utilities:**

- `src/lib/scrutiny.ts` - Core SCRUTINY protocol logic
- `src/lib/utils.ts` - General utilities (cn, formatters)
- `src/lib/nip19.ts` - NIP-19 encoding/decoding
- `src/lib/graph.ts` - Graph data transformation

**Main hooks:**

- `src/hooks/useScrutinyEvents.ts` - Primary data fetching
- `src/hooks/useAuthor.ts` - Profile metadata
- `src/hooks/useNostr.ts` - Nostr client access
- `src/hooks/useAppContext.ts` - App configuration

---

## 16. Quick Reference

### Event Type Quick Lookup

| Type | T Tag | Purpose | Key Fields |
|------|-------|---------|------------|
| Product | `scrutiny_product` | Hardware/software product | vendor, product_name, version, cpe23, purl |
| Metadata | `scrutiny_metadata` | External security data | url, x (hash), m (MIME), size |
| Binding | `scrutiny_binding` | Links product to metadata | e tags (mention) → products & metadata |
| Update | `scrutiny_update` | Author revises event | e tag (root) → original event |
| Confirmation | `scrutiny_confirmation` | Third-party endorsement | e tag (root) → confirmed event |
| Contestation | `scrutiny_contestation` | Dispute with alternative | e (root) → contested, e (mention) → alternative |

### Common Tag Patterns

```typescript
// Product references
["e", "<product-id>", "", "mention"]

// Metadata references
["e", "<metadata-id>", "", "mention"]

// Update original
["e", "<original-id>", "", "root"]

// Stable identifier
["d", "org.vendor:product:version"]

// Label (NIP-32)
["l", "cpe23", "cpe:2.3:a:vendor:product:*", ""]

// URL with hash
["url", "https://example.com/file.pdf"]
["x", "<sha256-hash>"]

// MIME type
["m", "application/pdf"]

// File size
["size", "1024000"]
```

### Component Import Quick Reference

```typescript
// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Icons
import { Copy, ExternalLink, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

// Hooks
import { useNostr } from '@nostrify/react';
import { useAuthor } from '@/hooks/useAuthor';
import { useScrutinyEvents } from '@/hooks/useScrutinyEvents';
import { useAppContext } from '@/hooks/useAppContext';
import { useToast } from '@/hooks/useToast';

// Utilities
import { cn } from '@/lib/utils';
import { determineEventType, extractLabels, extractETags } from '@/lib/scrutiny';
import { pubkeyToNpub, pubkeyToShortNpub } from '@/lib/nip19';
```

---

**END OF AI AGENT INSTRUCTIONS**

This document should be referenced whenever working on the Scrutiny Events Viewer project. It provides comprehensive guidance on architecture, conventions, common tasks, and best practices specific to this codebase.

For questions or clarifications, consult the documentation files in the `docs/` directory or examine existing components for implementation patterns.
