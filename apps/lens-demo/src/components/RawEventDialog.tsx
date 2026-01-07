import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Copy, Code } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import type { ScrutinyEvent } from '@/lib/scrutiny';

interface RawEventDialogProps {
  event: ScrutinyEvent;
  eventType?: string;
}

export function RawEventDialog({ event, eventType = 'Event' }: RawEventDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Keep only real Nostr fields (hide synthetic eventType)
  const realEvent = useMemo(() => {
    const { id, kind, pubkey, created_at, tags, content, sig } = event;
    return { id, kind, pubkey, created_at, tags, content, sig };
  }, [event]);

  // Theme-aware JSON syntax highlighter
  const syntaxHighlight = (obj: unknown, isDark: boolean) => {
    const json = JSON.stringify(obj, null, 2)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Color schemes
    const colors = isDark ? {
      key: 'text-purple-400',
      string: 'text-emerald-400',
      number: 'text-blue-400',
      boolean: 'text-orange-400',
      null: 'text-gray-500',
    } : {
      key: 'text-purple-700',
      string: 'text-emerald-700',
      number: 'text-blue-700',
      boolean: 'text-orange-700',
      null: 'text-gray-400',
    };

    return json
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|\b-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b)/g, (match) => {
        let cls = colors.string;
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? colors.key : colors.string;
        } else if (/true|false/.test(match)) {
          cls = colors.boolean;
        } else if (/null/.test(match)) {
          cls = colors.null;
        } else {
          cls = colors.number;
        }
        return `<span class="${cls}">${match}</span>`;
      });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(realEvent, null, 2));
      toast({
        title: 'Copied',
        description: 'Event JSON copied to clipboard',
        duration: 2000,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Detect if dark mode is active
  const [isDark, setIsDark] = useState(false);

  useState(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs gap-1 hover:bg-muted border border-border"
        >
          <Code className="h-3 w-3" />
          <span className="font-semibold uppercase">RAW JSON</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle>Raw {eventType} JSON</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy JSON
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Scrollable JSON content area */}
          <div className={`flex-1 overflow-y-auto border rounded-lg ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            <pre className="p-6 text-xs font-mono whitespace-pre overflow-x-auto leading-7" style={{ wordWrap: 'break-word' }}>
              <code
                className={isDark ? 'text-zinc-200' : 'text-zinc-800'}
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(realEvent, isDark) }}
              />
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
