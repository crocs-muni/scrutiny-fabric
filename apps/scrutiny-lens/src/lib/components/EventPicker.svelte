<script lang="ts">
    import { eventList } from "$lib/stores/eventStore.js";
    import { enabledRelayUrls } from "$lib/stores/relayStore.js";
    import { fetchScrutinyEvents } from "$lib/nostr/subscriptions.js";
    import {
        extractScrutinyType,
        type NostrEvent,
        type ScrutinyType,
    } from "@scrutiny-fabric/scrutiny-fabric";
    import {
        truncateHex,
        formatRelativeTime,
        eventTypeLabel,
    } from "$lib/utils/formatters.js";
    import { sanitizeEventContent } from "$lib/security/sanitize.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import { Spinner } from "$lib/components/ui/spinner/index.js";
    import EventTypeBadge from "$lib/components/EventTypeBadge.svelte";
    import SearchIcon from "@lucide/svelte/icons/search";

    interface Props {
        selected: Set<string>;
        onSelectionChange: (next: Set<string>) => void;
        singleSelect?: boolean;
        filterTypes?: ScrutinyType[];
        excludeIds?: Set<string>;
    }

    let {
        selected,
        onSelectionChange,
        singleSelect = false,
        filterTypes,
        excludeIds,
    }: Props = $props();

    let filterText = $state("");
    let activeTab = $state<"memory" | "search">("search");
    let searchQuery = $state("");
    let searchResults = $state<NostrEvent[]>([]);
    let searching = $state(false);

    function getLabelValue(
        tags: readonly (readonly string[])[],
        namespace: string,
    ): string {
        for (const tag of tags) {
            if (tag[0] === "l" && tag[2] === namespace && tag[1]) return tag[1];
        }
        return "";
    }

    function getDisplayName(event: NostrEvent): string {
        const vendor = getLabelValue(event.tags, "scrutiny:product:vendor");
        const name = getLabelValue(event.tags, "scrutiny:product:name");
        const version = getLabelValue(event.tags, "scrutiny:product:version");
        const composed = [vendor, name, version].filter(Boolean).join(" ");
        if (composed) return composed;
        const content = sanitizeEventContent(event.content).slice(0, 60);
        return content || truncateHex(event.id as string);
    }

    function matchesFilter(event: NostrEvent, query: string): boolean {
        if (!query) return true;
        const q = query.toLowerCase();
        const name = getDisplayName(event).toLowerCase();
        const id = (event.id as string).toLowerCase();
        const content = event.content.toLowerCase();
        return name.includes(q) || id.includes(q) || content.includes(q);
    }

    // Filtered in-memory events
    let memoryEvents = $derived.by(() => {
        let events = $eventList;
        if (filterTypes && filterTypes.length > 0) {
            events = events.filter((e) => {
                const t = extractScrutinyType(e);
                return t && filterTypes!.includes(t);
            });
        }
        if (excludeIds && excludeIds.size > 0) {
            events = events.filter((e) => !excludeIds!.has(e.id as string));
        }
        events = events.filter((e) => matchesFilter(e, filterText));
        return events.sort((a, b) => b.created_at - a.created_at).slice(0, 100);
    });

    let filteredSearchResults = $derived.by(() => {
        let events = searchResults;
        if (excludeIds && excludeIds.size > 0) {
            events = events.filter((e) => !excludeIds!.has(e.id as string));
        }
        return events;
    });

    function toggleEvent(eventId: string) {
        const next = new Set(selected);
        if (next.has(eventId)) {
            next.delete(eventId);
        } else {
            if (singleSelect) {
                next.clear();
            }
            next.add(eventId);
        }
        onSelectionChange(next);
    }

    async function runSearch() {
        const q = searchQuery.trim();
        if (!q) return;
        searching = true;
        try {
            const types: ScrutinyType[] = filterTypes ?? [
                "product",
                "metadata",
            ];
            const events = await fetchScrutinyEvents($enabledRelayUrls, types, {
                timeoutMs: 4000,
            });
            const lq = q.toLowerCase();
            searchResults = events.filter((e) => matchesFilter(e, lq));
        } catch (err) {
            console.warn("[SCRUTINY:EventPicker] search failed", err);
        } finally {
            searching = false;
        }
    }
</script>

<div class="flex flex-col gap-3">
    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border">
        <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium transition-colors border-b-2 {activeTab ===
            'memory'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}"
            onclick={() => (activeTab = "memory")}
        >
            Loaded Events ({memoryEvents.length})
        </button>
        <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium transition-colors border-b-2 {activeTab ===
            'search'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}"
            onclick={() => (activeTab = "search")}
        >
            Relay Search
        </button>
    </div>

    {#if activeTab === "memory"}
        <!-- Filter -->
        <div class="relative">
            <SearchIcon
                class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            />
            <Input
                type="text"
                placeholder="Filter by name, ID, or content…"
                bind:value={filterText}
                class="pl-8 h-9 text-sm"
            />
        </div>

        <!-- Event list -->
        <div
            class="border border-border rounded-md max-h-[280px] overflow-y-auto scrollbar-hide"
        >
            {#if memoryEvents.length === 0}
                <div class="p-6 text-center text-xs text-muted-foreground">
                    No events loaded yet. Try the Relay Search tab.
                </div>
            {:else}
                {#each memoryEvents as event}
                    {@const eventId = event.id as string}
                    {@const isSelected = selected.has(eventId)}
                    {@const evtType = extractScrutinyType(event)}
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border/50 last:border-b-0 transition-colors {isSelected
                            ? 'bg-primary/5'
                            : 'hover:bg-muted/50'}"
                        onclick={() => toggleEvent(eventId)}
                    >
                        <Checkbox
                            checked={isSelected}
                            aria-label="Select event"
                            class="shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                                <EventTypeBadge type={evtType ?? "unknown"} />
                                <span
                                    class="text-sm font-medium text-foreground truncate"
                                    >{getDisplayName(event)}</span
                                >
                            </div>
                            <div
                                class="flex items-center gap-2 text-[10px] text-muted-foreground font-mono"
                            >
                                <span>{truncateHex(eventId)}</span>
                                <span>·</span>
                                <span
                                    >{formatRelativeTime(
                                        event.created_at,
                                    )}</span
                                >
                            </div>
                        </div>
                    </button>
                {/each}
            {/if}
        </div>
    {:else}
        <!-- Search tab -->
        <form
            onsubmit={(e) => {
                e.preventDefault();
                runSearch();
            }}
            class="flex gap-2"
        >
            <Input
                type="text"
                placeholder="Search relays…"
                bind:value={searchQuery}
                class="h-9 text-sm flex-1"
            />
            <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={searching || !searchQuery.trim()}
            >
                {searching ? "…" : "Search"}
            </Button>
        </form>

        <div
            class="border border-border rounded-md max-h-[280px] overflow-y-auto scrollbar-hide"
        >
            {#if searching}
                <div
                    class="p-6 flex flex-col items-center gap-2 text-xs text-muted-foreground"
                >
                    <Spinner class="size-4" />
                    Searching relays…
                </div>
            {:else if filteredSearchResults.length === 0}
                <div class="p-6 text-center text-xs text-muted-foreground">
                    {searchResults.length > 0
                        ? "No matching results."
                        : "Enter a query and search."}
                </div>
            {:else}
                {#each filteredSearchResults as event}
                    {@const eventId = event.id as string}
                    {@const isSelected = selected.has(eventId)}
                    {@const evtType = extractScrutinyType(event)}
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border/50 last:border-b-0 transition-colors {isSelected
                            ? 'bg-primary/5'
                            : 'hover:bg-muted/50'}"
                        onclick={() => toggleEvent(eventId)}
                    >
                        <Checkbox
                            checked={isSelected}
                            aria-label="Select event"
                            class="shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                                <EventTypeBadge type={evtType ?? "unknown"} />
                                <span
                                    class="text-sm font-medium text-foreground truncate"
                                    >{getDisplayName(event)}</span
                                >
                            </div>
                            <div
                                class="flex items-center gap-2 text-[10px] text-muted-foreground font-mono"
                            >
                                <span>{truncateHex(eventId)}</span>
                                <span>·</span>
                                <span
                                    >{formatRelativeTime(
                                        event.created_at,
                                    )}</span
                                >
                            </div>
                        </div>
                    </button>
                {/each}
            {/if}
        </div>
    {/if}

    <!-- Selection summary -->
    {#if selected.size > 0}
        <p class="text-xs text-muted-foreground font-mono">
            {selected.size} event{selected.size !== 1 ? "s" : ""} selected
        </p>
    {/if}
</div>
