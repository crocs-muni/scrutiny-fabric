import type { Node, Edge } from '@xyflow/react';
import type { ScrutinyEvent, CategorizedEvents, Relationships } from './scrutiny';
import { extractLabels, extractURLAndHash, extractDTag, extractProductRelationships } from './scrutiny';
import { PRODUCT_RELATIONSHIP_COLORS } from './labelRegistry';

const GRAPH_WIDTH = 1200;
const GRAPH_HEIGHT = 800;

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

// Normalize display names
function getProductName(product: ScrutinyEvent): string {
  const labels = extractLabels(product);
  const productName = labels['product_name']?.value || '';
  const version = labels['product_version']?.value || '';

  if (productName) {
    return version ? `${productName} ${version}` : productName;
  }
  // Fallback to vendor if no product name
  const vendor = labels['vendor']?.value || '';
  return vendor || 'Unknown Product';
}

function getMetadataName(metadata: ScrutinyEvent): string {
  // Check for alt tag first (NIP-94 / media metadata)
  const altTag = metadata.tags.find(t => t[0] === 'alt');
  if (altTag && altTag[1] && altTag[1].length < 80) {
    return altTag[1];
  }

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

/**
 * Recursively collect all related products up to maxDepth.
 * Returns a Map of product ID -> { product, depth } where depth indicates
 * how many hops from the binding products.
 */
function collectRelatedProductsRecursive(
  startProducts: ScrutinyEvent[],
  categorized: CategorizedEvents,
  maxDepth: number = 5
): Map<string, { product: ScrutinyEvent; depth: number }> {
  const collected = new Map<string, { product: ScrutinyEvent; depth: number }>();
  const visited = new Set<string>();

  function traverse(products: ScrutinyEvent[], depth: number) {
    if (depth > maxDepth) return;

    const nextProducts: ScrutinyEvent[] = [];

    for (const product of products) {
      if (visited.has(product.id)) continue;
      visited.add(product.id);
      collected.set(product.id, { product, depth });

      const rels = extractProductRelationships(product);
      const relatedIds = [
        ...rels.contains,
        ...rels.dependsOn,
        rels.supersedes,
        rels.successor,
      ].filter((id): id is string => !!id);

      for (const relId of relatedIds) {
        if (visited.has(relId)) continue;
        const relProduct = categorized.products.get(relId);
        if (relProduct) {
          nextProducts.push(relProduct);
        }
      }
    }

    if (nextProducts.length > 0) {
      traverse(nextProducts, depth + 1);
    }
  }

  traverse(startProducts, 0);
  return collected;
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

  // Start with products directly in the binding
  const bindingProducts = productIds
    .map((id) => categorized.products.get(id))
    .filter((p): p is ScrutinyEvent => !!p);

  // Recursively collect ALL related products (contains, depends_on, etc.)
  const allProductsMap = collectRelatedProductsRecursive(bindingProducts, categorized, 5);

  // Convert to array, sorted by depth then by ID for consistent ordering
  const allProducts = Array.from(allProductsMap.entries())
    .sort((a, b) => a[1].depth - b[1].depth || a[0].localeCompare(b[0]))
    .map(([id, { product, depth }]) => ({ product, depth, id }));

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

  // Left: Products arranged by depth level
  // Depth 0 (binding products) closest to binding, deeper levels further left
  const productsByDepth = new Map<number, typeof allProducts>();
  for (const item of allProducts) {
    const list = productsByDepth.get(item.depth) || [];
    list.push(item);
    productsByDepth.set(item.depth, list);
  }

  // Track which products are from the binding (depth 0)
  const isBindingProduct = (id: string) => {
    const item = allProductsMap.get(id);
    return item?.depth === 0;
  };

  // Position products by depth level
  const depthLevels = Array.from(productsByDepth.keys()).sort((a, b) => a - b);
  const DEPTH_SPACING = 200; // horizontal spacing between depth levels
  const VERTICAL_SPACING = 150; // vertical spacing between products at same depth

  for (const depth of depthLevels) {
    const productsAtDepth = productsByDepth.get(depth) || [];
    const startY = centerY - ((productsAtDepth.length - 1) * VERTICAL_SPACING) / 2;
    // Depth 0 is closest to binding, deeper = further left
    const xPos = 50 - (depth * DEPTH_SPACING);

    productsAtDepth.forEach((item, index) => {
      const productY = startY + index * VERTICAL_SPACING;
      const isRelated = depth > 0;

      nodes.push({
        id: item.product.id,
        type: 'product',
        position: { x: xPos, y: productY },
        data: {
          event: item.product,
          name: getProductName(item.product),
          highlighted: highlightedNodes.has(item.product.id),
          isRelated,
          depth,
        },
      });
    });
  }

  // Create a set of all product IDs in the graph for edge validation
  const productIdsInGraph = new Set(allProducts.map(p => p.id));

  // Add edges for all products
  for (const { product, depth } of allProducts) {
    // Only connect binding products (depth 0) directly to binding
    if (depth === 0) {
      edges.push({
        id: `product-binding-${product.id}`,
        source: product.id,
        sourceHandle: 'binding-source',
        target: binding.id,
        type: 'smoothstep',
        style: { stroke: '#2C5AA0', strokeWidth: 2 },
        label: showLabels ? 'product' : undefined,
      });
    }

    // Add product-to-product relationship edges
    const productRels = extractProductRelationships(product);

    // Contains relationships (purple) - use top handles
    productRels.contains.forEach((containedId) => {
      if (productIdsInGraph.has(containedId)) {
        edges.push({
          id: `contains-${product.id}-${containedId}`,
          source: product.id,
          sourceHandle: 'rel-source-top',
          target: containedId,
          targetHandle: 'rel-target-top',
          type: 'smoothstep',
          style: {
            stroke: PRODUCT_RELATIONSHIP_COLORS.contains,
            strokeWidth: 2,
            strokeDasharray: '8,4',
          },
          label: showLabels ? 'contains' : undefined,
          labelStyle: { fill: PRODUCT_RELATIONSHIP_COLORS.contains, fontWeight: 600 },
          zIndex: 10, // Place above other edges
        });
      }
    });

    // Depends-on relationships (amber) - use top handles with different offset
    productRels.dependsOn.forEach((depId) => {
      if (productIdsInGraph.has(depId)) {
        edges.push({
          id: `depends-${product.id}-${depId}`,
          source: product.id,
          sourceHandle: 'rel-source-top',
          target: depId,
          targetHandle: 'rel-target-top',
          type: 'smoothstep',
          style: {
            stroke: PRODUCT_RELATIONSHIP_COLORS.depends_on,
            strokeWidth: 2,
            strokeDasharray: '4,4',
          },
          label: showLabels ? 'depends on' : undefined,
          labelStyle: { fill: PRODUCT_RELATIONSHIP_COLORS.depends_on, fontWeight: 600 },
          zIndex: 11,
        });
      }
    });

    // Supersedes relationship (emerald) - use bottom handles
    if (productRels.supersedes && productIdsInGraph.has(productRels.supersedes)) {
      edges.push({
        id: `supersedes-${product.id}-${productRels.supersedes}`,
        source: product.id,
        sourceHandle: 'rel-source-bottom',
        target: productRels.supersedes,
        targetHandle: 'rel-target-bottom',
        type: 'smoothstep',
        style: {
          stroke: PRODUCT_RELATIONSHIP_COLORS.supersedes,
          strokeWidth: 2,
          strokeDasharray: '6,3',
        },
        label: showLabels ? 'supersedes' : undefined,
        labelStyle: { fill: PRODUCT_RELATIONSHIP_COLORS.supersedes, fontWeight: 600 },
        zIndex: 12,
      });
    }

    // Successor relationship (emerald) - use bottom handles with different offset
    if (productRels.successor && productIdsInGraph.has(productRels.successor)) {
      edges.push({
        id: `successor-${product.id}-${productRels.successor}`,
        source: product.id,
        sourceHandle: 'rel-source-bottom',
        target: productRels.successor,
        targetHandle: 'rel-target-bottom',
        type: 'smoothstep',
        style: {
          stroke: PRODUCT_RELATIONSHIP_COLORS.successor,
          strokeWidth: 2,
          strokeDasharray: '6,3',
        },
        label: showLabels ? 'successor' : undefined,
        labelStyle: { fill: PRODUCT_RELATIONSHIP_COLORS.successor, fontWeight: 600 },
        zIndex: 13,
      });
    }
  }

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
