import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { GraphVisualization } from './GraphVisualization';
import { GraphToolbar } from './GraphToolbar';
import type { ScrutinyEvent, CategorizedEvents, Relationships } from '@/lib/scrutiny';

interface GraphPanelProps {
  binding: ScrutinyEvent;
  categorized: CategorizedEvents;
  relationships: Relationships;
}

export function GraphPanel({
  binding,
  categorized,
  relationships,
}: GraphPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  );

  if (!isExpanded) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Relationship Graph</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Relationship Graph</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wrap everything in ReactFlowProvider */}
        <ReactFlowProvider>
          <GraphToolbar
            showLabels={showLabels}
            onToggleLabels={() => setShowLabels(!showLabels)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onHighlightNodes={setHighlightedNodes}
            binding={binding}
            categorized={categorized}
            relationships={relationships}
          />
          <div className="border rounded-lg overflow-hidden bg-muted/20">
            <GraphVisualization
              binding={binding}
              categorized={categorized}
              relationships={relationships}
              showLabels={showLabels}
              searchQuery={searchQuery}
              highlightedNodes={highlightedNodes}
              onHighlightNodes={setHighlightedNodes}
            />
          </div>
        </ReactFlowProvider>
      </CardContent>
    </Card>
  );
}
