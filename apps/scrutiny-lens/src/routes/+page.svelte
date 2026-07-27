<script lang="ts">
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button/index.js";
    import CrosshatchDivider from "$lib/components/CrosshatchDivider.svelte";
    import SearchIcon from "@lucide/svelte/icons/search";
    import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
    import NetworkIcon from "@lucide/svelte/icons/network";
    import MessageSquareIcon from "@lucide/svelte/icons/message-square";

    let query = $state("");

    function onSearch(event: SubmitEvent) {
        event.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        goto(`/search?q=${encodeURIComponent(trimmed)}`);
    }
</script>

<svelte:head>
    <title>SCRUTINY Lens — Security Metadata Explorer</title>
    <meta
        name="description"
        content="Audit-grade lens into product evidence, metadata, and security context across the SCRUTINY Fabric protocol on Nostr."
    />
</svelte:head>

<div class="flex flex-col items-center pt-16 pb-12">
    <!-- Hero -->
    <div class="text-center max-w-2xl">
        <h1 class="text-4xl font-bold tracking-tight text-foreground mb-3">
            SCRUTINY Lens
        </h1>
        <p class="text-lg text-muted-foreground leading-relaxed">
            Audit-grade lens into product evidence, metadata, and security
            context across the SCRUTINY Fabric protocol.
        </p>
    </div>

    <!-- Search -->
    <form onsubmit={onSearch} class="mt-10 w-full max-w-xl">
        <div
            class="dither-md relative flex items-center border border-border rounded-md bg-background overflow-hidden transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
        >
            <SearchIcon
                class="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
            />
            <input
                type="text"
                placeholder="Search by product name, CPE, PURL, CVE, or event ID…"
                bind:value={query}
                class="flex-1 bg-transparent py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none font-mono"
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

    <CrosshatchDivider class="mt-14 w-full max-w-3xl" />

    <!-- Feature Cards -->
    <div
        class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px border border-border rounded-md overflow-hidden bg-border w-full max-w-3xl"
    >
        <div class="bg-background p-6 flex flex-col gap-3">
            <ShieldCheckIcon class="h-5 w-5 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">
                Browse & Verify
            </h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
                Explore SCRUTINY events from Nostr relays. View effective
                metadata with trust-aware filtering.
            </p>
        </div>
        <div class="bg-background p-6 flex flex-col gap-3">
            <NetworkIcon class="h-5 w-5 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">
                Graph Explorer
            </h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
                Visualize product relationships — bindings, updates, and
                retractions as a navigable graph.
            </p>
        </div>
        <div class="bg-background p-6 flex flex-col gap-3">
            <MessageSquareIcon class="h-5 w-5 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">AI Chat</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
                Ask questions about product security metadata. Every claim is
                cited to a specific event.
            </p>
        </div>
    </div>
</div>
