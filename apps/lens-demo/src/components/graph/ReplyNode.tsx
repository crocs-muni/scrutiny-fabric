import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';
import type { ScrutinyEvent } from '@/lib/scrutiny';

interface ReplyNodeData {
  event: ScrutinyEvent;
  replyType: 'update' | 'confirmation' | 'contestation';
  highlighted?: boolean;
}

export const ReplyNode = memo((props: { data: ReplyNodeData }) => {
  const { data } = props;
  const { replyType, highlighted } = data;

  const colors = {
    update: { bg: '#E46C0A', Icon: RefreshCw },
    confirmation: { bg: '#15803D', Icon: Check },
    contestation: { bg: '#DC2626', Icon: AlertTriangle }
  };

  const config = colors[replyType];

  return (
    <div
      className={`rounded-full transition-all ${
        highlighted ? 'ring-4 ring-yellow-400' : ''
      }`}
      style={{
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: config.bg,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: '2px solid white'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.bg }} />
      <config.Icon className="w-5 h-5" />
    </div>
  );
});

ReplyNode.displayName = 'ReplyNode';
