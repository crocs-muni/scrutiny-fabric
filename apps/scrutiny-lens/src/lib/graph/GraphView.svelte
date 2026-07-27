<script lang="ts">
	/**
	 * GraphView — Cytoscape.js-powered interactive graph visualization.
	 * Renders SCRUTINY Fabric nodes (products, metadata, bindings) as a directed graph
	 * with click-to-select, highlight, and zoom controls.
	 */
	import type { GraphNode, GraphEdge } from "./types.js";
	import { CytoscapeAdapter } from "./cytoscapeAdapter.js";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import MinusIcon from "@lucide/svelte/icons/minus";
	import Maximize2Icon from "@lucide/svelte/icons/maximize-2";

	interface Props {
		nodes?: GraphNode[];
		edges?: GraphEdge[];
		highlightId?: string;
		contextSelectedIds?: Set<string>;
		onNodeSelect?: (id: string) => void;
	}

	let {
		nodes = [],
		edges = [],
		highlightId = "",
		contextSelectedIds = new Set<string>(),
		onNodeSelect,
	}: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state(undefined);
	let adapter: CytoscapeAdapter | null = null;
	let initialized = $state(false);

	// ── Mount / Unmount ──────────────────────────────────────────
	import { untrack } from "svelte";

	$effect(() => {
		untrack(() => {
			if (!containerEl) return;
			adapter = new CytoscapeAdapter();
			adapter.initialize(containerEl);

			if (onNodeSelect) {
				adapter.onNodeSelect(onNodeSelect);
			}

			// Initial data load
			syncGraph(nodes, edges);
			initialized = true;
		});

		return () => {
			adapter?.destroy();
			adapter = null;
			initialized = false;
		};
	});

	// ── Reactive sync ────────────────────────────────────────────
	$effect(() => {
		if (!initialized || !adapter) return;
		syncGraph(nodes, edges);
	});

	$effect(() => {
		if (!initialized || !adapter) return;
		if (highlightId) {
			adapter.highlightNode(highlightId);
		} else {
			adapter.clearHighlight();
		}
	});

	$effect(() => {
		if (!initialized || !adapter) return;
		adapter.setContextSelected(contextSelectedIds);
	});

	// ── Sync helper ──────────────────────────────────────────────
	function syncGraph(newNodes: GraphNode[], newEdges: GraphEdge[]) {
		if (!adapter) return;

		adapter.clear();

		// Add all nodes first
		for (const node of newNodes) {
			adapter.addNode(node);
		}

		// Then add edges
		for (const edge of newEdges) {
			adapter.addEdge(edge);
		}

		// Run layout if we have nodes
		if (newNodes.length > 0) {
			adapter.runLayout();
		}
	}

	// ── Zoom controls ────────────────────────────────────────────
	function handleZoomIn() {
		adapter?.zoomIn();
	}

	function handleZoomOut() {
		adapter?.zoomOut();
	}

	function handleFitToView() {
		adapter?.fitToView();
	}
</script>

<div class="graph-container">
	<div bind:this={containerEl} class="graph-canvas"></div>

	<!-- Zoom controls -->
	{#if initialized}
		<div class="zoom-controls">
			<button
				onclick={handleZoomIn}
				class="zoom-btn"
				title="Zoom in"
				aria-label="Zoom in"
			>
				<PlusIcon class="h-3 w-3" />
			</button>
			<button
				onclick={handleZoomOut}
				class="zoom-btn"
				title="Zoom out"
				aria-label="Zoom out"
			>
				<MinusIcon class="h-3 w-3" />
			</button>
			<button
				onclick={handleFitToView}
				class="zoom-btn"
				title="Fit to view"
				aria-label="Fit to view"
			>
				<Maximize2Icon class="h-3 w-3" />
			</button>
		</div>
	{/if}

	<!-- Legend -->
	<div class="graph-legend">
		<div class="legend-item">
			<span class="legend-dot" style="background: #3b82f6;"></span>
			<span>Product</span>
		</div>
		<div class="legend-item">
			<span
				class="legend-dot"
				style="background: #f59e0b; border-radius: 2px; transform: rotate(45deg);"
			></span>
			<span>Metadata</span>
		</div>
	</div>
</div>

<style>
	.graph-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.graph-canvas {
		width: 100%;
		height: 100%;
	}

	.zoom-controls {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 10;
	}

	.zoom-btn {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.zoom-btn:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.graph-legend {
		position: absolute;
		bottom: 8px;
		left: 8px;
		display: flex;
		gap: 10px;
		z-index: 10;
		padding: 4px 8px;
		border-radius: 6px;
		background: hsl(var(--background) / 0.85);
		border: 1px solid hsl(var(--border));
		backdrop-filter: blur(4px);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 9px;
		color: hsl(var(--muted-foreground));
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
