/**
 * CytoscapeAdapter — implements GraphAdapter using Cytoscape.js + dagre layout.
 */
import cytoscape, { type Core, type EventObjectNode } from 'cytoscape';
// @ts-expect-error — no @types/cytoscape-dagre package exists
import dagre from 'cytoscape-dagre';

import type { GraphAdapter, GraphNode, GraphEdge } from './types.js';

// Register the dagre layout plugin once
let dagreRegistered = false;

// ── Colour palette ────────────────────────────────────────────────────────
const COLORS = {
    product: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },     // blue
    metadata: { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },    // amber
    binding: { bg: '#22c55e', border: '#16a34a', text: '#ffffff' },     // green
    update: { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },      // violet
    retract: { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },     // red
    fallback: { bg: '#64748b', border: '#475569', text: '#ffffff' },    // slate
} as const;

// ── Shape mapping ─────────────────────────────────────────────────────────
const SHAPE_MAP: Record<string, string> = {
    product: 'round-rectangle',
    metadata: 'diamond',
    binding: 'ellipse',
    update: 'round-rectangle',
    retract: 'hexagon',
};

function palette(type: string): (typeof COLORS)[keyof typeof COLORS] {
    return (COLORS as Record<string, (typeof COLORS)[keyof typeof COLORS]>)[type] ?? COLORS.fallback;
}

// ── Stylesheet ────────────────────────────────────────────────────────────
function buildStylesheet(): cytoscape.StylesheetStyle[] {
    return [
        // Base node style
        {
            selector: 'node',
            style: {
                'label': 'data(label)',
                'text-valign': 'bottom' as const,
                'text-halign': 'center' as const,
                'font-size': '9px',
                'font-family': 'Inter, system-ui, sans-serif',
                'color': '#94a3b8',
                'text-margin-y': 6,
                'text-max-width': '80px',
                'text-wrap': 'ellipsis' as const,
                'width': 28,
                'height': 28,
                'border-width': 2,
                'border-opacity': 1,
                'text-outline-width': 0,
                'overlay-padding': 4,
            } as any,
        },
        // Per-type node styles
        ...(['product', 'metadata', 'binding', 'update', 'retract'] as const).map((type) => ({
            selector: `node[type="${type}"]`,
            style: {
                'background-color': palette(type).bg,
                'border-color': palette(type).border,
                'shape': SHAPE_MAP[type] || 'ellipse',
                'width': type === 'binding' ? 18 : type === 'product' ? 36 : 28,
                'height': type === 'binding' ? 18 : type === 'product' ? 36 : 28,
            },
        })),
        // Highlighted node (selected)
        {
            selector: 'node.highlighted',
            style: {
                'border-width': 4,
                'border-color': '#a78bfa',
                'overlay-color': '#a78bfa',
                'overlay-opacity': 0.15,
                'overlay-padding': 8,
                'z-index': 10,
            } as any,
        },
        // Context-selected (for product nodes in AI context)
        {
            selector: 'node.context-selected',
            style: {
                'border-width': 3,
                'border-color': '#fbbf24',
                'overlay-color': '#fbbf24',
                'overlay-opacity': 0.1,
                'overlay-padding': 6,
            } as any,
        },
        // Base edge style
        {
            selector: 'edge',
            style: {
                'width': 1.5,
                'line-color': '#334155',
                'target-arrow-color': '#334155',
                'target-arrow-shape': 'triangle' as const,
                'arrow-scale': 0.7,
                'curve-style': 'bezier' as const,
                'label': 'data(label)',
                'font-size': '7px',
                'font-family': 'Inter, system-ui, sans-serif',
                'color': '#64748b',
                'text-background-color': '#0f172a',
                'text-background-opacity': 0.85,
                'text-background-padding': '2px',
                'text-rotation': 'autorotate' as const,
            } as any,
        },
        // Directed edge
        {
            selector: 'edge[directed]',
            style: {
                'target-arrow-shape': 'triangle' as const,
            },
        },
        // Undirected edge
        {
            selector: 'edge[!directed]',
            style: {
                'target-arrow-shape': 'none' as const,
            },
        },
    ];
}

// ── Adapter ───────────────────────────────────────────────────────────────
export class CytoscapeAdapter implements GraphAdapter {
    private cy: Core | null = null;
    private selectCallback: ((id: string) => void) | null = null;

    initialize(container: HTMLElement): void {
        if (!dagreRegistered) {
            cytoscape.use(dagre as any);
            dagreRegistered = true;
        }

        this.cy = cytoscape({
            container,
            style: buildStylesheet() as any,
            layout: { name: 'preset' },
            minZoom: 0.3,
            maxZoom: 3,
            boxSelectionEnabled: false,
            selectionType: 'single',
        });

        // Forward tap events
        this.cy.on('tap', 'node', (evt: EventObjectNode) => {
            const id = evt.target.id();
            if (this.selectCallback) this.selectCallback(id);
        });
    }

    destroy(): void {
        this.cy?.destroy();
        this.cy = null;
    }

    clear(): void {
        if (!this.cy) return;
        this.cy.elements().remove();
    }

    addNode(node: GraphNode): void {
        if (!this.cy) return;
        if (this.cy.getElementById(node.id).length > 0) return; // skip duplicates
        this.cy.add({
            group: 'nodes',
            data: {
                id: node.id,
                label: node.label.length > 25 ? node.label.slice(0, 22) + '…' : node.label,
                type: node.type,
            },
        });
    }

    removeNode(id: string): void {
        if (!this.cy) return;
        const el = this.cy.getElementById(id);
        if (el.length > 0) el.remove();
    }

    addEdge(edge: GraphEdge): void {
        if (!this.cy) return;
        const edgeId = `${edge.from}->${edge.to}`;
        if (this.cy.getElementById(edgeId).length > 0) return; // skip duplicates
        // skip edges whose source/target nodes don't exist
        if (this.cy.getElementById(edge.from).length === 0) return;
        if (this.cy.getElementById(edge.to).length === 0) return;
        this.cy.add({
            group: 'edges',
            data: {
                id: edgeId,
                source: edge.from,
                target: edge.to,
                label: edge.label || edge.relationship,
                directed: edge.directed,
            },
        });
    }

    removeEdge(from: string, to: string): void {
        if (!this.cy) return;
        const el = this.cy.getElementById(`${from}->${to}`);
        if (el.length > 0) el.remove();
    }

    highlightNode(id: string): void {
        if (!this.cy) return;
        this.cy.elements().removeClass('highlighted');
        const el = this.cy.getElementById(id);
        if (el.length > 0) el.addClass('highlighted');
    }

    clearHighlight(): void {
        if (!this.cy) return;
        this.cy.elements().removeClass('highlighted');
    }

    onNodeSelect(callback: (id: string) => void): void {
        this.selectCallback = callback;
    }

    fitToView(): void {
        if (!this.cy) return;
        this.cy.fit(undefined, 30);
    }

    /** Run dagre layout and fit to view. */
    runLayout(): void {
        if (!this.cy) return;
        this.cy.layout({
            name: 'dagre',
            rankDir: 'TB',
            nodeSep: 40,
            rankSep: 50,
            edgeSep: 20,
            animate: true,
            animationDuration: 400,
            fit: true,
            padding: 30,
        } as any).run();
    }

    /** Zoom in by a step. */
    zoomIn(): void {
        if (!this.cy) return;
        this.cy.zoom({
            level: this.cy.zoom() * 1.3,
            renderedPosition: {
                x: this.cy.width() / 2,
                y: this.cy.height() / 2,
            },
        });
    }

    /** Zoom out by a step. */
    zoomOut(): void {
        if (!this.cy) return;
        this.cy.zoom({
            level: this.cy.zoom() / 1.3,
            renderedPosition: {
                x: this.cy.width() / 2,
                y: this.cy.height() / 2,
            },
        });
    }

    /** Mark nodes as context-selected (e.g. product nodes in AI context). */
    setContextSelected(ids: Set<string>): void {
        if (!this.cy) return;
        this.cy.nodes().removeClass('context-selected');
        ids.forEach((id) => {
            const el = this.cy!.getElementById(id);
            if (el.length > 0) el.addClass('context-selected');
        });
    }
}
