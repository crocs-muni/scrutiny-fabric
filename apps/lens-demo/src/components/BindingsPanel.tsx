import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BindingCard } from '@/components/BindingCard';
import { AuthorFilterDropdown } from '@/components/AuthorFilterDropdown';
import type { BindingWithStats } from '@/hooks/useEventWithBindings';
import { AlertCircle, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface BindingsPanelProps {
  bindings: BindingWithStats[];
  eventType: 'product' | 'metadata';
}

export function BindingsPanel({ bindings, eventType }: BindingsPanelProps) {
  const navigate = useNavigate();
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contentQuery, setContentQuery] = useState('');

  const hasActiveFilters =
    selectedAuthors.length > 0 || startDate !== '' || endDate !== '' || contentQuery.trim() !== '';

  const filteredBindings = useMemo(() => {
    const query = contentQuery.trim().toLowerCase();
    const startTs = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : null;
    const endTs = endDate ? Math.floor(new Date(endDate).getTime() / 1000) + 86399 : null;

    return bindings.filter(entry => {
      const { binding } = entry;

      if (selectedAuthors.length > 0 && !selectedAuthors.includes(binding.pubkey)) {
        return false;
      }

      if (startTs && binding.created_at < startTs) {
        return false;
      }

      if (endTs && binding.created_at > endTs) {
        return false;
      }

      if (query) {
        const content = binding.content.toLowerCase();
        const hasMatch = content.includes(query);
        if (!hasMatch) {
          return false;
        }
      }

      return true;
    });
  }, [bindings, selectedAuthors, startDate, endDate, contentQuery]);

  const handleBindingClick = (bindingId: string) => {
    navigate(`/?binding=${bindingId}`);
  };

  const clearFilters = () => {
    setSelectedAuthors([]);
    setStartDate('');
    setEndDate('');
    setContentQuery('');
  };

  const filterInputClass = 'h-9';

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Bindings ({filteredBindings.length})</h2>
          {bindings.length === 0 && (
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Binding
            </Button>
          )}
        </div>

        {bindings.length > 0 && (
          <div className="mt-4 space-y-3">
            <AuthorFilterDropdown
              items={bindings}
              getPubkey={(b) => b.binding.pubkey}
              selectedAuthors={selectedAuthors}
              onAuthorsChange={setSelectedAuthors}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={event => setStartDate(event.target.value)}
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={event => setEndDate(event.target.value)}
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Search Content</label>
                <Input
                  placeholder="Find text in binding content"
                  value={contentQuery}
                  onChange={event => setContentQuery(event.target.value)}
                  className={cn(filterInputClass, 'placeholder:text-xs')}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Filters applied</span>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {bindings.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">No bindings found</p>
                <p className="text-sm text-muted-foreground">
                  This {eventType} has not been linked to any {eventType === 'product' ? 'metadata items' : 'products'} yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Publish a binding event to connect related SCRUTINY records.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : filteredBindings.length === 0 ? (
          <Alert>
            <AlertDescription>
              No bindings matched the current filters.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {filteredBindings.map(bindingEntry => (
              <BindingCard
                key={bindingEntry.binding.id}
                binding={bindingEntry.binding}
                confirmationCount={bindingEntry.confirmationCount}
                contestationCount={bindingEntry.contestationCount}
                hasUpdate={bindingEntry.hasUpdate}
                productCount={bindingEntry.productCount}
                metadataCount={bindingEntry.metadataCount}
                onClick={() => handleBindingClick(bindingEntry.binding.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
