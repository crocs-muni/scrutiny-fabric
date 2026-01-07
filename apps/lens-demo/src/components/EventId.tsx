import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Link } from 'react-router-dom';
import { eventIdToNote } from '@/lib/nip19';

interface EventIdProps {
  id: string;
  truncate?: boolean; // show truncated preview, defaults to true
  className?: string;
}

export function EventId({ id, truncate = true, className }: EventIdProps) {
  const { toast } = useToast();
  const preview = truncate ? `${id.substring(0, 16)}...` : id;
  const note = eventIdToNote(id);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    toast({ title: 'Copied', description: 'Event ID copied to clipboard' });
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className || ''}`}>
      <Link
        to={`/${note}`}
        className="font-mono text-xs text-primary hover:underline break-all"
        title="View event"
      >
        {preview}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={handleCopy}
        aria-label="Copy Event ID"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        asChild
      >
        <a
          href={`https://njump.me/${note}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on njump.me"
          title="Open on njump.me"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}