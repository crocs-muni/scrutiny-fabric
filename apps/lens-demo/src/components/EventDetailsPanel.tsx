import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EventId } from '@/components/EventId';
import { extractDTag, extractLabels, getLegacyScrutinyReason } from '@/lib/scrutiny';
import { getCountryFlag, validateCPE23 } from '@/lib/productUtils';
import { ExternalLink } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { cn } from '@/lib/utils';

interface EventDetailsPanelProps {
  event: NostrEvent;
  isProduct: boolean;
  isMetadata: boolean;
}

const formatDateTime = (timestamp: number) => {
  try {
    return new Date(timestamp * 1000).toLocaleString();
  } catch {
    return `${timestamp}`;
  }
};

const getStatusClasses = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('active')) {
    return 'bg-green-100 text-green-800 border-green-300';
  }
  if (normalized.includes('archiv') || normalized.includes('historic')) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
  if (normalized.includes('revoked')) {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  return 'bg-muted text-foreground border-muted';
};

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px,1fr] gap-2">
      <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
        {label}
      </span>
      <span className="text-sm text-foreground break-words">{value}</span>
    </div>
  );
}

export function EventDetailsPanel({ event, isProduct, isMetadata }: EventDetailsPanelProps) {
  const legacyReason = getLegacyScrutinyReason(event.tags);
  const labels = extractLabels(event);
  const contentPreview = event.content.length > 160 ? `${event.content.slice(0, 160)}…` : event.content;

  const productName = labels['product_name']?.value;
  const vendor = labels['vendor']?.value;
  const version = labels['product_version']?.value;
  const category = labels['category']?.value;
  const status = labels['status']?.value;
  const cardName = labels['card_name']?.value;
  const stableId = extractDTag(event);
  const cpe23 = labels['cpe23']?.value;
  const purl = labels['purl']?.value;
  const scheme = labels['scheme']?.value;

  // Get all security_level entries (there can be multiple)
  const securityLevels = event.tags
    .filter(t => t[0] === 'l' && t[1] === 'security_level')
    .map(t => t[2]);

  const validFrom = labels['not_valid_before']?.value;
  const validTo = labels['not_valid_after']?.value;
  const seccertsUrl = labels['seccerts_url']?.value;
  const primaryUrl = event.tags.find(tag => tag[0] === 'url')?.[1];

  const metadataUrl = labels['url']?.value;
  const sha256 = labels['x']?.value;
  const mimeType = labels['m']?.value;
  const fileSize = labels['size']?.value;

  return (
    <div className="h-full overflow-y-auto bg-background p-4">
      <Card
        className={cn(
          'shadow-sm border-2',
          isProduct ? 'border-product' : 'border-metadata'
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="space-y-1">
              {isProduct && (
                <div>
                  <div className="text-2xl font-semibold leading-tight">
                    {productName ?? 'Unknown Product'}
                  </div>
                  {vendor && <div className="text-sm text-muted-foreground">{vendor}</div>}
                  {version && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Version: <code className="font-mono text-xs">{version}</code>
                    </div>
                  )}
                </div>
              )}

              {isMetadata && (
                <div>
                  <div className="text-2xl font-semibold leading-tight">Metadata</div>
                  {contentPreview && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {contentPreview}
                    </p>
                  )}
                </div>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
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
              <Badge variant="secondary">{isProduct ? 'Product' : 'Metadata'}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event ID</h3>
            <EventId id={event.id} />
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Published</h3>
            <p className="text-sm text-foreground">{formatDateTime(event.created_at)}</p>
          </section>

          {isProduct && (
            <>
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product Details</h3>
                <div className="space-y-2 text-sm">
                  {vendor && (
                    <DetailRow label="Vendor" value={vendor} />
                  )}
                  {category && (
                    <DetailRow label="Category" value={category} />
                  )}
                  {status && (
                    <DetailRow
                      label="Status"
                      value={
                        <Badge variant="outline" className={getStatusClasses(status)}>
                          {status}
                        </Badge>
                      }
                    />
                  )}
                  {cardName && (
                    <DetailRow label="Card Name" value={cardName} />
                  )}
                  {stableId && (
                    <DetailRow
                      label="Stable ID"
                      value={<code className="font-mono text-xs break-all">{stableId}</code>}
                    />
                  )}
                </div>
              </section>

              {(cpe23 || purl || primaryUrl) && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identifiers</h3>
                  <div className="space-y-2 text-sm">
                    {cpe23 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">CPE 2.3</div>
                        <code className="block rounded border bg-muted px-2 py-1 text-xs break-all">
                          {cpe23}
                        </code>
                        {!validateCPE23(cpe23) && (
                          <p className="text-xs text-destructive mt-1">Invalid CPE format</p>
                        )}
                      </div>
                    )}
                    {purl && (
                      <DetailRow
                        label="PURL"
                        value={<code className="font-mono text-xs break-all">{purl}</code>}
                      />
                    )}
                    {primaryUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={primaryUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Primary URL
                        </a>
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {(scheme || securityLevels.length > 0 || validFrom || validTo || seccertsUrl) && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Certification</h3>
                  {scheme && (
                    <DetailRow
                      label="Scheme"
                      value={
                        <span className="flex items-center gap-2">
                          <span className="text-xl" aria-hidden>
                            {getCountryFlag(scheme)}
                          </span>
                          <span>{scheme}</span>
                        </span>
                      }
                    />
                  )}
                  {securityLevels.length > 0 && (
                    <DetailRow
                      label="Security Level"
                      value={
                        <div className="flex flex-wrap gap-1">
                          {securityLevels.map((level, i) => (
                            <Badge key={i} variant="outline">{level}</Badge>
                          ))}
                        </div>
                      }
                    />
                  )}
                  {(validFrom || validTo) && (
                    <DetailRow label="Validity" value={`${validFrom ?? '—'} → ${validTo ?? '—'}`} />
                  )}
                  {seccertsUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={seccertsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View on sec-certs
                      </a>
                    </Button>
                  )}
                </section>
              )}
            </>
          )}

          {isMetadata && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">File Details</h3>
              {metadataUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={metadataUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View External File
                  </a>
                </Button>
              )}
              {sha256 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">SHA-256 Hash</div>
                  <code className="block rounded border bg-muted px-2 py-1 text-xs break-all">
                    {sha256}
                  </code>
                </div>
              )}
              {(mimeType || fileSize) && (
                <p className="text-xs text-muted-foreground">
                  {mimeType && <span>{mimeType}</span>}
                  {mimeType && fileSize && <span> • </span>}
                  {fileSize && <span>{fileSize} bytes</span>}
                </p>
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
