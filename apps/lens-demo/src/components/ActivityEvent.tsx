import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ChevronDown, ChevronRight, Check, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToNpub, pubkeyToShortNpub, eventIdToNote } from '@/lib/nip19';
import { ContentWithImages } from '@/components/ContentWithImages';
import { extractURLAndHash, extractLabels } from '@/lib/scrutiny';
import type { ScrutinyEvent } from '@/lib/scrutiny';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface ActivityEventProps {
  event: ScrutinyEvent;
  type: 'confirmation' | 'contestation' | 'update' | 'original';
  alternativeMetadata?: ScrutinyEvent;
}

export function ActivityEvent({ event, type, alternativeMetadata }: ActivityEventProps) {
  const [showAltDetails, setShowAltDetails] = useState(false);

  const author = useAuthor(event.pubkey);
  const fullNpub = pubkeyToNpub(event.pubkey);
  const shortNpub = pubkeyToShortNpub(event.pubkey);
  const displayName = author.data?.metadata?.name ?? shortNpub;

  const timeAgo = formatDistanceToNow(new Date(event.created_at * 1000), {
    addSuffix: true,
  });

  const isConfirmation = type === 'confirmation';
  const isContestation = type === 'contestation';
  const isUpdate = type === 'update';

  const bgColor = isConfirmation
    ? 'bg-confirmation/10 border-confirmation'
    : isContestation
    ? 'bg-contestation/10 border-contestation'
    : isUpdate
    ? 'bg-update/10 border-update'
    : 'bg-muted border-border';

  const textColor = isConfirmation
    ? 'text-confirmation'
    : isContestation
    ? 'text-contestation'
    : isUpdate
    ? 'text-update'
    : 'text-foreground';

  const IconComponent = isConfirmation
    ? Check
    : isContestation
    ? AlertTriangle
    : isUpdate
    ? RefreshCw
    : FileText;

  const label = isConfirmation
    ? 'Confirmation'
    : isContestation
    ? 'Contestation'
    : isUpdate
    ? 'Update'
    : 'Original Event';

  return (
    <div className={`border rounded-md p-3 ${bgColor}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${textColor} text-xs px-1.5 py-0 flex items-center gap-1`}>
            <IconComponent className="h-3 w-3" /> {label}
          </Badge>
          <div className="flex items-center gap-1">
            <Link
              to={`/${fullNpub}`}
              className="text-xs hover:underline text-primary font-medium"
              title={fullNpub}
            >
              {displayName}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              asChild
            >
              <a
                href={`https://njump.me/${fullNpub}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open profile on njump.me"
                title="Open profile on njump.me"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
      </div>

      {event.content && (
        <div className="text-sm mt-2">
          <ContentWithImages content={event.content} />
        </div>
      )}

      {alternativeMetadata && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <Collapsible open={showAltDetails} onOpenChange={setShowAltDetails}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">📄 Alternative Metadata</span>
                  <Link
                    to={`/${eventIdToNote(alternativeMetadata.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-primary hover:underline"
                    title="View alternative metadata"
                  >
                    {alternativeMetadata.id.substring(0, 16)}...
                  </Link>
                </div>
                {showAltDetails ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <AlternativeMetadataDetails metadata={alternativeMetadata} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

function AlternativeMetadataDetails({ metadata }: { metadata: ScrutinyEvent }) {
  const altAuthor = useAuthor(metadata.pubkey);
  const altDisplayName = altAuthor.data?.metadata?.name ?? pubkeyToShortNpub(metadata.pubkey);
  const { url, hash } = extractURLAndHash(metadata);
  const labels = extractLabels(metadata);

  const timeAgo = formatDistanceToNow(new Date(metadata.created_at * 1000), {
    addSuffix: true,
  });

  return (
    <div className="bg-background/70 rounded-md p-3 space-y-2 text-xs border">
      {/* Author and timestamp */}
      <div className="flex items-center justify-between text-muted-foreground">
        <span>By {altDisplayName}</span>
        <span>{timeAgo}</span>
      </div>

      {/* Content */}
      {metadata.content && (
        <div className="text-foreground text-sm">
          <ContentWithImages content={metadata.content} />
        </div>
      )}

      {/* URL */}
      {url && (
        <div className="bg-muted/50 rounded p-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-muted-foreground">URL:</span>
            {hash && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-muted/50 text-muted-foreground border-muted-foreground/50">
                Hash included
              </Badge>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all flex items-center gap-1 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span>{url}</span>
          </a>
        </div>
      )}

      {/* Labels */}
      {(labels['source'] || labels['type'] || labels['tool']) && (
        <div className="flex flex-wrap gap-1.5">
          {labels['source'] && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {labels['source'].value}
            </Badge>
          )}
          {labels['type'] && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {labels['type'].value}
            </Badge>
          )}
          {labels['tool'] && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {labels['tool'].value}
            </Badge>
          )}
        </div>
      )}

      {/* View button */}
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs"
      >
        <Link
          to={`/${eventIdToNote(metadata.id)}`}
          onClick={(e) => e.stopPropagation()}
        >
          View Full Metadata
        </Link>
      </Button>
    </div>
  );
}
