import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToNpub, pubkeyToShortNpub } from '@/lib/nip19';
import { ContentWithImages } from '@/components/ContentWithImages';
import { getBindingRelationshipStyle, getLegacyScrutinyReason, isDemoScrutinyEvent, type ScrutinyEvent } from '@/lib/scrutiny';
import { RelationshipIcon } from '@/components/RelationshipIcon';
import { User, Package, FileText, Check, AlertTriangle } from 'lucide-react';

interface BindingCardProps {
  binding: ScrutinyEvent;
  confirmationCount: number;
  contestationCount: number;
  hasUpdate: boolean;
  productCount: number;
  metadataCount: number;
  onClick: () => void;
}

export function BindingCard({
  binding,
  confirmationCount,
  contestationCount,
  hasUpdate,
  productCount,
  metadataCount,
  onClick,
}: BindingCardProps) {
  const legacyReason = getLegacyScrutinyReason(binding.tags);
  const isDemo = isDemoScrutinyEvent(binding.tags);
  const relationshipStyle = getBindingRelationshipStyle(binding);
  const author = useAuthor(binding.pubkey);
  const fullNpub = pubkeyToNpub(binding.pubkey);
  const shortNpub = pubkeyToShortNpub(binding.pubkey);
  const displayName = author.data?.metadata?.name ?? shortNpub;

  const timeAgo = formatDistanceToNow(new Date(binding.created_at * 1000), {
    addSuffix: true,
  });

  const preview =
    binding.content.length > 200
      ? `${binding.content.substring(0, 200)}...`
      : binding.content;

  return (
    <Card
      className="border-2 border-binding cursor-pointer transition-all hover:shadow-lg hover:border-binding"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-muted-foreground" />
            <div>
              <div className="font-semibold text-base text-foreground" title={fullNpub}>
                {displayName}
              </div>
              <div className="text-xs text-muted-foreground">@{shortNpub.split('...')[0].substring(5)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge
                variant="outline"
                className="text-xs border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:bg-purple-950/30"
                title="Demo event with _demo suffix tags"
              >
                Demo
              </Badge>
            )}
            {relationshipStyle && (
              <Badge
                variant="outline"
                className={`text-xs flex items-center gap-1 ${relationshipStyle.badgeClass}`}
                title={relationshipStyle.description}
              >
                <RelationshipIcon iconName={relationshipStyle.iconName} className="h-3 w-3" />
                {relationshipStyle.displayName}
              </Badge>
            )}
            {legacyReason && (
              <Badge
                variant="outline"
                className="text-xs border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30"
                title={
                  legacyReason === 'hyphenated-tags'
                    ? 'Legacy SCRUTINY event (hyphenated/v0 tags)'
                    : `Legacy SCRUTINY event (${legacyReason})`
                }
              >
                Legacy
                {legacyReason !== 'hyphenated-tags' ? ` (${legacyReason})` : ''}
              </Badge>
            )}
            {hasUpdate && (
              <Badge variant="outline" className="bg-update/10 text-update border-update text-xs">
                Updated
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ContentWithImages content={preview} className="text-sm leading-relaxed" />

        <div className="flex items-center gap-4 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3.5 w-3.5" />
            <span>{productCount} {productCount === 1 ? 'Product' : 'Products'}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            <span>{metadataCount} {metadataCount === 1 ? 'Metadata' : 'Metadata'}</span>
          </span>
          {(confirmationCount > 0 || contestationCount > 0) && (
            <>
              <span>•</span>
              <div className="flex items-center gap-2">
                {confirmationCount > 0 && (
                  <Badge variant="outline" className="bg-confirmation/10 text-confirmation border-confirmation text-xs px-1.5 py-0 flex items-center gap-1">
                    <Check className="h-3 w-3" /> {confirmationCount}
                  </Badge>
                )}
                {contestationCount > 0 && (
                  <Badge variant="outline" className="bg-contestation/10 text-contestation border-contestation text-xs px-1.5 py-0 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {contestationCount}
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
