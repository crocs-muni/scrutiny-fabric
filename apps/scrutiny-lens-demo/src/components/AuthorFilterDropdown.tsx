import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthor } from '@/hooks/useAuthor';
import { pubkeyToShortNpub } from '@/lib/nip19';
import type { BindingWithStats } from '@/hooks/useEventWithBindings';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Filter, Plus } from 'lucide-react';
import { nip19 } from 'nostr-tools';

interface AuthorFilterDropdownProps {
  bindings: BindingWithStats[];
  selectedAuthors: string[];
  onAuthorsChange: (pubkeys: string[]) => void;
}

// Preset authors
const PRESET_AUTHORS = {
  CROCS: {
    pubkey: '11061ead45560f28ab281735c4803a16be759cd0de1f10d6a5ac2203fc899187',
    npub: 'npub1zyrpat292c8j32egzu6ufqp6z6l8t8xsmc03p4494s3q8lyfjxrsuhkdlc',
    name: 'CRoCS',
  },
};

export function AuthorFilterDropdown({
  bindings,
  selectedAuthors,
  onAuthorsChange,
}: AuthorFilterDropdownProps) {
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');
  
  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>();
    for (const entry of bindings) {
      authors.add(entry.binding.pubkey);
    }
    return Array.from(authors);
  }, [bindings]);

  if (bindings.length === 0) {
    return null;
  }

  const toggleAuthor = (pubkey: string) => {
    const exists = selectedAuthors.includes(pubkey);
    const nextAuthors = exists
      ? selectedAuthors.filter(author => author !== pubkey)
      : [...selectedAuthors, pubkey];
    onAuthorsChange(nextAuthors);
  };

  const clearAll = () => onAuthorsChange([]);
  
  const selectAll = () => onAuthorsChange([]);
  
  const handleAddCustomAuthor = () => {
    setCustomError('');
    const input = customInput.trim();
    
    if (!input) {
      setCustomError('Please enter an npub or pubkey');
      return;
    }
    
    let pubkey: string;
    
    // Try to decode as npub
    if (input.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(input);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          setCustomError('Invalid npub format');
          return;
        }
      } catch {
        setCustomError('Invalid npub format');
        return;
      }
    } else if (input.startsWith('nprofile1')) {
      // Handle nprofile
      try {
        const decoded = nip19.decode(input);
        if (decoded.type === 'nprofile') {
          pubkey = decoded.data.pubkey;
        } else {
          setCustomError('Invalid nprofile format');
          return;
        }
      } catch {
        setCustomError('Invalid nprofile format');
        return;
      }
    } else if (/^[0-9a-f]{64}$/i.test(input)) {
      // Assume hex pubkey
      pubkey = input.toLowerCase();
    } else {
      setCustomError('Please enter a valid npub, nprofile, or hex pubkey');
      return;
    }
    
    // Add the author if not already selected
    if (!selectedAuthors.includes(pubkey)) {
      onAuthorsChange([...selectedAuthors, pubkey]);
      setCustomInput('');
    } else {
      setCustomError('Author already selected');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>
              {selectedAuthors.length > 0
                ? `${selectedAuthors.length} selected`
                : 'Filter authors'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel>Filter by Author</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* All option */}
          <DropdownMenuCheckboxItem
            checked={selectedAuthors.length === 0}
            onCheckedChange={selectAll}
            className="font-medium"
          >
            All Authors
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Presets
          </DropdownMenuLabel>
          
          {/* CRoCS preset */}
          <DropdownMenuCheckboxItem
            checked={selectedAuthors.includes(PRESET_AUTHORS.CROCS.pubkey)}
            onCheckedChange={() => toggleAuthor(PRESET_AUTHORS.CROCS.pubkey)}
          >
            {PRESET_AUTHORS.CROCS.name}
            {uniqueAuthors.includes(PRESET_AUTHORS.CROCS.pubkey) && (
              <span className="ml-auto text-xs text-muted-foreground">
                ({bindings.filter(b => b.binding.pubkey === PRESET_AUTHORS.CROCS.pubkey).length})
              </span>
            )}
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Authors in this list
          </DropdownMenuLabel>
          
          {uniqueAuthors.filter(pubkey => pubkey !== PRESET_AUTHORS.CROCS.pubkey).map(pubkey => (
            <AuthorSelectItem
              key={pubkey}
              pubkey={pubkey}
              bindings={bindings}
              checked={selectedAuthors.includes(pubkey)}
              onToggle={() => toggleAuthor(pubkey)}
            />
          ))}
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Add custom author
          </DropdownMenuLabel>
          
          <div className="px-2 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="npub1... or hex pubkey"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  setCustomError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCustomAuthor();
                  }
                }}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddCustomAuthor}
                className="h-8 px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {customError && (
              <p className="text-xs text-destructive">{customError}</p>
            )}
          </div>
          
          <DropdownMenuSeparator />
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={clearAll}
            disabled={selectedAuthors.length === 0}
          >
            Clear selection
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedAuthors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAuthors.map(pubkey => (
            <AuthorBadge key={pubkey} pubkey={pubkey} onRemove={() => toggleAuthor(pubkey)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AuthorSelectItemProps {
  pubkey: string;
  bindings: BindingWithStats[];
  checked: boolean;
  onToggle: () => void;
}

function AuthorSelectItem({ pubkey, bindings, checked, onToggle }: AuthorSelectItemProps) {
  const { data: authorData } = useAuthor(pubkey);
  const displayName = authorData?.metadata?.name ?? pubkeyToShortNpub(pubkey);
  const count = useMemo(
    () => bindings.filter(binding => binding.binding.pubkey === pubkey).length,
    [bindings, pubkey]
  );

  return (
    <DropdownMenuCheckboxItem checked={checked} onCheckedChange={onToggle}>
      {displayName} ({count})
    </DropdownMenuCheckboxItem>
  );
}

interface AuthorBadgeProps {
  pubkey: string;
  onRemove: () => void;
}

function AuthorBadge({ pubkey, onRemove }: AuthorBadgeProps) {
  const { data: authorData } = useAuthor(pubkey);
  const displayName = authorData?.metadata?.name ?? pubkeyToShortNpub(pubkey);

  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1 cursor-pointer"
      onClick={onRemove}
    >
      {displayName}
      <span className="text-xs">✕</span>
    </Badge>
  );
}
