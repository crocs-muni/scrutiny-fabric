import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { EventDetailsPanel } from '@/components/EventDetailsPanel';
import { BindingsPanel } from '@/components/BindingsPanel';
import { useEventWithBindings } from '@/hooks/useEventWithBindings';
import { decodeEventIdentifier } from '@/lib/routing';

const FULL_HEIGHT_CLASS = 'h-screen';

export default function EventPage() {
  const { nip19 } = useParams<{ nip19: string }>();
  const navigate = useNavigate();

  const eventId = useMemo(() => {
    if (!nip19) {
      return null;
    }
    return decodeEventIdentifier(nip19);
  }, [nip19]);

  const { event, bindings, isProduct, isMetadata, isLoading, error } = useEventWithBindings(eventId);

  if (!eventId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid event identifier. Use note1..., nevent1..., or a 64-character hex string.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${FULL_HEIGHT_CLASS} flex`}>
        <div className="w-1/3 min-w-[320px] border-r p-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="mb-4 h-12 w-full" />
          <Skeleton className="mb-4 h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !event || (!isProduct && !isMetadata)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || 'Event not found or not a SCRUTINY product/metadata event.'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className={`${FULL_HEIGHT_CLASS} flex flex-col bg-muted/20`}>
      <div className="border-b bg-background p-4">
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to All Bindings
        </Button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 min-w-[360px] border-r">
          <EventDetailsPanel event={event} isProduct={isProduct} isMetadata={isMetadata} />
        </div>
        <div className="flex-1">
          <BindingsPanel bindings={bindings} eventType={isProduct ? 'product' : 'metadata'} />
        </div>
      </div>
    </div>
  );
}
