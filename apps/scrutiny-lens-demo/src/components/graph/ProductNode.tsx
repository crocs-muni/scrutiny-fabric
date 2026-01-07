import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { ScrutinyEvent } from '@/lib/scrutiny';

interface ProductNodeData {
  event: ScrutinyEvent;
  name: string;
  confirmationCount?: number;
  highlighted?: boolean;
}

export const ProductNode = memo((props: { data: ProductNodeData }) => {
  const { data } = props;
  const { name, confirmationCount, highlighted } = data;

  return (
    <div
      className={`rounded-lg transition-all ${
        highlighted ? 'ring-4 ring-yellow-400' : ''
      }`}
      style={{
        width: '160px',
        minHeight: '100px',
        padding: '12px',
        border: '2px solid #0070C0',
        backgroundColor: 'white',
        boxShadow: highlighted
          ? '0 4px 12px rgba(0, 112, 192, 0.3)'
          : '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px',
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: '#0070C0' }} />

      <div style={{ fontSize: '24px' }}>📦</div>

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

      {confirmationCount && confirmationCount > 0 && (
        <Badge
          variant="outline"
          className="bg-confirmation/10 text-confirmation border-confirmation text-xs px-1.5 py-0"
        >
          ✓ {confirmationCount}
        </Badge>
      )}
    </div>
  );
});

ProductNode.displayName = 'ProductNode';
