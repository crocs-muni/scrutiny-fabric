import { Badge } from '@/components/ui/badge';
import { Box, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { eventIdToNote } from '@/lib/nip19';
import { extractLabels } from '@/lib/scrutiny';
import { PRODUCT_RELATIONSHIP_COLORS } from '@/lib/labelRegistry';
import type { ScrutinyEvent } from '@/lib/scrutiny';

export type RelationshipType = 'contains' | 'depends_on' | 'supersedes' | 'successor' | 'contained_by' | 'depended_on_by';

interface RelationshipActivityProps {
  /** The type of relationship */
  relationshipType: RelationshipType;
  /** The related product event (if available) */
  relatedProduct?: ScrutinyEvent;
  /** Event ID of the related product (if event not available) */
  relatedEventId: string;
}

const RELATIONSHIP_CONFIG: Record<RelationshipType, {
  label: string;
  icon: 'outgoing' | 'incoming';
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  contains: {
    label: 'Contains',
    icon: 'outgoing',
    color: PRODUCT_RELATIONSHIP_COLORS.contains,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  depends_on: {
    label: 'Depends On',
    icon: 'outgoing',
    color: PRODUCT_RELATIONSHIP_COLORS.depends_on,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  supersedes: {
    label: 'Supersedes',
    icon: 'outgoing',
    color: PRODUCT_RELATIONSHIP_COLORS.supersedes,
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  successor: {
    label: 'Successor',
    icon: 'outgoing',
    color: PRODUCT_RELATIONSHIP_COLORS.successor,
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  contained_by: {
    label: 'Contained By',
    icon: 'incoming',
    color: PRODUCT_RELATIONSHIP_COLORS.contains,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  depended_on_by: {
    label: 'Depended On By',
    icon: 'incoming',
    color: PRODUCT_RELATIONSHIP_COLORS.depends_on,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
};

function getProductDisplayName(product?: ScrutinyEvent, eventId?: string): string {
  if (product) {
    const labels = extractLabels(product);
    const vendor = labels['vendor']?.value;
    const name = labels['product_name']?.value;
    const version = labels['product_version']?.value;
    if (vendor && name) {
      return version ? `${vendor} ${name} ${version}` : `${vendor} ${name}`;
    }
    return name || vendor || eventId?.substring(0, 8) + '...' || 'Unknown';
  }
  return eventId ? eventId.substring(0, 8) + '...' : 'Unknown';
}

export function RelationshipActivity({
  relationshipType,
  relatedProduct,
  relatedEventId,
}: RelationshipActivityProps) {
  const config = RELATIONSHIP_CONFIG[relationshipType];
  const productName = getProductDisplayName(relatedProduct, relatedEventId);
  const noteId = eventIdToNote(relatedEventId);

  return (
    <div className={`border rounded-md p-3 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge
          variant="outline"
          className="text-xs px-1.5 py-0"
          style={{ color: config.color, borderColor: config.color }}
        >
          {config.icon === 'outgoing' ? (
            <ArrowRight className="h-3 w-3 mr-1" />
          ) : (
            <ArrowLeft className="h-3 w-3 mr-1" />
          )}
          {config.label}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Package className="h-4 w-4" style={{ color: config.color }} />
        <Link
          to={`/${noteId}`}
          className="text-sm font-medium hover:underline"
          style={{ color: config.color }}
        >
          {productName}
        </Link>
      </div>
    </div>
  );
}
