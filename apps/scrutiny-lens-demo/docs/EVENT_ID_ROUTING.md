# GitHub Copilot Implementation Guide: Direct Event ID Routing

**Feature**: Direct linking to Product/Metadata events with bindings list view

**Route Pattern**: `/:nip19` (captures `note1...`, `nevent1...`, or raw hex event IDs)

---

## Overview

When a user visits a URL like `https://scrutiny-nostr.ayko.ooo/note1abc...` or `https://scrutiny-nostr.ayko.ooo/003c5797...`, they should see:

1. **Left Panel**: Product/Metadata Event Details (fixed)
2. **Right Panel**: Bindings List (scrollable) with author filter
3. **Click Binding** → Navigate to existing DetailedView

---

## Design Decisions (Locked In) ✅

- **URL Support**: NIP-19 + Raw Hex (`note1...`, `nevent1...`, `003c5797...`)
- **Layout**: Side-by-Side (Product left, Bindings right)
- **Empty State**: Show product + "No bindings found" + "Create binding" prompt
- **Author Filter**: Local state only, dropdown with recognized npubs
- **Navigation**: Replace route to existing DetailedView
- **Event Types**: Products + Metadata
- **Data Fetching**: Targeted query (new hook `useEventWithBindings`)
- **Routing**: Single `/:nip19` route in `NIP19Page.tsx`

---

## File Structure

```
src/
├── pages/
│   ├── EventPage.tsx              // NEW: Side-by-side event + bindings view
│   └── NIP19Page.tsx              // MODIFY: Route to EventPage for note/nevent
│
├── components/
│   ├── EventDetailsPanel.tsx      // NEW: Left panel - event details
│   ├── BindingsPanel.tsx          // NEW: Right panel - bindings list
│   └── AuthorFilterDropdown.tsx   // NEW: Dropdown with recognized npubs
│
├── hooks/
│   └── useEventWithBindings.ts    // NEW: Targeted query for event + bindings
│
└── lib/
    └── routing.ts                 // NEW: Event ID validation/decoding
```

---

## Implementation Steps

### Step 1: Create Event ID Utilities

**File**: `src/lib/routing.ts` *(NEW)*

```typescript
import { nip19 } from 'nostr-tools';

/**
 * Decode a Nostr identifier (note1, nevent1, or hex) to event ID
 * Returns null if invalid
 */
export function decodeEventIdentifier(identifier: string): string | null {
  // Try NIP-19 decode (note1, nevent1)
  if (identifier.startsWith('note1') || identifier.startsWith('nevent1')) {
    try {
      const decoded = nip19.decode(identifier);
      if (decoded.type === 'note') {
        return decoded.data;
      }
      if (decoded.type === 'nevent') {
        return decoded.data.id;
      }
    } catch {
      return null;
    }
  }
  
  // Try raw hex (64 chars)
  if (/^[0-9a-f]{64}$/i.test(identifier)) {
    return identifier.toLowerCase();
  }
  
  return null;
}

/**
 * Validate if identifier is a valid event identifier format
 */
export function isValidEventIdentifier(identifier: string): boolean {
  return decodeEventIdentifier(identifier) !== null;
}
```

---

### Step 2: Create Targeted Query Hook

**File**: `src/hooks/useEventWithBindings.ts` *(NEW)*

```typescript
import { useState, useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { determineEventType, extractETags } from '@/lib/scrutiny';
import type { NostrEvent } from '@nostrify/nostrify';

interface UseEventWithBindingsResult {
  event: NostrEvent | undefined;
  bindings: NostrEvent[];
  isProduct: boolean;
  isMetadata: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch a specific event and all bindings that reference it
 * Uses targeted queries for performance
 */
export function useEventWithBindings(eventId: string): UseEventWithBindingsResult {
  const { nostr } = useNostr();
  const [event, setEvent] = useState<NostrEvent | undefined>();
  const [bindings, setBindings] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!eventId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const relay = nostr.relay(import.meta.env.VITE_NOSTR_RELAY || 'wss://relay.damus.io');

      // Query 1: Fetch the specific event
      const eventFilter = {
        kinds: [1],
        ids: [eventId],
      };

      const [fetchedEvent] = await relay.query([eventFilter], {
        signal: AbortSignal.timeout(10000),
      });

      if (!fetchedEvent) {
        throw new Error('Event not found');
      }

      // Verify it's a product or metadata event
      const eventType = determineEventType(fetchedEvent.tags);
      if (eventType !== 'product' && eventType !== 'metadata') {
        throw new Error(`Event is not a product or metadata (type: ${eventType})`);
      }

      setEvent(fetchedEvent);

      // Query 2: Fetch all bindings that reference this event
      const bindingsFilter = {
        kinds: [1],
        '#e': [eventId],
        '#t': [
          'scrutiny_binding',
          '#scrutiny_binding',
          'scrutiny_binding_v01',
          '#scrutiny_binding_v01',
        ],
      };

      const fetchedBindings = await relay.query([bindingsFilter], {
        signal: AbortSignal.timeout(10000),
      });

      // Filter to ensure they're actually bindings
      const validBindings = fetchedBindings.filter(
        (b) => determineEventType(b.tags) === 'binding'
      );

      setBindings(validBindings);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const isProduct = event ? determineEventType(event.tags) === 'product' : false;
  const isMetadata = event ? determineEventType(event.tags) === 'metadata' : false;

  return {
    event,
    bindings,
    isProduct,
    isMetadata,
    isLoading,
    error,
    refetch: fetchData,
  };
}
```

---

### Step 3: Create Author Filter Dropdown

**File**: `src/components/AuthorFilterDropdown.tsx` *(NEW)*

```typescript
import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToShortNpub } from '@/lib/nip19';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuthorFilterDropdownProps {
  bindings: NostrEvent[];
  selectedAuthor: string | null;
  onAuthorChange: (pubkey: string | null) => void;
}

export function AuthorFilterDropdown({
  bindings,
  selectedAuthor,
  onAuthorChange,
}: AuthorFilterDropdownProps) {
  // Extract unique authors from bindings
  const uniqueAuthors = useMemo(() => {
    const pubkeys = new Set(bindings.map((b) => b.pubkey));
    return Array.from(pubkeys);
  }, [bindings]);

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAuthor || 'all'} onValueChange={(value) => {
        onAuthorChange(value === 'all' ? null : value);
      }}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Filter by author" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Authors ({bindings.length})</SelectItem>
          {uniqueAuthors.map((pubkey) => (
            <AuthorSelectItem key={pubkey} pubkey={pubkey} bindings={bindings} />
          ))}
        </SelectContent>
      </Select>
      
      {selectedAuthor && (
        <Button variant="outline" size="sm" onClick={() => onAuthorChange(null)}>
          Clear
        </Button>
      )}
    </div>
  );
}

// Helper component to display author with profile name
function AuthorSelectItem({ 
  pubkey, 
  bindings 
}: { 
  pubkey: string; 
  bindings: NostrEvent[];
}) {
  const { data: author } = useAuthor(pubkey);
  const count = bindings.filter((b) => b.pubkey === pubkey).length;
  
  const displayName = author?.metadata?.name || pubkeyToShortNpub(pubkey);
  
  return (
    <SelectItem value={pubkey}>
      {displayName} ({count})
    </SelectItem>
  );
}
```

---

### Step 4: Create Event Details Panel

**File**: `src/components/EventDetailsPanel.tsx` *(NEW)*

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy } from 'lucide-react';
import { EventId } from '@/components/EventId';
import { extractLabels } from '@/lib/scrutiny';
import { useToast } from '@/hooks/useToast';
import { validateCPE23, getCountryFlag } from '@/lib/productUtils';
import type { NostrEvent } from '@nostrify/nostrify';

interface EventDetailsPanelProps {
  event: NostrEvent;
  isProduct: boolean;
  isMetadata: boolean;
}

export function EventDetailsPanel({ 
  event, 
  isProduct, 
  isMetadata 
}: EventDetailsPanelProps) {
  const labels = extractLabels(event);
  const { toast } = useToast();

  const handleCopyEventId = () => {
    navigator.clipboard.writeText(event.id);
    toast({ title: 'Copied event ID' });
  };

  return (
    <div className="h-full overflow-y-auto p-4 bg-background border-r">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-xl">
              {isProduct && (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {labels['product_name']?.value || 'Unknown Product'}
                  </div>
                  <div className="text-base text-muted-foreground font-normal">
                    {labels['vendor']?.value}
                  </div>
                  {labels['product_version']?.value && (
                    <Badge variant="outline">v{labels['product_version'].value}</Badge>
                  )}
                </div>
              )}
              {isMetadata && (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">Metadata</div>
                  <div className="text-sm text-muted-foreground">
                    {event.content.slice(0, 100)}...
                  </div>
                </div>
              )}
            </CardTitle>
            <Badge variant="secondary">
              {isProduct ? 'Product' : 'Metadata'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Event ID */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Event ID</div>
            <EventId id={event.id} />
          </div>

          {/* Product-specific fields */}
          {isProduct && (
            <>
              {/* CPE 2.3 */}
              {labels['cpe23']?.value && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">CPE 2.3</div>
                  <code className="text-xs bg-muted p-2 rounded block break-all">
                    {labels['cpe23'].value}
                  </code>
                  {!validateCPE23(labels['cpe23'].value) && (
                    <p className="text-xs text-destructive mt-1">Invalid CPE format</p>
                  )}
                </div>
              )}

              {/* Certification Info */}
              {labels['security_level']?.value && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Security Level</div>
                  <Badge>{labels['security_level'].value}</Badge>
                </div>
              )}

              {labels['scheme']?.value && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Scheme</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCountryFlag(labels['scheme'].value)}</span>
                    <span>{labels['scheme'].value}</span>
                  </div>
                </div>
              )}

              {/* Cert dates */}
              {(labels['not_valid_before']?.value || labels['not_valid_after']?.value) && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Validity Period</div>
                  <div className="text-sm">
                    {labels['not_valid_before']?.value} → {labels['not_valid_after']?.value}
                  </div>
                </div>
              )}

              {/* Sec-Certs URL */}
              {labels['seccerts_url']?.value && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={labels['seccerts_url'].value}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on Sec-Certs
                    </a>
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Metadata-specific fields */}
          {isMetadata && (
            <>
              {labels['url']?.value && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">URL</div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={labels['url'].value} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View External File
                    </a>
                  </Button>
                </div>
              )}

              {labels['x']?.value && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">SHA-256 Hash</div>
                  <code className="text-xs bg-muted p-2 rounded block break-all">
                    {labels['x'].value}
                  </code>
                </div>
              )}
            </>
          )}

          {/* Created timestamp */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Published</div>
            <div className="text-sm">
              {new Date(event.created_at * 1000).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Step 5: Create Bindings Panel

**File**: `src/components/BindingsPanel.tsx` *(NEW)*

```typescript
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle } from 'lucide-react';
import { BindingCard } from '@/components/BindingCard';
import { AuthorFilterDropdown } from '@/components/AuthorFilterDropdown';
import type { NostrEvent } from '@nostrify/nostrify';

interface BindingsPanelProps {
  bindings: NostrEvent[];
  eventType: 'product' | 'metadata';
}

export function BindingsPanel({ bindings, eventType }: BindingsPanelProps) {
  const navigate = useNavigate();
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);

  // Filter bindings by selected author
  const filteredBindings = useMemo(() => {
    if (!selectedAuthor) return bindings;
    return bindings.filter((b) => b.pubkey === selectedAuthor);
  }, [bindings, selectedAuthor]);

  const handleBindingClick = (bindingId: string) => {
    // Navigate to home with binding selected
    // Assumes Index page handles ?binding= query param
    navigate(`/?binding=${bindingId}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with filter */}
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Bindings ({filteredBindings.length})
          </h2>
          {bindings.length === 0 && (
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Binding
            </Button>
          )}
        </div>
        
        {bindings.length > 0 && (
          <AuthorFilterDropdown
            bindings={bindings}
            selectedAuthor={selectedAuthor}
            onAuthorChange={setSelectedAuthor}
          />
        )}
      </div>

      {/* Bindings list */}
      <div className="flex-1 overflow-y-auto p-4">
        {bindings.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">No bindings found</p>
                <p className="text-sm text-muted-foreground">
                  This {eventType} hasn't been linked to any {eventType === 'product' ? 'metadata' : 'products'} yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Create a binding to associate security metadata with this {eventType}.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : filteredBindings.length === 0 ? (
          <Alert>
            <AlertDescription>
              No bindings found from the selected author.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {filteredBindings.map((binding) => (
              <BindingCard
                key={binding.id}
                binding={binding}
                onClick={() => handleBindingClick(binding.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 6: Create EventPage Component

**File**: `src/pages/EventPage.tsx` *(NEW)*

```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { EventDetailsPanel } from '@/components/EventDetailsPanel';
import { BindingsPanel } from '@/components/BindingsPanel';
import { useEventWithBindings } from '@/hooks/useEventWithBindings';
import { decodeEventIdentifier } from '@/lib/routing';

export default function EventPage() {
  const { nip19 } = useParams<{ nip19: string }>();
  const navigate = useNavigate();

  // Decode event ID
  const eventId = useMemo(() => {
    if (!nip19) return null;
    return decodeEventIdentifier(nip19);
  }, [nip19]);

  // Fetch event and bindings
  const { event, bindings, isProduct, isMetadata, isLoading, error } = 
    useEventWithBindings(eventId || '');

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex">
        <div className="w-1/3 border-r p-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Error state: Invalid identifier
  if (!eventId) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid event identifier. Supported formats: note1..., nevent1..., or 64-char hex.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  // Error state: Event not found or wrong type
  if (error || (!event && !isLoading)) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || 'Event not found or is not a SCRUTINY product/metadata event.'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  // Success state: Side-by-side layout
  return (
    <div className="h-screen flex flex-col">
      {/* Back button */}
      <div className="p-4 border-b bg-background">
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to All Bindings
        </Button>
      </div>

      {/* Side-by-side panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Event details (fixed width) */}
        <div className="w-1/3 min-w-[400px]">
          <EventDetailsPanel
            event={event!}
            isProduct={isProduct}
            isMetadata={isMetadata}
          />
        </div>

        {/* Right: Bindings list (flexible width) */}
        <div className="flex-1">
          <BindingsPanel
            bindings={bindings}
            eventType={isProduct ? 'product' : 'metadata'}
          />
        </div>
      </div>
    </div>
  );
}
```

---

### Step 7: Update NIP19Page Router

**File**: `src/pages/NIP19Page.tsx` *(MODIFY)*

```typescript
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import EventPage from './EventPage';
import NotFound from './NotFound';
// ... other existing imports

export default function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  const routeType = useMemo(() => {
    if (!identifier) return 'invalid';

    // Check if it's an event identifier (note, nevent, or raw hex)
    if (identifier.startsWith('note1') || identifier.startsWith('nevent1')) {
      try {
        const decoded = nip19.decode(identifier);
        if (decoded.type === 'note' || decoded.type === 'nevent') {
          return 'event';
        }
      } catch {
        return 'invalid';
      }
    }

    // Check if raw hex event ID (64 chars)
    if (/^[0-9a-f]{64}$/i.test(identifier)) {
      return 'event';
    }

    // Check other NIP-19 types (npub, nprofile, etc.)
    if (identifier.startsWith('npub') || identifier.startsWith('nprofile')) {
      return 'profile';
    }

    if (identifier.startsWith('naddr')) {
      return 'address';
    }

    return 'invalid';
  }, [identifier]);

  // Route to EventPage for note/nevent/hex
  if (routeType === 'event') {
    return <EventPage />;
  }

  // Route to other pages (if you have them)
  if (routeType === 'profile') {
    return <div>Profile page coming soon</div>;
  }

  if (routeType === 'address') {
    return <div>Address page coming soon</div>;
  }

  // Invalid identifier
  return <NotFound />;
}
```

---

### Step 8: Update Index Page to Handle Binding Selection

**File**: `src/pages/Index.tsx` *(MODIFY)*

You need to update your Index page to handle the `?binding=<bindingId>` query parameter and show the DetailedView when a binding is clicked from the EventPage.

```typescript
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useScrutinyEvents } from '@/hooks/useScrutinyEvents';
import { DetailedView } from '@/components/DetailedView';
// ... other imports

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, error } = useScrutinyEvents();

  // Get selected binding from URL
  const selectedBindingId = searchParams.get('binding');

  // Find the selected binding
  const selectedBinding = useMemo(() => {
    if (!selectedBindingId || !data) return null;
    return data.categorized.bindings.get(selectedBindingId);
  }, [selectedBindingId, data]);

  // Show DetailedView if binding is selected
  if (selectedBinding) {
    return (
      <DetailedView
        binding={selectedBinding}
        onBack={() => {
          // Remove binding from URL
          searchParams.delete('binding');
          setSearchParams(searchParams);
        }}
      />
    );
  }

  // Otherwise show bindings list
  return (
    <div>
      {/* Your existing bindings list */}
    </div>
  );
}
```

---

## Utility Functions Needed

You'll need these helper functions. Add them to existing files or create new ones:

### Country Flag Mapping

**File**: `src/lib/productUtils.ts` *(NEW or ADD TO EXISTING)*

```typescript
/**
 * Get country flag emoji from country code
 */
export function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    'DE': '🇩🇪',
    'US': '🇺🇸',
    'FR': '🇫🇷',
    'GB': '🇬🇧',
    'NL': '🇳🇱',
    'SE': '🇸🇪',
    'CA': '🇨🇦',
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'CN': '🇨🇳',
    // Add more as needed
  };
  return flags[countryCode.toUpperCase()] || '🌐';
}

/**
 * Validate CPE 2.3 format
 */
export function validateCPE23(cpe: string): boolean {
  const pattern = /^cpe:2\.3:[aho\*\-](:([a-zA-Z0-9\._\-~%]*|\*)){10}$/;
  return pattern.test(cpe);
}
```

---

## Testing Checklist

Before considering complete:

- [ ] `/note1abc...` loads EventPage correctly
- [ ] `/nevent1abc...` loads EventPage correctly
- [ ] `/003c5797...` (raw hex) loads EventPage correctly
- [ ] Invalid identifiers show error message with back button
- [ ] Event not found shows error message
- [ ] Non-product/metadata events show error message
- [ ] Left panel displays product/metadata details correctly
- [ ] Right panel shows all bindings referencing the event
- [ ] Author filter dropdown shows unique authors with counts
- [ ] Author filter dropdown shows author names (from kind:0)
- [ ] Filtering by author works correctly
- [ ] "Clear" button resets filter
- [ ] Empty state shows "No bindings found" + create prompt
- [ ] Clicking binding navigates to `/?binding=<id>`
- [ ] DetailedView displays when binding is selected
- [ ] Back button from DetailedView removes query param
- [ ] Loading states display correctly
- [ ] Side-by-side layout is responsive
- [ ] Left panel scrolls independently
- [ ] Right panel scrolls independently

---

## Example Usage Flow

1. **User visits**: `https://scrutiny-nostr.ayko.ooo/003c5797433312843a7c02d9172dbe5e8273df237582a3cca157251ba7115e99`

2. **NIP19Page decodes**: Recognizes as raw hex event ID → routes to `EventPage`

3. **EventPage fetches**:
   - Query event `003c5797...`
   - Query bindings with `#e` tag = `003c5797...`

4. **Display**:
   - **Left**: NXP J3A080 product details
   - **Right**: 5 bindings found, dropdown shows 3 unique authors

5. **User filters** by author "Alice" → Shows 2 bindings

6. **User clicks binding** → Navigates to `/?binding=<binding-id>`

7. **Index page** detects `?binding=` → Shows `DetailedView`

8. **User clicks back** → Returns to EventPage
