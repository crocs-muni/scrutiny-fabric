import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import type { EventFilters } from '@/lib/scrutiny';

interface FilterBarProps {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
  onClear: () => void;
}

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const hasActiveFilters =
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.author ||
    filters.dTag ||
    filters.cpe23;

  // Convert npub to hex if needed
  const handleAuthorChange = (value: string) => {
    if (!value) {
      onChange({ ...filters, author: null });
      return;
    }

    // Check if it's an npub format
    if (value.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(value);
        if (decoded.type === 'npub') {
          onChange({ ...filters, author: decoded.data });
          return;
        }
      } catch {
        // If decoding fails, just use the value as-is (might be partial input)
      }
    }

    // Otherwise assume it's hex
    onChange({ ...filters, author: value });
  };

  return (
    <div className="bg-card border rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-auto py-1 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date" className="text-xs">
            Start Date
          </Label>
          <Input
            id="start-date"
            type="date"
            value={
              filters.dateRange.start
                ? new Date(filters.dateRange.start * 1000)
                    .toISOString()
                    .split('T')[0]
                : ''
            }
            onChange={(e) => {
              const timestamp = e.target.value
                ? Math.floor(new Date(e.target.value).getTime() / 1000)
                : null;
              onChange({
                ...filters,
                dateRange: { ...filters.dateRange, start: timestamp },
              });
            }}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-date" className="text-xs">
            End Date
          </Label>
          <Input
            id="end-date"
            type="date"
            value={
              filters.dateRange.end
                ? new Date(filters.dateRange.end * 1000)
                    .toISOString()
                    .split('T')[0]
                : ''
            }
            onChange={(e) => {
              const timestamp = e.target.value
                ? Math.floor(new Date(e.target.value).getTime() / 1000)
                : null;
              onChange({
                ...filters,
                dateRange: { ...filters.dateRange, end: timestamp },
              });
            }}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="author" className="text-xs">
            Author (npub/hex)
          </Label>
          <Input
            id="author"
            type="text"
            placeholder="npub1... or hex"
            value={filters.author || ''}
            onChange={(e) => handleAuthorChange(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dtag" className="text-xs">
            D Tag (identifier)
          </Label>
          <Input
            id="dtag"
            type="text"
            placeholder="org.vendor:product"
            value={filters.dTag || ''}
            onChange={(e) =>
              onChange({ ...filters, dTag: e.target.value || null })
            }
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cpe23" className="text-xs">
            CPE23
          </Label>
          <Input
            id="cpe23"
            type="text"
            placeholder="cpe:2.3:a:vendor:..."
            value={filters.cpe23 || ''}
            onChange={(e) =>
              onChange({ ...filters, cpe23: e.target.value || null })
            }
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
