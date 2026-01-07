# ARCHITECTURE.md

## System Architecture

### Application Type
- Single-page React application
- Two-phase data fetching model
- No backend required
- No caching between phases

### Technology Stack
```yaml
Framework: React
State Management: Zustand (recommended) or Context+useReducer
Nostr Library: nostr-tools or NDK (Shakespeare.diy compatible)
Styling: CSS matching sec-certs.org design system
Build Tool: Vite
```

---

## Data Flow

### Phase 1: Bindings List

```
Load → Connect Relay → Query Bindings → Parse → Filter → Display List → Wait for Click
```

**Relay**: `wss://relay.damus.io`

**Query**:
```javascript
{
  kinds: [1],
  // include plain, hashed (#), v01 and hashed v01 variants for each scrutiny tag
  "#t": [
    "scrutiny_fabric", "#scrutiny_fabric", "scrutiny_fabric_v01", "#scrutiny_fabric_v01",
    // Legacy namespace (older events)
    "scrutiny_mo", "#scrutiny_mo", "scrutiny_mo_v01", "#scrutiny_mo_v01",
    "scrutiny-mo", "#scrutiny-mo", "scrutiny-mo-v0", "#scrutiny-mo-v0",
    "scrutiny_binding", "#scrutiny_binding", "scrutiny_binding_v01", "#scrutiny_binding_v01",
    // Legacy hyphenated type tags (if present on older events)
    "scrutiny-binding", "#scrutiny-binding", "scrutiny-binding-v0", "#scrutiny-binding-v0"
  ]
}
```

**Actions**:
1. Connect to relay
2. Subscribe with filter
3. Collect until EOSE
4. Close connection
5. Filter events where determineEventType(event.tags) === 'binding'
6. Store in state: `bindingEvents[]`
7. Render list

### Phase 2: Detailed View

```
Click Binding → Extract IDs → Query Related → Parse & Categorize → Deduplicate → Display Details
```

**Fetching Sequence**:
```javascript
// Step 1: Extract from clicked binding
productIds = extractETagsWithMention(binding)
metadataIds = extractETagsWithMention(binding)

// Step 2: Query products, metadata, and binding replies
query1 = {
  kinds: [1],
  ids: [...productIds, ...metadataIds],
  "#e": [binding.id]
}

// Step 3: Extract more IDs from results
allProductIds = results.filter(isProduct).map(e => e.id)
allMetadataIds = results.filter(isMetadata).map(e => e.id)
contestationAlternativeIds = results.filter(isContestation).map(extractAlternativeId)

// Step 4: Query events mentioning products/metadata + alternatives
query2 = {
  kinds: [1],
  "#e": [...allProductIds, ...allMetadataIds]
}

// Step 5: Fetch alternative metadata events
query3 = {
  kinds: [1],
  ids: contestationAlternativeIds
}

// Step 6: Deduplicate by ID
allEvents = deduplicateById([...results1, ...results2, ...results3])

// Step 7: Categorize and store
storeInState(categorize(allEvents))
```

---

## Event Types

### Event Type Identification

```javascript
determineEventType(tags) {
  const tTags = tags.filter(t => t[0] === 't').map(t => t[1]);

  // Accept four variants for each tag: plain, with leading '#', v01, and '#..._v01'
  const includesAny = (base) => (
    tTags.includes(base) ||
    tTags.includes(`#${base}`) ||
    tTags.includes(`${base}_v01`) ||
    tTags.includes(`#${base}_v01`)
  );

  if (includesAny('scrutiny_product')) return 'product';
  if (includesAny('scrutiny_metadata')) return 'metadata';
  if (includesAny('scrutiny_binding')) return 'binding';
  if (includesAny('scrutiny_update')) return 'update';
  if (includesAny('scrutiny_contestation')) return 'contestation';
  if (includesAny('scrutiny_confirmation')) return 'confirmation';

  return 'unknown';
}
```

### Event Relationships

```yaml
BindingEvent:
  has_many: [ProductEvent, MetadataEvent]
  via: e tags with role="mention"
  cardinality: M:N

ProductEvent:
  belongs_to_many: BindingEvent
  has_one: UpdateEvent (same pubkey)
  has_many: [ConfirmationEvent, BindingEvent (other)]

MetadataEvent:
  belongs_to_many: BindingEvent
  has_one: UpdateEvent (same pubkey)
  has_many: [ConfirmationEvent, ContestationEvent]

UpdateEvent:
  belongs_to: Any event (ProductEvent|MetadataEvent|BindingEvent)
  via: e tag with role="root"
  constraint: pubkey must match original

ContestationEvent:
  belongs_to: MetadataEvent (contested)
  via: e tag with role="root"
  references: AlternativeMetadataEvent
  via: e tag with role="mention"

ConfirmationEvent:
  belongs_to: Any event
  via: e tag with role="root"
```

---

## State Structure

```typescript
{
  // Phase 1
  phase1: {
    loading: boolean,
    error: string | null,
    bindingEvents: Event[],
    filters: {
      dateRange: { start: number | null, end: number | null },
      author: string | null,
      dTag: string | null,
      cpe23: string | null
    }
  },

  // Phase 2
  phase2: {
    loading: boolean,
    error: string | null,
    activeBindingId: string | null,

    events: {
      bindings: Map<id, Event>,
      products: Map<id, Event>,
      metadata: Map<id, Event>,
      updates: Map<originalId, Event>,
      confirmations: Map<targetId, Event[]>,
      contestations: Map<targetId, Event[]>
    },

    relationships: {
      bindingToProducts: Map<bindingId, productId[]>,
      bindingToMetadata: Map<bindingId, metadataId[]>,
      productToBindings: Map<productId, bindingId[]>,
      metadataToBindings: Map<metadataId, bindingId[]>,
      contestationToAlternative: Map<contestationId, metadataId>
    },

    ui: {
      expandedSections: Set<string>,
      viewingAlternative: Map<contestationId, boolean>,
      showingOldVersion: Map<updateId, boolean>
    }
  }
}
```

---

## Filtering

### Filter Implementation

```javascript
// Phase 1 filters
function applyFilters(events, filters) {
  return events.filter(event => {
    // Date range
    if (filters.dateRange.start && event.created_at < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && event.created_at > filters.dateRange.end) {
      return false;
    }

    // Author (pubkey)
    if (filters.author && event.pubkey !== filters.author) {
      return false;
    }

    // D tag
    if (filters.dTag) {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      if (!dTag || !dTag.includes(filters.dTag)) {
        return false;
      }
    }

    // CPE23 (in l tags or referenced product)
    if (filters.cpe23) {
      const cpe = event.tags.find(t => t[0] === 'l' && t[1] === 'cpe23')?.[2];
      if (!cpe || !cpe.includes(filters.cpe23)) {
        return false;
      }
    }

    return true;
  });
}
```

### Filter UI Components

```yaml
FilterBar:
  position: top of BindingsListView
  components:
    - DateRangePicker:
        start: date input
        end: date input
        format: Unix timestamp
    - AuthorInput:
        type: text
        placeholder: "npub or hex pubkey"
        validation: valid nostr pubkey
    - DTagInput:
        type: text
        placeholder: "org.vendor:product"
        hint: "Partial match supported"
    - CPE23Input:
        type: text
        placeholder: "cpe:2.3:a:vendor:product:version"
        hint: "Partial match supported"
    - ClearButton:
        action: reset all filters
```

---

## Update Replacement Logic

### Replacement Rules

```javascript
function shouldReplace(originalEvent, updateEvent) {
  // 1. UpdateEvent must reference original
  const rootTag = updateEvent.tags.find(t =>
    t[0] === 'e' && t[1] === originalEvent.id && t[3] === 'root'
  );
  if (!rootTag) return false;

  // 2. Must be from same author
  if (updateEvent.pubkey !== originalEvent.pubkey) return false;

  // 3. Must be newer
  if (updateEvent.created_at <= originalEvent.created_at) return false;

  // 4. Must have update tag
  const hasUpdateTag = updateEvent.tags.some(t => {
    if (t[0] !== 't') return false;
    const v = t[1];
    return (
      v === 'scrutiny_update' ||
      v === '#scrutiny_update' ||
      v === 'scrutiny_update_v01' ||
      v === '#scrutiny_update_v01'
    );
  });
  if (!hasUpdateTag) return false;

  return true;
}
```

### Display Logic

```javascript
function getDisplayEvent(originalId, eventsMap, updatesMap) {
  const original = eventsMap.get(originalId);
  const update = updatesMap.get(originalId);

  if (update && shouldReplace(original, update)) {
    return {
      display: update,
      original: original,
      isUpdated: true
    };
  }

  return {
    display: original,
    original: null,
    isUpdated: false
  };
}
```

---

## Deduplication

### Implementation

```javascript
class EventDeduplicator {
  constructor() {
    this.seen = new Set();
  }

  add(event) {
    if (this.seen.has(event.id)) {
      return false; // duplicate
    }
    this.seen.add(event.id);
    return true; // new
  }

  filter(events) {
    return events.filter(e => this.add(e));
  }

  clear() {
    this.seen.clear();
  }
}

// Usage
const dedup = new EventDeduplicator();
const uniqueEvents = dedup.filter([...batch1, ...batch2, ...batch3]);
```

---

## Component Hierarchy

```
App
├─ NostrProvider
└─ Router
    ├─ BindingsListView
    │   ├─ FilterBar
    │   │   ├─ DateRangePicker
    │   │   ├─ AuthorInput
    │   │   ├─ DTagInput
    │   │   ├─ CPE23Input
    │   │   └─ ClearFiltersButton
    │   ├─ LoadingSpinner
    │   ├─ ErrorMessage
    │   └─ BindingCard[] (filtered)
    │       ├─ AuthorBadge
    │       ├─ TimestampDisplay
    │       ├─ ContentPreview
    │       ├─ ActivityBadges
    │       └─ UpdatedIndicator
    │
    └─ DetailedView
        ├─ BackButton
        ├─ LoadingSpinner
        ├─ ErrorMessage
        │
        ├─ BindingDetailsCard
        │   ├─ UpdatedIndicator (clickable)
        │   ├─ EventContent
        │   ├─ AuthorInfo
        │   ├─ TimestampDisplay
        │   └─ EventIdCopy
        │
        ├─ ProductsSection
        │   └─ ProductCard[] (M products)
        │       ├─ UpdatedIndicator
        │       ├─ ProductInfo
        │       │   ├─ Vendor
        │       │   ├─ ProductName
        │       │   ├─ Version
        │       │   ├─ CPE23
        │       │   ├─ PURL
        │       │   ├─ DTag
        │       │   └─ CanonicalURL
        │       └─ ActivityDropdown
        │           ├─ ConfirmationsSection
        │           │   └─ ConfirmationItem[]
        │           └─ OtherBindingsSection
        │               └─ BindingReference[]
        │
        ├─ MetadataSection
        │   └─ MetadataCard[] (N metadata)
        │       ├─ UpdatedIndicator
        │       ├─ MetadataInfo
        │       │   ├─ URL
        │       │   ├─ SHA256Hash
        │       │   ├─ FileType
        │       │   └─ FileSize
        │       ├─ ViewExternalButton
        │       └─ ActivityDropdown
        │           ├─ ConfirmationsSection
        │           │   └─ ConfirmationItem[]
        │           └─ ContestationsSection
        │               └─ ContestationItem[]
        │                   ├─ DisputeMessage
        │                   ├─ SideBySidePreview
        │                   │   ├─ OriginalMetadata
        │                   │   └─ AlternativeMetadata
        │                   └─ SwitchButton
        │
        └─ BindingActivitySection
            ├─ UpdatesDropdown
            ├─ ConfirmationsDropdown
            │   └─ ConfirmationItem[]
            └─ ContestationsDropdown
                └─ ContestationItem[]
```

---

## Key Functions

### Tag Extraction

```javascript
// Extract e tags with specific role
function extractETags(event, role = null) {
  return event.tags
    .filter(t => t[0] === 'e' && (role === null || t[3] === role))
    .map(t => t[1]);
}

// Extract d tag
function extractDTag(event) {
  return event.tags.find(t => t[0] === 'd')?.[1] || null;
}

// Extract labels (NIP-32)
function extractLabels(event) {
  return event.tags
    .filter(t => t[0] === 'l')
    .reduce((acc, t) => {
      const [_, name, value, type] = t;
      acc[name] = { value, type };
      return acc;
    }, {});
}

// Extract URL and hash
function extractURLAndHash(event) {
  const url = event.tags.find(t => t[0] === 'url')?.[1];
  const hash = event.tags.find(t => t[0] === 'x')?.[1];
  return { url, hash };
}
```

### Event Categorization

```javascript
function categorizeEvents(events) {
  const categories = {
    bindings: new Map(),
    products: new Map(),
    metadata: new Map(),
    updates: new Map(),
    confirmations: new Map(),
    contestations: new Map()
  };

  for (const event of events) {
    const type = determineEventType(event.tags);

    switch (type) {
      case 'binding':
        categories.bindings.set(event.id, event);
        break;
      case 'product':
        categories.products.set(event.id, event);
        break;
      case 'metadata':
        categories.metadata.set(event.id, event);
        break;
      case 'update':
        const originalId = extractETags(event, 'root')[0];
        categories.updates.set(originalId, event);
        break;
      case 'confirmation':
        const confirmedId = extractETags(event, 'root')[0];
        if (!categories.confirmations.has(confirmedId)) {
          categories.confirmations.set(confirmedId, []);
        }
        categories.confirmations.get(confirmedId).push(event);
        break;
      case 'contestation':
        const contestedId = extractETags(event, 'root')[0];
        if (!categories.contestations.has(contestedId)) {
          categories.contestations.set(contestedId, []);
        }
        categories.contestations.get(contestedId).push(event);
        break;
    }
  }

  return categories;
}
```

### Relationship Mapping

```javascript
function mapRelationships(categorizedEvents) {
  const relationships = {
    bindingToProducts: new Map(),
    bindingToMetadata: new Map(),
    productToBindings: new Map(),
    metadataToBindings: new Map(),
    contestationToAlternative: new Map()
  };

  // Map binding to products/metadata
  for (const [id, binding] of categorizedEvents.bindings) {
    const mentions = extractETags(binding, 'mention');
    const products = [];
    const metadata = [];

    for (const mentionId of mentions) {
      if (categorizedEvents.products.has(mentionId)) {
        products.push(mentionId);
      } else if (categorizedEvents.metadata.has(mentionId)) {
        metadata.push(mentionId);
      }
    }

    relationships.bindingToProducts.set(id, products);
    relationships.bindingToMetadata.set(id, metadata);

    // Reverse mapping
    for (const productId of products) {
      if (!relationships.productToBindings.has(productId)) {
        relationships.productToBindings.set(productId, []);
      }
      relationships.productToBindings.get(productId).push(id);
    }

    for (const metaId of metadata) {
      if (!relationships.metadataToBindings.has(metaId)) {
        relationships.metadataToBindings.set(metaId, []);
      }
      relationships.metadataToBindings.get(metaId).push(id);
    }
  }

  // Map contestations to alternatives
  for (const [targetId, contestations] of categorizedEvents.contestations) {
    for (const contestation of contestations) {
      const alternativeId = extractETags(contestation, 'mention')[0];
      if (alternativeId) {
        relationships.contestationToAlternative.set(contestation.id, alternativeId);
      }
    }
  }

  return relationships;
}
```

---

## Error Handling

### Connection Errors

```javascript
async function connectRelay(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const relay = await Relay.connect(url);
      return relay;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to connect after ${maxRetries} attempts: ${error.message}`);
      }
      await sleep(1000 * Math.pow(2, attempt)); // Exponential backoff
    }
  }
}
```

### Query Timeout

```javascript
async function queryWithTimeout(relay, filter, timeoutMs = 10000) {
  return Promise.race([
    relay.query(filter),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    )
  ]);
}
```

### Missing Events

```javascript
function validateRelatedEvents(binding, products, metadata) {
  const errors = [];

  if (products.length === 0) {
    errors.push('No products found for this binding');
  }

  if (metadata.length === 0) {
    errors.push('No metadata found for this binding');
  }

  const productIds = extractETags(binding, 'mention');
  const fetchedIds = [...products.map(p => p.id), ...metadata.map(m => m.id)];
  const missing = productIds.filter(id => !fetchedIds.includes(id));

  if (missing.length > 0) {
    errors.push(`Missing ${missing.length} referenced events`);
  }

  return errors;
}
```

---

## Performance Optimizations

### Memoization

```javascript
// Memoize expensive computations
const memoizedFilter = useMemo(
  () => applyFilters(bindingEvents, filters),
  [bindingEvents, filters]
);

const memoizedProducts = useMemo(
  () => relationships.bindingToProducts.get(activeBindingId)?.map(id =>
    events.products.get(id)
  ).filter(Boolean) || [],
  [activeBindingId, relationships.bindingToProducts, events.products]
);
```

### Lazy Loading

```javascript
function useInfiniteScroll(items, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const visibleItems = useMemo(
    () => items.slice(0, page * pageSize),
    [items, page, pageSize]
  );

  const loadMore = useCallback(() => {
    if (visibleItems.length < items.length) {
      setPage(p => p + 1);
    } else {
      setHasMore(false);
    }
  }, [items.length, visibleItems.length]);

  return { visibleItems, loadMore, hasMore };
}
```

### Virtual Scrolling

```javascript
// For large lists (100+ items)
import { FixedSizeList } from 'react-window';

function BindingsList({ bindings }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={bindings.length}
      itemSize={120}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <BindingCard binding={bindings[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

---

## Testing

### Unit Tests

```javascript
// Event parsing
test('determineEventType identifies binding', () => {
  // Plain
  expect(determineEventType([['t', 'scrutiny_binding']])).toBe('binding');
  // With leading '#'
  expect(determineEventType([['t', '#scrutiny_binding']])).toBe('binding');
  // v01 variant
  expect(determineEventType([['t', 'scrutiny_binding_v01']])).toBe('binding');
  // v01 with '#'
  expect(determineEventType([['t', '#scrutiny_binding_v01']])).toBe('binding');
});

// Filtering
test('applyFilters filters by date range', () => {
  const events = [
    { created_at: 1000 },
    { created_at: 2000 },
    { created_at: 3000 }
  ];
  const filtered = applyFilters(events, {
    dateRange: { start: 1500, end: 2500 }
  });
  expect(filtered).toHaveLength(1);
  expect(filtered[0].created_at).toBe(2000);
});

// Update replacement
test('shouldReplace returns true for valid update variants', () => {
  const original = { id: 'a', pubkey: 'x', created_at: 1000 };

  // Test all four tag variants
  ['scrutiny_update', '#scrutiny_update', 'scrutiny_update_v01', '#scrutiny_update_v01'].forEach(variant => {
    const update = {
      id: 'b',
      pubkey: 'x',
      created_at: 2000,
      tags: [
        ['e', 'a', '', 'root'],
        ['t', variant]
      ]
    };
    expect(shouldReplace(original, update)).toBe(true);
  });
});
```

### Integration Tests

```javascript
test('DetailedView fetches and displays related events', async () => {
  const { getByText, findByText } = render(<App />);

  // Click binding
  fireEvent.click(getByText('Test Binding'));

  // Wait for loading
  expect(getByText('Loading...')).toBeInTheDocument();

  // Verify products displayed
  expect(await findByText('OpenSSL 3.0.0')).toBeInTheDocument();

  // Verify metadata displayed
  expect(await findByText('Test Results')).toBeInTheDocument();
});
```

---

## Build Configuration

### Environment Variables

```env
VITE_NOSTR_RELAY=wss://relay.damus.io
VITE_MAX_EVENTS=1000
VITE_FETCH_TIMEOUT=10000
VITE_PAGE_SIZE=20
```

### Vite Config

```javascript
export default {
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'nostr': ['nostr-tools'],
          'vendor': ['react', 'react-dom', 'zustand']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['nostr-tools']
  }
}
```

---

## Deployment Checklist

- [ ] Test on Shakespeare.diy environment
- [ ] Verify relay connection works
- [ ] Test all filters
- [ ] Test update replacement logic
- [ ] Test alternative metadata switching
- [ ] Verify responsive design (mobile)
- [ ] Test error handling (no connection, no events, malformed events)
- [ ] Performance test with 100+ bindings
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Accessibility audit (keyboard navigation, screen readers)