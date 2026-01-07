import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Loader2 } from 'lucide-react';
import { useScrutinyEvents } from '@/hooks/useScrutinyEvents';
import { BindingCard } from '@/components/BindingCard';
import { DetailedView } from '@/components/DetailedView';
import { FilterBar } from '@/components/FilterBar';
import { RelaySelector } from '@/components/RelaySelector';
import { Card, CardContent } from '@/components/ui/card';
import { applyFilters, type EventFilters } from '@/lib/scrutiny';

const Index = () => {
  useSeoMeta({
    title: 'SCRUTINY Events Viewer',
    description: 'View and explore security metadata bindings on the Nostr network using the SCRUTINY protocol.',
  });

  const { data, isLoading, error } = useScrutinyEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<EventFilters>({
    dateRange: { start: null, end: null },
    author: null,
    dTag: null,
    cpe23: null,
  });

  const selectedBindingId = searchParams.get('binding');

  const clearFilters = () => {
    setFilters({
      dateRange: { start: null, end: null },
      author: null,
      dTag: null,
      cpe23: null,
    });
  };

  const bindings = useMemo(() => {
    if (!data) return [];
    const allBindings = Array.from(data.categorized.bindings.values());
    return applyFilters(allBindings, filters);
  }, [data, filters]);

  const selectedBinding = useMemo(() => {
    if (!selectedBindingId || !data) return null;
    return data.categorized.bindings.get(selectedBindingId);
  }, [selectedBindingId, data]);

  const handleBindingSelect = (bindingId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('binding', bindingId);
    setSearchParams(next);
  };

  const handleBindingBack = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('binding');
    setSearchParams(next);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading SCRUTINY events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-bold text-destructive">Error Loading Events</h2>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Failed to load events from relay'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedBinding && data) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <DetailedView
            binding={selectedBinding}
            categorized={data.categorized}
            relationships={data.relationships}
            onBack={handleBindingBack}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">SCRUTINY Events Viewer</h1>
            <p className="text-muted-foreground">
              Explore security metadata bindings on the Nostr network
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Relay:</span>
            <RelaySelector />
          </div>
        </div>

        <FilterBar filters={filters} onChange={setFilters} onClear={clearFilters} />

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {bindings.length} {bindings.length === 1 ? 'binding' : 'bindings'} found
          </p>
        </div>

        {bindings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-6">
                <p className="text-muted-foreground">
                  No bindings found. Try adjusting your filters or switching relays.
                </p>
                <RelaySelector className="w-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bindings.map(binding => {
              const hasUpdate = !!(data?.categorized.updates.get(binding.id)?.length);
              const confirmationCount = data?.categorized.confirmations.get(binding.id)?.length || 0;
              const contestationCount = data?.categorized.contestations.get(binding.id)?.length || 0;
              const productCount = data?.relationships.bindingToProducts.get(binding.id)?.length || 0;
              const metadataCount = data?.relationships.bindingToMetadata.get(binding.id)?.length || 0;

              return (
                <BindingCard
                  key={binding.id}
                  binding={binding}
                  hasUpdate={hasUpdate}
                  confirmationCount={confirmationCount}
                  contestationCount={contestationCount}
                  productCount={productCount}
                  metadataCount={metadataCount}
                  onClick={() => handleBindingSelect(binding.id)}
                />
              );
            })}
          </div>
        )}

        {data && (
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 pt-6 text-xs text-muted-foreground border-t">
            <span>Total: {data.categorized.bindings.size} bindings</span>
            <span>•</span>
            <span>{data.categorized.products.size} products</span>
            <span>•</span>
            <span>{data.categorized.metadata.size} metadata items</span>
            <span>•</span>
            <span>{data.categorized.updates.size} updates</span>
            <span>•</span>
            <span>{data.categorized.confirmations.size} confirmations</span>
            <span>•</span>
            <span>{data.categorized.contestations.size} contestations</span>
          </div>
        )}

        <div className="pt-4 text-center text-xs text-muted-foreground">
          <p>
            Powered by Nostr
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
