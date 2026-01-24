import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Link2 } from 'lucide-react';
import type { ScrutinyEvent } from '@/lib/scrutiny';

interface BindingNodeData {
  event: ScrutinyEvent;
  name: string;
  highlighted?: boolean;
}

export const BindingNode = memo((props: { data: BindingNodeData }) => {
  const { data } = props;
  const { highlighted } = data;

  return (
    <div
      className={`rounded-xl transition-all ${
        highlighted ? 'ring-4 ring-yellow-400' : ''
      }`}
      style={{
        width: '140px',
        height: '100px',
        padding: '16px',
        border: '3px solid #2F8E1F',
        backgroundColor: 'white',
        boxShadow: highlighted
          ? '0 4px 12px rgba(47, 142, 31, 0.3)'
          : '0 4px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '8px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#2F8E1F' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#2F8E1F' }} />

      <Link2 style={{ width: '32px', height: '32px', color: '#2F8E1F' }} />

      <div
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: '#2F8E1F',
        }}
      >
        Binding
      </div>
    </div>
  );
});

BindingNode.displayName = 'BindingNode';
