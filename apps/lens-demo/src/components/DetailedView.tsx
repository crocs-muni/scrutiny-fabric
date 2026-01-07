import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToShortNpub } from '@/lib/nip19';
import { EventId } from '@/components/EventId';
import { formatDistanceToNow } from 'date-fns';
import { ContentWithImages } from '@/components/ContentWithImages';
import { ProductCard } from './ProductCard';
import { MetadataCard } from './MetadataCard';
import { GraphPanel } from './GraphPanel';
import { RawEventDialog } from '@/components/RawEventDialog';
import { getLatestUpdate } from '@/lib/scrutiny';
import type { ScrutinyEvent, CategorizedEvents, Relationships } from '@/lib/scrutiny';

interface DetailedViewProps {
  binding: ScrutinyEvent;
  categorized: CategorizedEvents;
  relationships: Relationships;
  onBack: () => void;
}

export function DetailedView({
  binding,
  categorized,
  relationships,
  onBack,
}: DetailedViewProps) {
  const author = useAuthor(binding.pubkey);
  const [showOriginal, setShowOriginal] = useState(false);

  const shortNpub = pubkeyToShortNpub(binding.pubkey);
  const displayName = author.data?.metadata?.name ?? shortNpub;
  const timeAgo = formatDistanceToNow(new Date(binding.created_at * 1000), {
    addSuffix: true,
  });

  const updateEvent = getLatestUpdate(categorized.updates.get(binding.id));
  const displayBinding = (updateEvent && !showOriginal) ? updateEvent : binding;

  const productIds = relationships.bindingToProducts.get(binding.id) || [];
  const metadataIds = relationships.bindingToMetadata.get(binding.id) || [];

  const products = productIds
    .map(id => categorized.products.get(id))
    .filter((p): p is ScrutinyEvent => !!p);

  const metadata = metadataIds
    .map(id => categorized.metadata.get(id))
    .filter((m): m is ScrutinyEvent => !!m);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>

      {/* Binding Details */}
      <Card className="border-2 border-binding" data-event-id={binding.id}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <span className="text-base">🔗</span>
              <CardTitle>Binding Details</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <RawEventDialog event={binding} eventType="Binding" />
              {updateEvent && (
                <Badge
                  variant="outline"
                  className="bg-update/10 text-update border-update cursor-pointer"
                  onClick={() => setShowOriginal(!showOriginal)}
                >
                  {showOriginal ? 'Viewing Original' : 'Updated'} (click to toggle)
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Author:</span>
            <span className="font-medium">{displayName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Posted:</span>
            <span>{timeAgo}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Event ID:</span>
            <EventId id={binding.id} />
          </div>

          {displayBinding.content && (
            <div className="pt-3 border-t">
              <ContentWithImages content={displayBinding.content} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Column Grid - Products and Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Products Column */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
            <span className="text-base">📦</span>
            <span>Products ({products.length})</span>
          </h2>
          {products.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No product events found for this binding.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  update={getLatestUpdate(categorized.updates.get(product.id))}
                  updates={categorized.updates.get(product.id) || []}
                  confirmations={categorized.confirmations.get(product.id) || []}
                  contestations={categorized.contestations.get(product.id) || []}
                />
              ))}
            </div>
          )}
        </div>

        {/* Metadata Column */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
            <span className="text-base">📄</span>
            <span>Metadata ({metadata.length})</span>
          </h2>
          {metadata.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No metadata events found for this binding.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {metadata.map(meta => (
                <MetadataCard
                  key={meta.id}
                  metadata={meta}
                  update={getLatestUpdate(categorized.updates.get(meta.id))}
                  updates={categorized.updates.get(meta.id) || []}
                  confirmations={categorized.confirmations.get(meta.id) || []}
                  contestations={categorized.contestations.get(meta.id) || []}
                  categorized={categorized.metadata}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph Panel */}
      <GraphPanel
        binding={binding}
        categorized={categorized}
        relationships={relationships}
      />
    </div>
  );
}
