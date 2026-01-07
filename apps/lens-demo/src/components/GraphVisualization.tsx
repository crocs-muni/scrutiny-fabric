import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ProductNode } from './graph/ProductNode';
import { MetadataNode } from './graph/MetadataNode';
import { BindingNode } from './graph/BindingNode';
import { ReplyNode } from './graph/ReplyNode';
import { buildGraphData } from '@/lib/graph';
import type { ScrutinyEvent, CategorizedEvents, Relationships } from '@/lib/scrutiny';

interface GraphVisualizationProps {
  binding: ScrutinyEvent;
  categorized: CategorizedEvents;
  relationships: Relationships;
  showLabels: boolean;
  searchQuery: string;
  highlightedNodes: Set<string>;
  onHighlightNodes: (nodes: Set<string>) => void;
}

const nodeTypes = {
  product: ProductNode,
  metadata: MetadataNode,
  binding: BindingNode,
  reply: ReplyNode,
};

export function GraphVisualization({
  binding,
  categorized,
  relationships,
  showLabels,
  searchQuery: _searchQuery,
  highlightedNodes,
  onHighlightNodes: _onHighlightNodes,
}: GraphVisualizationProps) {
  const { fitView } = useReactFlow();
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      buildGraphData(
        binding,
        categorized,
        relationships,
        showLabels,
        highlightedNodes
      ),
    [binding, categorized, relationships, showLabels, highlightedNodes]
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraphData(
      binding,
      categorized,
      relationships,
      showLabels,
      highlightedNodes
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [binding, categorized, relationships, showLabels, highlightedNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Scroll to corresponding card in DetailedView
      const eventId = node.id.replace('-update-ghost', ''); // Handle ghost nodes
      const cardElement = document.querySelector(
        `[data-event-id="${eventId}"]`
      );
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardElement.classList.add('graph-highlighted');
        setTimeout(() => {
          cardElement.classList.remove('graph-highlighted');
        }, 2000);
      }
    },
    []
  );

  useEffect(() => {
    const handleResetView = () => {
      fitView({ padding: 0.2, duration: 300 });
    };

    window.addEventListener('graph-reset-view', handleResetView);
    return () => {
      window.removeEventListener('graph-reset-view', handleResetView);
    };
  }, [fitView]);

  useEffect(() => {
    // Initial fit view
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 100);
  }, [fitView]);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
