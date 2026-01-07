import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { ScrutinyEvent } from '@/lib/scrutiny';

interface MetadataNodeData {
  event: ScrutinyEvent;
  name: string;
  confirmationCount?: number;
  contestationCount?: number;
  highlighted?: boolean;
}

export const MetadataNode = memo((props: { data: MetadataNodeData }) => {
  const { data } = props;
  const { name, confirmationCount, contestationCount, highlighted } = data;

  return (
    <div
      className={`rounded-lg transition-all ${
        highlighted ? 'ring-4 ring-yellow-400' : ''
      }`}
      style={{
        width: '160px',
        minHeight: '120px',
        padding: '12px',
        border: '2px solid #E46C0A',
        backgroundColor: 'white',
        boxShadow: highlighted
          ? '0 4px 12px rgba(228, 108, 10, 0.3)'
          : '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#E46C0A' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#E46C0A' }} />

      <div style={{ fontSize: '24px' }}>📄</div>

      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          lineHeight: '1.3',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {confirmationCount && confirmationCount > 0 && (
          <Badge
            variant="outline"
            className="bg-confirmation/10 text-confirmation border-confirmation text-xs px-1.5 py-0"
          >
            ✓ {confirmationCount}
          </Badge>
        )}
        {contestationCount && contestationCount > 0 && (
          <Badge
            variant="outline"
            className="bg-contestation/10 text-contestation border-contestation text-xs px-1.5 py-0"
          >
            ⚠ {contestationCount}
          </Badge>
        )}
      </div>
    </div>
  );
});

MetadataNode.displayName = 'MetadataNode';
