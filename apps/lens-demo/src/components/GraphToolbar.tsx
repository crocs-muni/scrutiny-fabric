import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Search, Download, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import type { ScrutinyEvent, CategorizedEvents, Relationships } from '@/lib/scrutiny';

interface GraphToolbarProps {
  showLabels: boolean;
  onToggleLabels: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onHighlightNodes: (nodes: Set<string>) => void;
  binding: ScrutinyEvent;
  categorized: CategorizedEvents;
  relationships: Relationships;
}

export function GraphToolbar({
  showLabels,
  onToggleLabels,
  searchQuery,
  onSearchChange,
  onHighlightNodes,
  binding,
  categorized,
  relationships,
}: GraphToolbarProps) {
  const { toast } = useToast();

  const handleSearch = (query: string) => {
    onSearchChange(query);
    if (!query.trim()) {
      onHighlightNodes(new Set());
      return;
    }

    const lowerQuery = query.toLowerCase();
    const highlighted = new Set<string>();

    // Search binding
    if (
      binding.id.toLowerCase().includes(lowerQuery) ||
      binding.content.toLowerCase().includes(lowerQuery) ||
      binding.pubkey.toLowerCase().includes(lowerQuery)
    ) {
      highlighted.add(binding.id);
    }

    // Search products
    const productIds = relationships.bindingToProducts.get(binding.id) || [];
    productIds.forEach((id) => {
      const product = categorized.products.get(id);
      if (
        product &&
        (product.id.toLowerCase().includes(lowerQuery) ||
          product.content.toLowerCase().includes(lowerQuery) ||
          product.pubkey.toLowerCase().includes(lowerQuery))
      ) {
        highlighted.add(id);
      }
    });

    // Search metadata
    const metadataIds = relationships.bindingToMetadata.get(binding.id) || [];
    metadataIds.forEach((id) => {
      const metadata = categorized.metadata.get(id);
      if (
        metadata &&
        (metadata.id.toLowerCase().includes(lowerQuery) ||
          metadata.content.toLowerCase().includes(lowerQuery) ||
          metadata.pubkey.toLowerCase().includes(lowerQuery))
      ) {
        highlighted.add(id);
      }
    });

    onHighlightNodes(highlighted);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const handleExportPNG = async () => {
    const graphContainer = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!graphContainer) {
      toast({
        title: 'Export failed',
        description: 'Graph not ready for export',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Dynamic import to avoid TypeScript errors
      const htmlToImage = await import('html-to-image');

      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await htmlToImage.toPng(graphContainer, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });

      downloadImage(dataUrl, `binding-graph-${binding.id.substring(0, 8)}.png`);

      toast({
        title: 'Graph exported',
        description: 'PNG file downloaded successfully',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export graph. Try using browser screenshot instead.',
        variant: 'destructive',
      });
    }
  };

  const handleExportSVG = async () => {
    const graphContainer = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!graphContainer) {
      toast({
        title: 'Export failed',
        description: 'Graph not ready for export',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Dynamic import to avoid TypeScript errors
      const htmlToImage = await import('html-to-image');

      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await htmlToImage.toSvg(graphContainer, {
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      downloadImage(dataUrl, `binding-graph-${binding.id.substring(0, 8)}.svg`);

      toast({
        title: 'Graph exported',
        description: 'SVG file downloaded successfully',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export graph. Try using browser screenshot instead.',
        variant: 'destructive',
      });
    }
  };

  const handleResetView = () => {
    onSearchChange('');
    onHighlightNodes(new Set());
    window.dispatchEvent(new CustomEvent('graph-reset-view'));
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="show-labels"
          checked={showLabels}
          onCheckedChange={onToggleLabels}
        />
        <Label htmlFor="show-labels" className="text-sm cursor-pointer">
          Show Labels
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPNG}>
          <Download className="h-4 w-4 mr-2" />
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportSVG}>
          <Download className="h-4 w-4 mr-2" />
          SVG
        </Button>
        <Button variant="outline" size="sm" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}
