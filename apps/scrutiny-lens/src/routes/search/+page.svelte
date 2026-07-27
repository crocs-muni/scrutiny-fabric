<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { enabledRelayUrls } from "$lib/stores/relayStore.js";
	import { addEvents, eventList } from "$lib/stores/eventStore.js";
	import { trustedPubkeys, showUntrusted } from "$lib/stores/trustStore.js";
	import {
		fetchScrutinyEvents,
		fetchEventsByIds,
		fetchProductBindings,
		getAllCachedEvents,
	} from "$lib/nostr/subscriptions.js";
	import {
		extractScrutinyType,
		type ScrutinyType,
		type NostrEvent,
	} from "@scrutiny-fabric/scrutiny-fabric";
	import { extractBindingReferencedEventIds } from "$lib/utils/binding-tags.js";
	import {
		truncateHex,
		formatRelativeTime,
		eventTypeLabel,
	} from "$lib/utils/formatters.js";
	import { sanitizeEventContent } from "$lib/security/sanitize.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Checkbox } from "$lib/components/ui/checkbox/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Spinner } from "$lib/components/ui/spinner/index.js";
	import EventTypeBadge from "$lib/components/EventTypeBadge.svelte";
	import SearchIcon from "@lucide/svelte/icons/search";

	let query = $derived($page.url.searchParams.get("q") ?? "");
	let localQuery = $state("");
	let loading = $state(false);
	let refreshing = $state(false);
	let searchResults = $state<NostrEvent[]>([]);
	let relatedMetadataResults = $state<NostrEvent[]>([]);
	let selectedProductIds = $state<Set<string>>(new Set());
	let activeSearchToken = 0;

	type SearchIntent = "id" | "cve" | "name";

	function inferSearchIntent(raw: string): SearchIntent {
		const q = raw.trim().toLowerCase();
		if (/^[0-9a-f]{64}$/i.test(q)) return "id";
		if (q.includes("cve-") || q.includes("cve:")) return "cve";
		return "name";
	}

	function normalizeText(input: string): string {
		return input.toLowerCase().replace(/[\s\-_]+/g, "").trim();
	}

	function tokenize(input: string): string[] {
		return input
			.toLowerCase()
			.split(/[\s\-_]+/)
			.map((t) => t.trim())
			.filter(Boolean);
	}

	function isSearchableEvent(event: NostrEvent, intent: SearchIntent): boolean {
		const type = extractScrutinyType(event);

		if (intent === "id") return !!type;
		if (type === "binding" || type === "update" || type === "retract") return false;
		if (intent === "cve") return type === "metadata";
		return type === "product";
	}

	function matchesQuery(event: NostrEvent, lowerQuery: string, intent: SearchIntent): boolean {
		if (!isSearchableEvent(event, intent)) return false;

		const raw = event.content.toLowerCase();
		const normalizedQuery = normalizeText(lowerQuery);
		const normalizedContent = normalizeText(event.content);

		if (raw.includes(lowerQuery)) return true;
		if (normalizedQuery && normalizedContent.includes(normalizedQuery)) return true;

		const queryTokens = tokenize(lowerQuery);
		if (queryTokens.length > 1 && queryTokens.every((token) => raw.includes(token))) {
			return true;
		}

		const tagHit = event.tags.some((tag) =>
			tag.some((value) => {
				const lowered = value.toLowerCase();
				if (lowered.includes(lowerQuery)) return true;
				return normalizedQuery && normalizeText(value).includes(normalizedQuery);
			}),
		);

		if (tagHit) return true;

		if (queryTokens.length > 1) {
			return queryTokens.every((token) =>
				event.tags.some((tag) =>
					tag.some((value) => value.toLowerCase().includes(token)),
				),
			);
		}

		return false;
	}

	function sortEventsForDisplay(events: NostrEvent[]): NostrEvent[] {
		return [...events].sort((a, b) => b.created_at - a.created_at);
	}

	function isProductEvent(event: NostrEvent): boolean {
		return extractScrutinyType(event) === "product";
	}

	function setProductSelected(eventId: string, selected: boolean): void {
		const next = new Set(selectedProductIds);
		if (selected) {
			next.add(eventId);
		} else {
			next.delete(eventId);
		}
		selectedProductIds = next;
	}

	function openSelectedProducts(): void {
		const selected = [...selectedProductIds];
		if (selected.length === 0) return;

		const [primary, ...rest] = selected;
		const selectedParam = [primary, ...rest].join(",");
		goto(`/event/${primary}?selected=${encodeURIComponent(selectedParam)}`);
	}

	let trustedBindingAdmissions = $derived.by(() => {
		const admitted = new Set<string>();

		for (const event of $eventList) {
			if (extractScrutinyType(event) !== "binding") continue;
			if (!$trustedPubkeys.has(event.pubkey as string)) continue;

			for (const id of extractBindingReferencedEventIds(event)) {
				admitted.add(id);
			}
		}

		return admitted;
	});

	let filteredResults = $derived(
		$showUntrusted
			? searchResults
			: searchResults.filter((e) =>
					$trustedPubkeys.has(e.pubkey as string) ||
					trustedBindingAdmissions.has(e.id as string),
				),
	);

	let filteredRelatedMetadata = $derived(
		$showUntrusted
			? relatedMetadataResults
			: relatedMetadataResults.filter((e) =>
					$trustedPubkeys.has(e.pubkey as string) ||
					trustedBindingAdmissions.has(e.id as string),
				),
	);

	let filteredProducts = $derived(
		filteredResults.filter((event) => isProductEvent(event)),
	);

	let eventStatsMap = $derived.by(() => {
		const stats = new Map<string, { updates: number; bindings: number; total: number }>();

		const ensure = (id: string) => {
			if (!stats.has(id)) {
				stats.set(id, { updates: 0, bindings: 0, total: 0 });
			}
			return stats.get(id)!;
		};

		for (const event of $eventList) {
			const type = extractScrutinyType(event);

			if (type === "binding") {
				for (const tag of event.tags) {
					if (tag[0] !== "e" || !tag[1]) continue;
					const current = ensure(tag[1]);
					current.bindings += 1;
					current.total += 1;
				}
				continue;
			}

			if (type === "update") {
				const targetedIds = new Set<string>();

				for (const tag of event.tags) {
					if (tag[0] === "e" && tag[1]) {
						targetedIds.add(tag[1]);
						continue;
					}

					if (tag[0] === "a" && tag[1]) {
						const match = tag[1].match(/[0-9a-f]{64}/i);
						if (match) targetedIds.add(match[0].toLowerCase());
					}
				}

				for (const id of targetedIds) {
					const current = ensure(id);
					current.updates += 1;
					current.total += 1;
				}
			}
		}

		return stats;
	});

	function onSearch(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = localQuery.trim();
		if (!trimmed) return;
		goto(`/search?q=${encodeURIComponent(trimmed)}`);
	}

	function mergeResults(
		bucket: Map<string, NostrEvent>,
		events: NostrEvent[],
		lowerQuery: string,
		intent: SearchIntent,
	): boolean {
		let changed = false;

		for (const event of events) {
			if (!matchesQuery(event, lowerQuery, intent)) continue;

			const id = event.id as string;
			if (!bucket.has(id)) {
				bucket.set(id, event);
				changed = true;
			}
		}

		return changed;
	}

	async function runSearch(currentQuery: string, token: number): Promise<void> {
		if (!currentQuery) {
			searchResults = [];
			relatedMetadataResults = [];
			loading = false;
			refreshing = false;
			return;
		}

		localQuery = currentQuery;
		selectedProductIds = new Set();
		loading = true;
		refreshing = false;

		const normalized = currentQuery.trim();
		const lowerQuery = normalized.toLowerCase();
		const intent = inferSearchIntent(normalized);
		const resultBucket = new Map<string, NostrEvent>();
		const relatedMetadataBucket = new Map<string, NostrEvent>();

		const applyResults = () => {
			if (token !== activeSearchToken) return;
			searchResults = sortEventsForDisplay([...resultBucket.values()]);
			relatedMetadataResults = sortEventsForDisplay([
				...relatedMetadataBucket.values(),
			]);
		};

		const safeAddToStore = (events: NostrEvent[]) => {
			if (events.length === 0) return;
			addEvents(events);
		};

		try {
			if (intent === "id") {
				const events = await fetchEventsByIds($enabledRelayUrls, [normalized], 3000);
				if (token !== activeSearchToken) return;

				safeAddToStore(events);
				mergeResults(resultBucket, events, lowerQuery, intent);
				applyResults();
				return;
			}

			const allCached = await getAllCachedEvents();
			if (token !== activeSearchToken) return;

			safeAddToStore(allCached);
			if (mergeResults(resultBucket, allCached, lowerQuery, intent)) {
				applyResults();
			}

			// Initial paint complete: keep refreshing from relays in background.
			loading = false;
			refreshing = true;

			const relayTypes: ScrutinyType[] =
				intent === "cve" ? ["metadata"] : ["product"];

			let relayEventCounter = 0;
			const relayResults = await fetchScrutinyEvents(
				$enabledRelayUrls,
				relayTypes,
				{
					timeoutMs: 4000,
					onEvent: (event) => {
						if (token !== activeSearchToken) return;

						relayEventCounter += 1;
						safeAddToStore([event]);

						if (mergeResults(resultBucket, [event], lowerQuery, intent) && relayEventCounter % 5 === 0) {
							applyResults();
						}
					},
				},
			);

			if (token !== activeSearchToken) return;

			safeAddToStore(relayResults);
			if (mergeResults(resultBucket, relayResults, lowerQuery, intent)) {
				applyResults();
			}

			if (intent === "name") {
				const productIds = [...resultBucket.values()]
					.filter((event) => extractScrutinyType(event) === "product")
					.slice(0, 8)
					.map((event) => event.id as string);

				if (productIds.length > 0) {
					const bindingSettled = await Promise.allSettled(
						productIds.map((id) =>
							fetchProductBindings($enabledRelayUrls, id, 2500),
						),
					);

					if (token !== activeSearchToken) return;

					const allBindings = bindingSettled
						.filter(
							(result): result is PromiseFulfilledResult<NostrEvent[]> =>
								result.status === "fulfilled",
						)
						.flatMap((result) => result.value);

					safeAddToStore(allBindings);

					const metadataIds = new Set<string>();
					const productIdSet = new Set(productIds);
					for (const binding of allBindings) {
						const referencedIds = extractBindingReferencedEventIds(binding);
						const touchesSelectedProduct = referencedIds.some((id) =>
							productIdSet.has(id),
						);
						if (!touchesSelectedProduct) continue;

						for (const id of referencedIds) {
							if (!productIdSet.has(id)) metadataIds.add(id);
						}
					}

					if (metadataIds.size > 0) {
						const relatedMetadata = await fetchEventsByIds(
							$enabledRelayUrls,
							[...metadataIds],
							2500,
						);

						if (token !== activeSearchToken) return;

						safeAddToStore(relatedMetadata);
						for (const event of relatedMetadata) {
							if (extractScrutinyType(event) !== "metadata") continue;
							relatedMetadataBucket.set(event.id as string, event);
						}
						applyResults();
					}
				}
			}

		} finally {
			if (token === activeSearchToken) {
				loading = false;
				refreshing = false;
			}
		}
	}

	// Reactive search when query changes
	$effect(() => {
		const currentQuery = query;
		const token = ++activeSearchToken;

		void runSearch(currentQuery, token);
	});

	function getEventStats(eventId: string) {
		return eventStatsMap.get(eventId) ?? { updates: 0, bindings: 0, total: 0 };
	}

	$effect(() => {
		const visibleProductIds = new Set(
			filteredProducts.map((event) => event.id as string),
		);
		const next = new Set(
			[...selectedProductIds].filter((id) => visibleProductIds.has(id)),
		);

		if (next.size !== selectedProductIds.size) {
			selectedProductIds = next;
		}
	});
</script>

<svelte:head>
	<title>Search{query ? ` — ${query}` : ""} | SCRUTINY Lens</title>
</svelte:head>

<div>
	<!-- Search bar -->
	<form onsubmit={onSearch} class="mb-8">
		<div
			class="dither-sm relative flex items-center border border-border rounded-md bg-background overflow-hidden transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
		>
			<SearchIcon
				class="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
			/>
			<Input
				type="text"
				placeholder="Search by product name, CPE, PURL, CVE, or event ID…"
				bind:value={localQuery}
				class="flex-1 border-0 bg-transparent pl-10 font-mono shadow-none focus-visible:ring-0"
			/>
			<Button
				type="submit"
				variant="default"
				size="sm"
				class="m-1.5 shrink-0"
			>
				Search
			</Button>
		</div>
	</form>

	<!-- Results header -->
	{#if query}
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold tracking-tight">
				Results for <span class="font-mono text-primary">"{query}"</span
				>
			</h2>
			{#if !loading || filteredResults.length > 0 || filteredRelatedMetadata.length > 0}
				<span class="text-xs text-muted-foreground font-mono">
					{filteredResults.length + filteredRelatedMetadata.length} result{filteredResults.length + filteredRelatedMetadata.length !== 1
						? "s"
						: ""}
				</span>
			{/if}
		</div>
	{/if}

	{#if refreshing}
		<p class="text-xs text-muted-foreground/70 mb-4 font-mono flex items-center gap-2">
			<Spinner class="size-3 text-muted-foreground" />
			Updating from relays…
		</p>
	{/if}

	{#if filteredProducts.length > 0}
		<div class="mb-4 rounded-md border border-border bg-muted/20 p-3 flex items-center justify-between gap-3">
			<div>
				<p class="text-sm font-medium text-foreground">
					Select one or more products
				</p>
				<p class="text-xs text-muted-foreground">
					Use the checkboxes on product cards to build a multi-product chat context.
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={openSelectedProducts}
				disabled={selectedProductIds.size === 0}
			>
				Open selected ({selectedProductIds.size})
			</Button>
		</div>
	{/if}

	{#if !loading && searchResults.length > 0 && filteredResults.length < searchResults.length}
		<p class="text-xs text-muted-foreground/70 mb-4 font-mono">
			{searchResults.length - filteredResults.length} result{searchResults.length -
				filteredResults.length !==
			1
				? "s"
				: ""} hidden by trust filter —
			<button
				class="text-primary hover:underline"
				onclick={() => ($showUntrusted = true)}>show all</button
			>
		</p>
	{/if}

	<!-- Loading skeleton -->
	{#if loading && filteredResults.length === 0 && filteredRelatedMetadata.length === 0}
		<div class="flex flex-col items-center gap-4 py-12">
			<Spinner class="text-primary" />
			<span class="text-sm font-mono text-muted-foreground"
				>Searching relays and local cache…</span
			>
		</div>

		<!-- Empty state -->
	{:else if query && filteredResults.length === 0 && filteredRelatedMetadata.length === 0}
		<div class="text-center py-16">
			<p class="text-muted-foreground text-sm">No results found.</p>
			<p class="text-xs text-muted-foreground/60 mt-1">
				Try a different query or check your relay configuration.
			</p>
		</div>

		<!-- Results grid -->
	{:else if filteredResults.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filteredResults as event}
				{@const stats = getEventStats(event.id as string)}
				{@const isProduct = isProductEvent(event)}
				<a href="/event/{event.id}" class="group block h-full">
					<Card.Root
						class="transition-all hover:border-primary/50 hover:shadow-md h-full flex flex-col bg-card"
					>
						<Card.Header
							class="pb-3 border-b border-border/50 bg-muted/20"
						>
							<div class="flex items-start justify-between gap-2">
								<EventTypeBadge
									type={extractScrutinyType(event) ??
										"unknown"}
								/>
								<div class="flex items-center gap-2">
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
												checked={selectedProductIds.has(event.id as string)}
												onCheckedChange={(checked) =>
													setProductSelected(
														event.id as string,
														checked === true,
													)}
												aria-label="Select product for multi-product context"
											/>
										</button>
									{/if}
									<div
										class="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity"
									>
										<span
											class="text-[0.6875rem] text-muted-foreground font-mono"
										>
											{truncateHex(event.id as string)}
										</span>
									</div>
								</div>
							</div>
						</Card.Header>
						<Card.Content class="py-4 flex-1">
							<p
								class="text-sm text-foreground leading-relaxed line-clamp-3"
							>
								{sanitizeEventContent(event.content).slice(
									0,
									180,
								)}
							</p>
						</Card.Content>
						<Card.Footer
							class="text-[0.6875rem] text-muted-foreground font-mono border-t border-border/50 bg-muted/10 pt-3 flex items-center justify-between"
						>
							<div class="flex items-center gap-1.5">
								<span
									>{truncateHex(event.pubkey as string)}</span
								>
								<span class="text-border">·</span>
								<span
									>{formatRelativeTime(
										event.created_at,
									)}</span
								>
							</div>
							{#if stats.total > 0}
								<div
									class="flex items-center gap-2 font-medium text-foreground/80"
								>
									{#if stats.bindings > 0}
										<span
											title="{stats.bindings} Bindings"
											class="flex items-center gap-1"
											>🔗 {stats.bindings}</span
										>
									{/if}
									{#if stats.updates > 0}
										<span
											title="{stats.updates} Updates"
											class="flex items-center gap-1"
											>🔄 {stats.updates}</span
										>
									{/if}
								</div>
							{/if}
						</Card.Footer>
					</Card.Root>
				</a>
			{/each}
		</div>

		{#if filteredRelatedMetadata.length > 0}
			<div class="mt-8">
				<h3 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
					Related metadata
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each filteredRelatedMetadata as event}
						<a href="/event/{event.id}" class="group block h-full">
							<Card.Root
								class="transition-all hover:border-primary/50 hover:shadow-md h-full flex flex-col bg-card"
							>
								<Card.Header
									class="pb-3 border-b border-border/50 bg-muted/20"
								>
									<div class="flex items-start justify-between gap-2">
										<EventTypeBadge
											type={extractScrutinyType(event) ?? "metadata"}
										/>
										<div
											class="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity"
										>
											<span
												class="text-[0.6875rem] text-muted-foreground font-mono"
											>
												{truncateHex(event.id as string)}
											</span>
										</div>
									</div>
								</Card.Header>
								<Card.Content class="py-4 flex-1">
									<p
										class="text-sm text-foreground leading-relaxed line-clamp-3"
									>
										{sanitizeEventContent(event.content).slice(0, 180)}
									</p>
								</Card.Content>
							</Card.Root>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
