<script lang="ts">
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { enabledRelayUrls } from "$lib/stores/relayStore.js";
	import { addEvents } from "$lib/stores/eventStore.js";
	import { trustedPubkeys, showUntrusted } from "$lib/stores/trustStore.js";
	import {
		fetchEventsByIds,
		fetchProductBindings,
		fetchMetadataBindings,
		fetchEventsTargeting,
		getCachedEvent,
	} from "$lib/nostr/subscriptions.js";
	import {
		computeEffectiveView,
		extractScrutinyType,
		extractBindingEndpoints,
		buildRelationshipEdges,
		type NostrEvent,
		type EffectiveView,
		type RelationshipEdge,
	} from "@scrutiny-fabric/scrutiny-fabric";
	import { extractBindingReferencedEventIds } from "$lib/utils/binding-tags.js";
	import { sanitizeEventContent } from "$lib/security/sanitize.js";
	import {
		truncateHex,
		formatRelativeTime,
		eventTypeLabel,
		relationshipLabel,
	} from "$lib/utils/formatters.js";
	import { Spinner } from "$lib/components/ui/spinner/index.js";
	import {
		currentSession,
		createSession,
		addMessage,
		clearSession,
	} from "$lib/stores/sessionStore.js";
	import { sendChatMessage, checkAiHealth } from "$lib/ai/client.js";
	import type { ChatMessage, ChatRequest } from "$lib/ai/types.js";
	import { Markdown } from "$lib/components/prompt-kit/markdown/index.js";
	import { Loader } from "$lib/components/prompt-kit/loader/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Checkbox } from "$lib/components/ui/checkbox/index.js";
	import { CopyButton } from "$lib/components/ui/copy-button/index.js";
	import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
	import FilterIcon from "@lucide/svelte/icons/filter";
	import ShareIcon from "@lucide/svelte/icons/share";

	import type { GraphNode, GraphEdge } from "$lib/graph/types.js";
	import GraphView from "$lib/graph/GraphView.svelte";

	// ── State ──────────────────────────────────────────────────────
	let eventId = $derived($page.params.eventId ?? "");
	let loading = $state(true);
	let targetEvent = $state<NostrEvent | null>(null);
	let effectiveView = $state<EffectiveView | null>(null);
	let relatedEvents = $state<NostrEvent[]>([]);
	let graphNodes = $state<GraphNode[]>([]);
	let graphEdges = $state<GraphEdge[]>([]);

	let aiAvailable = $state(false);
	let question = $state("");
	let sending = $state(false);
	let selectedProductIds = $state<Set<string>>(new Set());

	function getTrustedAdmissionSet(events: NostrEvent[]): Set<string> {
		const admitted = new Set<string>();

		for (const event of events) {
			if ($trustedPubkeys.has(event.pubkey as string)) {
				admitted.add(event.id as string);
			}

			if (extractScrutinyType(event) !== "binding") continue;
			if (!$trustedPubkeys.has(event.pubkey as string)) continue;

			for (const id of extractBindingReferencedEventIds(event)) {
				admitted.add(id);
			}
		}

		return admitted;
	}

	// ── Selection state ───────────────────────────────────────────
	// The currently selected event (from graph or list). Defaults to targetEvent.
	let selectedEventId = $state<string>("");
	let visibleRelatedEvents = $derived.by(() => {
		if ($showUntrusted) return relatedEvents;

		const admittedIds = getTrustedAdmissionSet([targetEvent, ...relatedEvents].filter((e): e is NostrEvent => !!e));

		return relatedEvents.filter(
			(event) =>
				$trustedPubkeys.has(event.pubkey as string) ||
				admittedIds.has(event.id as string),
		);
	});

	let selectedEvent = $derived.by(() => {
		if (!selectedEventId) return targetEvent;
		if (selectedEventId === targetEvent?.id) return targetEvent;
		return (
			visibleRelatedEvents.find((e) => e.id === selectedEventId) ??
			targetEvent
		);
	});

	let selectedType = $derived(
		selectedEvent ? extractScrutinyType(selectedEvent) : null,
	);

	function selectEvent(id: string) {
		selectedEventId = id;
	}

	// ── All events for display (target + related) ─────────────────
	let allEvents = $derived.by(() => {
		if (!targetEvent) return [];
		return [targetEvent, ...visibleRelatedEvents];
	});

	let selectedParam = $derived($page.url.searchParams.get("selected") ?? "");

	let productEvents = $derived(
		allEvents.filter((event) => extractScrutinyType(event) === "product"),
	);

	let selectedProductCount = $derived(selectedProductIds.size);
	let linkedEventCount = $derived(
		allEvents.filter((event) => extractScrutinyType(event) !== "product")
			.length,
	);

	function setsEqual(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false;
		for (const value of a) {
			if (!b.has(value)) return false;
		}
		return true;
	}

	function setProductSelected(eventId: string, checked: boolean): void {
		const next = new Set(selectedProductIds);
		if (checked) {
			next.add(eventId);
		} else {
			next.delete(eventId);
		}
		selectedProductIds = next;
	}

	let chatContextIds = $derived.by(() => {
		const contextIds = new Set<string>();

		for (const id of selectedProductIds) {
			contextIds.add(id);
		}

		for (const event of allEvents) {
			const type = extractScrutinyType(event);
			if (type !== "product") {
				contextIds.add(event.id as string);
			}
		}

		if (
			contextIds.size === 0 &&
			targetEvent &&
			extractScrutinyType(targetEvent) === "product"
		) {
			contextIds.add(targetEvent.id as string);
		}

		return [...contextIds];
	});

	// ── Parse helpers ─────────────────────────────────────────────
	function parseContent(event: NostrEvent): Record<string, unknown> {
		try {
			return JSON.parse(event.content);
		} catch {
			return {};
		}
	}

	function getEventTitle(event: NostrEvent): string {
		const type = extractScrutinyType(event);
		const parsed = parseContent(event);
		if (type === "product")
			return (
				(parsed.name as string) ||
				(parsed.product as string) ||
				sanitizeEventContent(event.content).slice(0, 50)
			);
		if (type === "metadata")
			return (
				(parsed.title as string) ||
				(parsed.summary as string) ||
				sanitizeEventContent(event.content).slice(0, 50)
			);
		if (type === "binding")
			return `Binding: ${relationshipLabel(getLabelValue(event, "scrutiny:binding:relationship") || "related")}`;
		if (type === "update") return "Update Event";
		if (type === "retract") return "Retraction Event";
		return sanitizeEventContent(event.content).slice(0, 50);
	}

	function getLabelValue(
		event: NostrEvent,
		namespace: string,
	): string | null {
		for (const tag of event.tags) {
			if (tag[0] === "l" && tag[2] === namespace) return tag[1];
		}
		return null;
	}

	function getLabels(event: NostrEvent): Record<string, string[]> {
		const labels: Record<string, string[]> = {};
		for (const tag of event.tags) {
			if (tag[0] === "l" && tag[2]) {
				if (!labels[tag[2]]) labels[tag[2]] = [];
				labels[tag[2]].push(tag[1]);
			}
		}
		return labels;
	}

	function getIdentifiers(
		event: NostrEvent,
	): { prefix: string; value: string }[] {
		return event.tags
			.filter((t) => t[0] === "i" && t[1])
			.map((t) => {
				const idx = t[1].indexOf(":");
				return idx > 0
					? { prefix: t[1].slice(0, idx), value: t[1].slice(idx + 1) }
					: { prefix: "id", value: t[1] };
			});
	}

	function getArtifacts(
		event: NostrEvent,
	): { url: string; mime: string; hash: string; size: string }[] {
		return event.tags
			.filter((t) => t[0] === "imeta")
			.map((t) => {
				const fields: Record<string, string> = {};
				for (let i = 1; i < t.length; i++) {
					const [k, ...rest] = t[i].split(" ");
					fields[k] = rest.join(" ");
				}
				return {
					url: fields.url || "",
					mime: fields.m || "",
					hash: fields.x || "",
					size: fields.size || "",
				};
			})
			.filter((a) => a.url);
	}

	function getBindingEndpoints(
		event: NostrEvent,
	): { anchor: string; other: string } | null {
		const endpoints = extractBindingEndpoints(event);
		if (!endpoints) return null;
		return {
			anchor: endpoints.anchorEventId as string,
			other: endpoints.otherEventId as string,
		};
	}

	function getEventIcon(type: string | null): string {
		if (type === "product") return "memory";
		if (type === "metadata") return "description";
		if (type === "binding") return "link";
		if (type === "update") return "edit_note";
		if (type === "retract") return "block";
		return "article";
	}

	function getTypeColor(type: string | null): string {
		if (type === "product") return "text-blue-500";
		if (type === "metadata") return "text-amber-500";
		if (type === "binding") return "text-green-500";
		if (type === "update") return "text-violet-500";
		if (type === "retract") return "text-red-500";
		return "text-muted-foreground";
	}

	// ── Graph builder ─────────────────────────────────────────────
	function buildGraphData(allEvts: NostrEvent[], bindings: NostrEvent[]) {
		const nodes: GraphNode[] = [];
		const nodeIds = new Set<string>();
		for (const evt of allEvts) {
			const type = extractScrutinyType(evt);
			// Do not add binding events as independent nodes
			if (!type || type === "binding" || nodeIds.has(evt.id as string))
				continue;
			nodeIds.add(evt.id as string);
			nodes.push({
				id: evt.id as string,
				label: sanitizeEventContent(evt.content).slice(0, 50),
				type,
			});
		}
		const edges: RelationshipEdge[] = buildRelationshipEdges(bindings);
		graphNodes = nodes;
		graphEdges = edges.map((e: RelationshipEdge) => ({
			from: e.from as string,
			to: e.to as string,
			relationship: e.relationship,
			directed: !e.symmetric,
			label: relationshipLabel(e.relationship),
		}));
	}

	// ── Data fetching ─────────────────────────────────────────────
	onMount(async () => {
		loading = true;
		try {
			let target = await getCachedEvent(eventId);
			if (!target) {
				const fetched = await fetchEventsByIds($enabledRelayUrls, [
					eventId,
				]);
				target = fetched[0] ?? null;
			}
			if (!target) {
				loading = false;
				return;
			}
			targetEvent = target;
			selectedEventId = target.id as string;
			addEvents([target]);

			const targetType = extractScrutinyType(target);
			let bindings: NostrEvent[] = [];

			if (targetType === "product") {
				bindings = await fetchProductBindings($enabledRelayUrls, eventId);
			} else if (targetType === "metadata") {
				bindings = await fetchMetadataBindings($enabledRelayUrls, eventId);
			}
			addEvents(bindings);

			const referencedIds = new Set<string>();
			for (const binding of bindings) {
				for (const id of extractBindingReferencedEventIds(binding)) {
					referencedIds.add(id);
				}
			}
			referencedIds.delete(eventId);

			const [referenced, targeting] = await Promise.all([
				fetchEventsByIds($enabledRelayUrls, [...referencedIds]),
				fetchEventsTargeting($enabledRelayUrls, [eventId]),
			]);
			addEvents(referenced);
			addEvents(targeting);

			effectiveView = computeEffectiveView({
				target,
				updates: targeting.filter(
					(e) => extractScrutinyType(e) === "update",
				),
				retractions: targeting.filter(
					(e) => extractScrutinyType(e) === "retract",
				),
				trustedPubkeys: $trustedPubkeys as unknown as ReadonlySet<
					import("@scrutiny-fabric/scrutiny-fabric").Pubkey
				>,
			});

			relatedEvents = [...bindings, ...referenced];

			const trustedAdmittedIds = getTrustedAdmissionSet([
				target,
				...relatedEvents,
			]);

			const visibleNow = $showUntrusted
				? relatedEvents
				: relatedEvents.filter(
						(event) =>
							$trustedPubkeys.has(event.pubkey as string) ||
							trustedAdmittedIds.has(event.id as string),
					);

			buildGraphData(
				[target, ...visibleNow],
				visibleNow.filter((event) => extractScrutinyType(event) === "binding"),
			);
			aiAvailable = await checkAiHealth();
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		if (!targetEvent) return;

		const allLoaded = [targetEvent, ...relatedEvents];
		const admittedIds = getTrustedAdmissionSet(allLoaded);
		const visibleNow = $showUntrusted
			? relatedEvents
			: relatedEvents.filter(
					(event) =>
						$trustedPubkeys.has(event.pubkey as string) ||
						admittedIds.has(event.id as string),
				);

		buildGraphData(
			[targetEvent, ...visibleNow],
			visibleNow.filter((event) => extractScrutinyType(event) === "binding"),
		);
	});

	// ── Chat logic ────────────────────────────────────────────────
	function startChat() {
		createSession(chatContextIds);
	}

	async function handleSend() {
		const trimmed = question.trim();
		if (!trimmed || sending) return;
		if (!$currentSession) startChat();

		const userMessage: ChatMessage = {
			role: "user",
			content: trimmed,
			timestamp: Date.now(),
		};
		addMessage(userMessage);
		question = "";
		sending = true;

		try {
			await new Promise((r) => setTimeout(r, 10));
			const contextEvents = chatContextIds
				.map((id) => {
					if (id === targetEvent?.id) return targetEvent;
					return relatedEvents.find((e) => e.id === id);
				})
				.filter((e): e is NostrEvent => !!e);

			const request: ChatRequest = {
				question: trimmed,
				contextEvents: JSON.stringify(contextEvents),
				history: JSON.stringify(
					($currentSession?.messages || [])
						.filter((m) => m.role !== "assistant" || !m.citations)
						.map((m) => ({ role: m.role, content: m.content })),
				),
			};
			const response = await sendChatMessage(request);
			addMessage({
				role: "assistant",
				content: response.answer,
				citations: response.citations,
				timestamp: Date.now(),
			});
		} catch (err) {
			addMessage({
				role: "assistant",
				content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
				timestamp: Date.now(),
			});
		} finally {
			sending = false;
		}
	}

	function handleSuggestion(text: string) {
		question = text;
		handleSend();
	}

	$effect(() => {
		const availableIds = new Set(
			productEvents.map((event) => event.id as string),
		);

		if (availableIds.size === 0) {
			if (selectedProductIds.size > 0) {
				selectedProductIds = new Set();
			}
			return;
		}

		const fromUrl = selectedParam
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0 && availableIds.has(id));

		const next =
			fromUrl.length > 0 ? new Set(fromUrl) : new Set(availableIds);

		if (!setsEqual(selectedProductIds, next)) {
			selectedProductIds = next;
		}
	});
</script>

<svelte:head>
	<title>Event {truncateHex(eventId)} | SCRUTINY Lens</title>
</svelte:head>

{#if loading}
	<div class="flex flex-col items-center gap-3 py-16">
		<Spinner class="text-primary" />
		<span class="text-sm font-mono text-muted-foreground"
			>Loading event data from relays…</span
		>
	</div>
{:else if !targetEvent}
	<div class="text-center py-16">
		<p class="text-sm text-muted-foreground">Event not found</p>
		<p class="font-mono text-xs text-muted-foreground/60 mt-1">
			{truncateHex(eventId)}
		</p>
	</div>
{:else}
	<!-- Compact header: status badges + actions -->
	<div
		class="py-3 flex justify-between items-center gap-3 border-b border-border mb-4"
	>
		<div class="flex items-center gap-2">
			<Badge variant="secondary" class="font-mono text-[10px] uppercase">
				{eventTypeLabel(extractScrutinyType(targetEvent) ?? "unknown")}
			</Badge>
			{#if effectiveView?.retracted}
				<Badge variant="destructive" class="text-[10px]"
					>Retracted</Badge
				>
			{:else}
				<Badge
					class="bg-green-500/15 text-green-700 border-green-500/30 text-[10px]"
					>Active</Badge
				>
			{/if}
			<span class="text-xs text-muted-foreground font-mono"
				>{truncateHex(eventId)}</span
			>
			<CopyButton text={eventId} variant="ghost" size="icon-sm" />
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs">
				<FilterIcon class="h-3 w-3" />
				Filter
			</Button>
			<Button variant="default" size="sm" class="h-7 gap-1.5 text-xs">
				<ShareIcon class="h-3 w-3" />
				Export
			</Button>
		</div>
	</div>

	<!-- 3-Panel Layout -->
	<div class="flex flex-col xl:flex-row gap-4 h-[calc(100vh-10rem)]">
		<!-- ═══ LEFT PANEL: Selected Event Detail Card ═══ -->
		<section
			class="xl:w-[25%] flex flex-col min-h-0 border border-border rounded-lg overflow-hidden bg-background shadow-sm"
		>
			{#if selectedEvent}
				{@const selType = selectedType}
				{@const selLabels = getLabels(selectedEvent)}
				{@const selIds = getIdentifiers(selectedEvent)}
				{@const selArtifacts = getArtifacts(selectedEvent)}
				{@const isTarget = selectedEvent.id === targetEvent.id}

				<!-- Card header -->
				<div
					class="px-4 py-3 border-b border-border bg-muted/30 flex items-start justify-between gap-2"
				>
					<div class="flex items-center gap-2 min-w-0">
						<span
							class="material-symbols-outlined {getTypeColor(
								selType,
							)} text-lg shrink-0">{getEventIcon(selType)}</span
						>
						<div class="min-w-0">
							<h3
								class="text-sm font-semibold text-foreground truncate"
							>
								{getEventTitle(selectedEvent)}
							</h3>
							<span
								class="text-[10px] text-muted-foreground font-mono"
								>{eventTypeLabel(selType ?? "unknown")}</span
							>
						</div>
					</div>
					<div class="flex items-center gap-1.5 shrink-0">
						{#if isTarget}
							<Badge
								variant="outline"
								class="text-[9px] px-1.5 h-4">ROOT</Badge
							>
						{/if}
					</div>
				</div>

				<!-- Card body -->
				<div
					class="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4"
				>
					<!-- Content / Description -->
					<div>
						<h4
							class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
						>
							Content
						</h4>
						<p class="text-xs text-foreground leading-relaxed">
							{sanitizeEventContent(selectedEvent.content).slice(
								0,
								400,
							)}
						</p>
					</div>

					<!-- Meta details -->
					<div>
						<h4
							class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
						>
							Details
						</h4>
						<dl class="space-y-2 text-xs">
							<div
								class="flex justify-between border-b border-dashed border-border pb-1.5"
							>
								<dt class="text-muted-foreground">ID</dt>
								<dd
									class="font-mono text-[10px] text-foreground flex items-center gap-1"
								>
									{truncateHex(selectedEvent.id as string)}
									<CopyButton
										text={selectedEvent.id as string}
										variant="ghost"
										size="icon-sm"
									/>
								</dd>
							</div>
							<div
								class="flex justify-between border-b border-dashed border-border pb-1.5"
							>
								<dt class="text-muted-foreground">Author</dt>
								<dd
									class="font-mono text-[10px] text-foreground flex items-center gap-1"
								>
									{truncateHex(
										selectedEvent.pubkey as string,
									)}
									<CopyButton
										text={selectedEvent.pubkey as string}
										variant="ghost"
										size="icon-sm"
									/>
								</dd>
							</div>
							<div
								class="flex justify-between border-b border-dashed border-border pb-1.5"
							>
								<dt class="text-muted-foreground">Created</dt>
								<dd class="text-foreground">
									{formatRelativeTime(
										selectedEvent.created_at,
									)}
								</dd>
							</div>
							<div class="flex justify-between pb-1.5">
								<dt class="text-muted-foreground">Kind</dt>
								<dd class="text-foreground">
									{selectedEvent.kind}
								</dd>
							</div>
						</dl>
					</div>

					<!-- Binding-specific: endpoints -->
					{#if selType === "binding"}
						{@const endpoints = getBindingEndpoints(selectedEvent)}
						{#if endpoints}
							<div>
								<h4
									class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
								>
									Endpoints
								</h4>
								<div class="space-y-2">
									<button
										onclick={() =>
											selectEvent(endpoints.anchor)}
										class="w-full text-left bg-muted/30 hover:bg-muted/60 transition-colors p-2.5 rounded border border-border text-xs"
									>
										<span
											class="text-[9px] font-bold text-muted-foreground uppercase"
											>Anchor (e root)</span
										>
										<span
											class="font-mono text-foreground block mt-0.5"
											>{truncateHex(
												endpoints.anchor,
											)}</span
										>
									</button>
									<div
										class="flex justify-center text-muted-foreground"
									>
										<span
											class="material-symbols-outlined text-sm"
											>arrow_downward</span
										>
									</div>
									<button
										onclick={() =>
											selectEvent(endpoints.other)}
										class="w-full text-left bg-muted/30 hover:bg-muted/60 transition-colors p-2.5 rounded border border-border text-xs"
									>
										<span
											class="text-[9px] font-bold text-muted-foreground uppercase"
											>Other (q)</span
										>
										<span
											class="font-mono text-foreground block mt-0.5"
											>{truncateHex(
												endpoints.other,
											)}</span
										>
									</button>
								</div>
							</div>
						{/if}
					{/if}

					<!-- Identifiers (Product/Metadata) -->
					{#if selIds.length > 0}
						<div>
							<h4
								class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
							>
								Identifiers
							</h4>
							<div class="space-y-1.5">
								{#each selIds as id}
									<div
										class="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border"
									>
										<span
											class="text-[9px] font-bold text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded shrink-0"
											>{id.prefix}</span
										>
										<span
											class="text-xs font-mono text-foreground truncate"
											title={id.value}>{id.value}</span
										>
										<CopyButton
											text="{id.prefix}:{id.value}"
											variant="ghost"
											size="icon-sm"
											class="shrink-0 ml-auto"
										/>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Labels -->
					{#if Object.keys(selLabels).length > 0}
						<div>
							<h4
								class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
							>
								Labels
							</h4>
							{#each Object.entries(selLabels) as [ns, values]}
								<div class="mb-2">
									<span
										class="text-[9px] font-mono text-muted-foreground block mb-1"
										>{ns}</span
									>
									<div class="flex flex-wrap gap-1">
										{#each values as val}
											<Badge
												variant="outline"
												class="text-[10px] font-mono"
												>{val}</Badge
											>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Artifacts (Metadata) -->
					{#if selArtifacts.length > 0}
						<div>
							<h4
								class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
							>
								Artifacts
							</h4>
							<div class="space-y-1.5">
								{#each selArtifacts as artifact}
									<a
										href={artifact.url}
										target="_blank"
										rel="noopener noreferrer"
										class="block bg-muted/30 hover:bg-muted/60 transition-colors p-2.5 rounded border border-border text-xs"
									>
										<div class="flex items-center gap-2">
											<span
												class="material-symbols-outlined text-sm text-muted-foreground"
												>attach_file</span
											>
											<div class="min-w-0 flex-1">
												<span
													class="text-foreground font-medium block truncate"
													>{artifact.url
														.split("/")
														.pop()}</span
												>
												<span
													class="text-[10px] text-muted-foreground"
													>{artifact.mime}{artifact.size
														? ` · ${artifact.size} bytes`
														: ""}</span
												>
											</div>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Effective view info (only for target) -->
					{#if isTarget && effectiveView}
						{#if effectiveView.appliedUpdateIds.length > 0}
							<div class="border-t border-border pt-3">
								<h4
									class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2"
								>
									Updates Applied
								</h4>
								<p class="text-xs text-muted-foreground">
									<span class="text-foreground font-medium"
										>{effectiveView.appliedUpdateIds
											.length}</span
									> verified update(s) reconciled.
								</p>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</section>

		<!-- ═══ CENTER PANEL: AI Chat ═══ -->
		<section
			class="xl:w-[45%] flex flex-col min-h-0 border border-border rounded-lg shadow-sm bg-background relative"
		>
			<!-- Chat header -->
			<div
				class="px-4 py-3 border-b border-border flex justify-between items-center rounded-t-lg bg-muted/20"
			>
				<div class="flex items-center gap-2.5">
					<div
						class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary"
					>
						<span class="material-symbols-outlined text-base"
							>smart_toy</span
						>
					</div>
					<div>
						<h3 class="font-semibold text-sm text-foreground">
							Research Assistant
						</h3>
						<p class="text-[10px] text-muted-foreground">
							{#if !aiAvailable}
								<span class="text-destructive"
									>AI Service Offline</span
								>
							{:else}
								Selected products: {selectedProductCount} / {productEvents.length}
								· context events: {chatContextIds.length}
							{/if}
						</p>
					</div>
				</div>
				{#if $currentSession}
					<button
						onclick={() => {
							clearSession();
							startChat();
						}}
						class="text-[10px] text-muted-foreground hover:text-foreground transition-colors font-medium uppercase tracking-wider"
					>
						Reset
					</button>
				{/if}
			</div>

			{#if productEvents.length > 0}
				<div class="px-4 py-2 border-b border-border bg-muted/10">
					<p
						class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1"
					>
						Products for chat context
					</p>
					<p class="text-[11px] text-muted-foreground mb-2">
						Choose one or more products. The assistant compares
						selected products using the linked metadata and
						bindings.
					</p>
					<div class="max-h-24 overflow-y-auto space-y-1 pr-1">
						{#each productEvents as productEvent}
							<label
								class="flex items-center gap-2 text-xs text-foreground cursor-pointer"
							>
								<Checkbox
									checked={selectedProductIds.has(
										productEvent.id as string,
									)}
									onCheckedChange={(checked) =>
										setProductSelected(
											productEvent.id as string,
											checked === true,
										)}
									aria-label="Include product in AI context"
								/>
								<span
									class="truncate"
									title={getEventTitle(productEvent)}
								>
									{getEventTitle(productEvent)}
								</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Chat messages -->
			<div
				class="flex-1 overflow-y-auto p-4 bg-muted/5 flex flex-col gap-4 scrollbar-hide"
			>
				{#if !$currentSession && !sending}
					<div
						class="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-4"
					>
						<div
							class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
						>
							<span
								class="material-symbols-outlined text-primary text-xl"
								>smart_toy</span
							>
						</div>
						<h3 class="font-medium text-foreground text-sm">
							Ask about this event
						</h3>
						<p
							class="text-xs text-muted-foreground max-w-xs leading-relaxed"
						>
							Summarize findings, check vulnerabilities, or verify
							signatures across the loaded context.
						</p>
					</div>
				{:else}
					{#each $currentSession?.messages || [] as message}
						{#if message.role === "assistant"}
							<div class="flex flex-col gap-1.5 max-w-[85%]">
								<div class="flex items-center gap-1.5">
									<div
										class="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
									>
										<span
											class="material-symbols-outlined text-[12px]"
											>smart_toy</span
										>
									</div>
									<span
										class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
										>AI</span
									>
								</div>
								<div
									class="bg-background border border-border rounded-lg rounded-tl-sm p-3 shadow-sm"
								>
									<div
										class="text-sm text-foreground leading-relaxed prose-sm"
									>
										<Markdown content={message.content} />
									</div>
									{#if message.citations && message.citations.length > 0}
										<div
											class="mt-2 border-t border-border/50 pt-2 space-y-1"
										>
											<span
												class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
												>Claims</span
											>
											{#each message.citations as citation}
												<button
													onclick={() =>
														selectEvent(
															citation.eventId,
														)}
													class="block w-full text-left bg-muted/30 hover:bg-muted/60 transition-colors p-2 rounded border border-border/50 text-[10px] font-mono"
												>
													<span
														class="text-foreground font-medium not-italic"
														>{citation.claim}</span
													>
													<span
														class="text-muted-foreground italic block mt-0.5"
														>[{truncateHex(
															citation.eventId,
														)}]</span
													>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{:else}
							<div
								class="flex flex-col gap-1.5 max-w-[85%] self-end items-end"
							>
								<span
									class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
									>You</span
								>
								<div
									class="bg-primary text-primary-foreground rounded-lg rounded-tr-sm p-3 shadow-sm"
								>
									<p class="text-sm leading-relaxed">
										{message.content}
									</p>
								</div>
							</div>
						{/if}
					{/each}
					{#if sending}
						<div class="flex flex-col gap-1.5 max-w-[85%]">
							<div class="flex items-center gap-1.5">
								<div
									class="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
								>
									<span
										class="material-symbols-outlined text-[12px]"
										>smart_toy</span
									>
								</div>
								<span
									class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
									>AI</span
								>
							</div>
							<div
								class="bg-background border border-border rounded-lg rounded-tl-sm p-3 shadow-sm"
							>
								<Loader variant="dots" size="sm" />
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Chat input -->
			<div class="p-3 bg-background border-t border-border rounded-b-lg">
				<div class="relative flex items-center">
					<input
						type="text"
						bind:value={question}
						placeholder="Ask about vulnerabilities, certifications…"
						class="w-full pl-3 pr-10 py-2.5 bg-muted/20 border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
						disabled={sending || !aiAvailable}
						onkeydown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSend();
							}
						}}
					/>
					<button
						onclick={handleSend}
						disabled={sending || !aiAvailable || !question.trim()}
						class="absolute right-1.5 w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-colors disabled:opacity-40"
					>
						<span class="material-symbols-outlined text-[16px]"
							>arrow_upward</span
						>
					</button>
				</div>
				<div class="flex gap-3 mt-2 px-0.5">
					<button
						onclick={() => handleSuggestion("Summarize key risks")}
						class="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
					>
						Summarize risks →
					</button>
					<button
						onclick={() =>
							handleSuggestion("Find similar products")}
						class="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
					>
						Find similar →
					</button>
				</div>
			</div>
		</section>

		<!-- ═══ RIGHT PANEL: Graph + Event List ═══ -->
		<section class="xl:w-[30%] flex flex-col gap-4 min-h-0">
			<!-- Relationship Map -->
			<div
				class="border border-border rounded-lg overflow-hidden flex flex-col h-[40%] min-h-[200px] bg-background shadow-sm"
			>
				<div
					class="px-3 py-2.5 border-b border-border flex justify-between items-center bg-muted/20"
				>
					<div>
						<h3
							class="font-semibold text-[10px] tracking-wider text-muted-foreground uppercase"
						>
							Relationship Map
						</h3>
						<p class="text-[10px] text-muted-foreground/80">
							Nodes are events (products, metadata, bindings);
							bright ring = selected for chat.
						</p>
					</div>
					<span class="text-[10px] text-muted-foreground font-mono"
						>{graphNodes.length} nodes</span
					>
				</div>
				<div class="flex-1 relative overflow-hidden">
					{#if graphNodes.length > 0}
						<GraphView
							nodes={graphNodes}
							edges={graphEdges}
							highlightId={selectedEventId}
							contextSelectedIds={selectedProductIds}
							onNodeSelect={selectEvent}
						/>
					{:else}
						<div class="flex items-center justify-center h-full">
							<p class="text-xs text-muted-foreground">
								No relationships found
							</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Connected Events List -->
			<div
				class="border border-border rounded-lg overflow-hidden flex-1 flex flex-col bg-background shadow-sm"
			>
				<div
					class="px-3 py-2.5 border-b border-border bg-muted/20 flex justify-between items-center"
				>
					<h3
						class="font-semibold text-[10px] tracking-wider text-muted-foreground uppercase"
					>
						Context Events (all)
					</h3>
					<span class="text-[10px] text-muted-foreground font-mono"
						>{allEvents.length}</span
					>
				</div>
				<div class="flex-1 overflow-y-auto scrollbar-hide">
					{#each allEvents as event}
						{@const evtType = extractScrutinyType(event)}
						{@const isSelected = event.id === selectedEventId}
						{@const isProduct = evtType === "product"}
						<div
							role="button"
							tabindex="0"
							onclick={() => selectEvent(event.id as string)}
							onkeydown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									selectEvent(event.id as string);
								}
							}}
							class="w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex items-start gap-2.5
								{isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'}"
						>
							{#if isProduct}
								<button
									type="button"
									class="inline-flex"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
									}}
								>
									<Checkbox
										checked={selectedProductIds.has(
											event.id as string,
										)}
										onCheckedChange={(checked) =>
											setProductSelected(
												event.id as string,
												checked === true,
											)}
										aria-label="Toggle product in AI context"
									/>
								</button>
							{/if}
							<span
								class="material-symbols-outlined {getTypeColor(
									evtType,
								)} text-base mt-0.5 shrink-0"
								title={evtType === "metadata"
									? "Document icon: metadata event"
									: evtType === "retract"
										? "Warning: retraction event"
										: evtType === "update"
											? "Update event"
											: `${eventTypeLabel(evtType ?? "unknown")} event`}
								>{getEventIcon(evtType)}</span
							>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-1.5 mb-0.5">
									<span
										class="text-xs font-medium text-foreground truncate"
										>{getEventTitle(event)}</span
									>
									{#if event.id === targetEvent.id}
										<Badge
											variant="outline"
											class="text-[8px] px-1 h-3.5 shrink-0"
											>ROOT</Badge
										>
									{/if}
								</div>
								<p
									class="text-[10px] text-muted-foreground line-clamp-1"
								>
									{sanitizeEventContent(event.content).slice(
										0,
										80,
									)}
								</p>
								<div
									class="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/60 font-mono"
								>
									<span
										>{truncateHex(event.id as string)}</span
									>
									<span>·</span>
									<span
										>{formatRelativeTime(
											event.created_at,
										)}</span
									>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>
	</div>
{/if}
