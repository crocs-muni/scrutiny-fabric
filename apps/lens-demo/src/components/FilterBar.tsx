import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import type { EventFilters, ScrutinyEvent } from '@/lib/scrutiny';
import { AuthorFilterDropdown } from '@/components/AuthorFilterDropdown';

interface FilterBarProps {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
  onClear: () => void;
  events: ScrutinyEvent[];
}

export function FilterBar({ filters, onChange, onClear, events }: FilterBarProps) {
  const hasActiveFilters =
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.authors.length > 0 ||
    filters.tTag;

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Label className="text-xs">Filter by Author</Label>
          <AuthorFilterDropdown
            items={events}
            getPubkey={(e) => e.pubkey}
            selectedAuthors={filters.authors}
            onAuthorsChange={(authors) => onChange({ ...filters, authors })}
            className="w-full"
            triggerClassName="w-full h-9 text-sm justify-start font-normal"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ttag" className="text-xs">
            T Tag (topic)
          </Label>
          <Input
            id="ttag"
            type="text"
            placeholder="Search topics..."
            value={filters.tTag || ''}
            onChange={(e) =>
              onChange({ ...filters, tTag: e.target.value || null })
            }
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
