import type { Node, Edge } from '@xyflow/react';
import type { ScrutinyEvent, CategorizedEvents, Relationships } from './scrutiny';
import { extractLabels, extractURLAndHash, extractDTag } from './scrutiny';

const GRAPH_WIDTH = 1200;
const GRAPH_HEIGHT = 800;

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

// Normalize display names
function getProductName(product: ScrutinyEvent): string {
  const labels = extractLabels(product);
  const vendor = labels['vendor']?.value || '';
  const productName = labels['product_name']?.value || '';
  const version = labels['product_version']?.value || '';

  if (vendor && productName) {
    return version ? `${vendor} ${productName} ${version}` : `${vendor} ${productName}`;
  }
  return productName || vendor || 'Unknown Product';
}

function getMetadataName(metadata: ScrutinyEvent): string {
  const { url } = extractURLAndHash(metadata);
  const labels = extractLabels(metadata);

  if (labels['title']?.value) {
    return labels['title'].value;
  }

  if (url) {
    try {
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop();
      if (filename && filename.length > 0 && filename.length < 50) {
        return filename;
      }
    } catch {
      // ignore
    }
  }

  return 'Metadata';
}

function getBindingName(binding: ScrutinyEvent): string {
  const dTag = extractDTag(binding);
  if (dTag && dTag.length < 40) {
    return dTag;
  }

  const firstLine = binding.content.split('\n')[0].trim();
  if (firstLine && firstLine.length < 50 && !firstLine.startsWith('🔗')) {
    return firstLine;
  }

  return 'Binding';
}

export function buildGraphData(
  binding: ScrutinyEvent,
  categorized: CategorizedEvents,
  relationships: Relationships,
  showLabels: boolean,
  highlightedNodes: Set<string>
): GraphData {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const productIds = relationships.bindingToProducts.get(binding.id) || [];
  const metadataIds = relationships.bindingToMetadata.get(binding.id) || [];

  const products = productIds
    .map((id) => categorized.products.get(id))
    .filter((p): p is ScrutinyEvent => !!p);

  const metadata = metadataIds
    .map((id) => categorized.metadata.get(id))
    .filter((m): m is ScrutinyEvent => !!m);

  // Center: Binding
  const centerX = GRAPH_WIDTH / 2 - 80;
  const centerY = GRAPH_HEIGHT / 2 - 50;

  nodes.push({
    id: binding.id,
    type: 'binding',
    position: { x: centerX, y: centerY },
    data: {
      event: binding,
      name: getBindingName(binding),
      highlighted: highlightedNodes.has(binding.id),
    },
  });

  // Left: Products (vertical stack)
  const productStartY = centerY - ((products.length - 1) * 180) / 2;
  products.forEach((product, index) => {
    const productY = productStartY + index * 180;

    nodes.push({
      id: product.id,
      type: 'product',
      position: { x: 50, y: productY },
      data: {
        event: product,
        name: getProductName(product),
        highlighted: highlightedNodes.has(product.id),
      },
    });

    edges.push({
      id: `product-binding-${product.id}`,
      source: product.id,
      target: binding.id,
      type: 'smoothstep',
      style: { stroke: '#2C5AA0', strokeWidth: 2 },
      label: showLabels ? 'product' : undefined,
    });
  });

  // Right: Metadata + Replies
  const metadataStartY = centerY - ((metadata.length - 1) * 200) / 2;

  metadata.forEach((meta, index) => {
    const metaY = metadataStartY + index * 200;
    const metaX = GRAPH_WIDTH - 280;

    const metaUpdates = categorized.updates.get(meta.id) || [];
    const metaConfirmations = categorized.confirmations.get(meta.id) || [];
    const metaContestations = categorized.contestations.get(meta.id) || [];

    // Metadata node
    nodes.push({
      id: meta.id,
      type: 'metadata',
      position: { x: metaX, y: metaY },
      data: {
        event: meta,
        name: getMetadataName(meta),
        highlighted: highlightedNodes.has(meta.id),
      },
    });

    // Edge from binding to metadata
    edges.push({
      id: `binding-metadata-${meta.id}`,
      source: binding.id,
      target: meta.id,
      type: 'smoothstep',
      style: { stroke: '#FD7E14', strokeWidth: 2 },
      label: showLabels ? 'metadata' : undefined,
    });

    // Reply nodes to the right of metadata
    const replies: Array<{ event: ScrutinyEvent; type: 'update' | 'confirmation' | 'contestation' }> = [];

    metaUpdates.forEach(u => replies.push({ event: u, type: 'update' }));
    metaConfirmations.forEach(c => replies.push({ event: c, type: 'confirmation' }));
    metaContestations.forEach(c => replies.push({ event: c, type: 'contestation' }));

    const replyStartY = metaY - ((replies.length - 1) * 80) / 2;

    replies.forEach((reply, replyIndex) => {
      const replyY = replyStartY + replyIndex * 80;
      const replyX = metaX + 240;

      nodes.push({
        id: reply.event.id,
        type: 'reply',
        position: { x: replyX, y: replyY },
        data: {
          event: reply.event,
          replyType: reply.type,
          highlighted: highlightedNodes.has(reply.event.id),
        },
      });

      edges.push({
        id: `reply-${reply.event.id}`,
        source: meta.id,
        target: reply.event.id,
        type: 'smoothstep',
        style: {
          stroke: reply.type === 'update' ? '#FD7E14' : reply.type === 'confirmation' ? '#28A745' : '#DC3545',
          strokeWidth: 1.5,
          strokeDasharray: reply.type === 'update' ? '5,5' : undefined,
        },
        label: showLabels ? reply.type : undefined,
      });
    });
  });

  return { nodes, edges };
}
