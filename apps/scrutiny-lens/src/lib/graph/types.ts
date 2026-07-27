/**
 * GraphAdapter interface — abstraction layer for graph visualization.
 *
 * The rest of the app uses ONLY this interface — no direct graph library calls.
 * When a graph library is chosen, only the adapter implementation changes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
    id: string;
    label: string;
    type: 'product' | 'metadata' | 'binding' | 'update' | 'retract';
    retracted?: boolean;
}

export interface GraphEdge {
    from: string;
    to: string;
    relationship: string;
    directed: boolean;
    label?: string;
}

/**
 * Adapter interface for graph visualization libraries.
 *
 * Requirements for any implementation:
 * - Add/remove nodes (events) and edges (bindings)
 * - Click-to-select a node (emits selected event ID)
 * - Highlight a node by event ID
 * - Support directed edges with a label (the relationship type)
 * - Layout: must respect the directed `q → e root` model from the spec
 */
export interface GraphAdapter {
    /** Mount the graph into a DOM container. */
    initialize(container: HTMLElement): void;

    /** Clean up all resources. */
    destroy(): void;

    /** Clear all nodes and edges from the graph. */
    clear(): void;

    /** Add a node to the graph. */
    addNode(node: GraphNode): void;

    /** Remove a node by ID. */
    removeNode(id: string): void;

    /** Add an edge between two nodes. */
    addEdge(edge: GraphEdge): void;

    /** Remove an edge. */
    removeEdge(from: string, to: string): void;

    /** Highlight a specific node (e.g. on hover or selection). */
    highlightNode(id: string): void;

    /** Clear all highlights. */
    clearHighlight(): void;

    /** Register a callback for node click events. */
    onNodeSelect(callback: (id: string) => void): void;

    /** Fit the entire graph into the viewport. */
    fitToView(): void;
}
