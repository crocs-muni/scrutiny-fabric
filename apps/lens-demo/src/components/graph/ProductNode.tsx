import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { ScrutinyEvent } from '@/lib/scrutiny';

interface ProductNodeData {
  event: ScrutinyEvent;
  name: string;
  confirmationCount?: number;
  highlighted?: boolean;
  /** Whether this product is shown via relationship (not directly in binding) */
  isRelated?: boolean;
  /** Depth level from binding products (0 = binding product, 1+ = related) */
  depth?: number;
}

export const ProductNode = memo((props: { data: ProductNodeData }) => {
  const { data } = props;
  const { name, confirmationCount, highlighted, isRelated, depth = 0 } = data;

  return (
    <div
      className={`rounded-lg transition-all ${
        highlighted ? 'ring-4 ring-yellow-400' : ''
      }`}
      style={{
        width: '160px',
        minHeight: '100px',
        padding: '12px',
        border: isRelated ? '2px dashed #8B5CF6' : '2px solid #0070C0',
        backgroundColor: isRelated ? '#FAF5FF' : 'white',
        opacity: isRelated ? Math.max(0.6, 1 - depth * 0.1) : 1,
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
      {/* Main target handle for binding edges */}
      <Handle 
        type="target" 
        position={isRelated ? Position.Right : Position.Left} 
        id="binding-target"
        style={{ background: isRelated ? '#8B5CF6' : '#0070C0', top: '50%' }} 
      />
      {/* Main source handle for binding edges */}
      <Handle 
        type="source" 
        position={isRelated ? Position.Left : Position.Right} 
        id="binding-source"
        style={{ background: isRelated ? '#8B5CF6' : '#0070C0', top: '50%' }} 
      />
      
      {/* Relationship handles - top for contains/depends_on */}
      <Handle 
        type="target" 
        position={isRelated ? Position.Right : Position.Left} 
        id="rel-target-top"
        style={{ background: '#A855F7', top: '25%' }} 
      />
      <Handle 
        type="source" 
        position={isRelated ? Position.Left : Position.Right} 
        id="rel-source-top"
        style={{ background: '#A855F7', top: '25%' }} 
      />
      
      {/* Relationship handles - bottom for supersedes/successor */}
      <Handle 
        type="target" 
        position={isRelated ? Position.Right : Position.Left} 
        id="rel-target-bottom"
        style={{ background: '#10B981', top: '75%' }} 
      />
      <Handle 
        type="source" 
        position={isRelated ? Position.Left : Position.Right} 
        id="rel-source-bottom"
        style={{ background: '#10B981', top: '75%' }} 
      />

      <div style={{ fontSize: '24px' }}>{isRelated ? '🔗' : '📦'}</div>

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

      {isRelated && depth > 0 && (
        <Badge
          variant="outline"
          className="text-xs px-1.5 py-0"
          style={{ color: '#8B5CF6', borderColor: '#8B5CF6' }}
        >
          Depth {depth}
        </Badge>
      )}

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
