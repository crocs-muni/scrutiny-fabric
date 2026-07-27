<script lang="ts">
    import { detectNostrExtension } from "$lib/nostr/publish.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import CrosshatchDivider from "$lib/components/CrosshatchDivider.svelte";
    import EventTypeBadge from "$lib/components/EventTypeBadge.svelte";
    import * as Alert from "$lib/components/ui/alert/index.js";
    import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";
    import PackageIcon from "@lucide/svelte/icons/package";
    import FileTextIcon from "@lucide/svelte/icons/file-text";
    import LinkIcon from "@lucide/svelte/icons/link";

    let nip07Available = $state(false);

    import { untrack } from "svelte";

    $effect(() => {
        untrack(async () => {
            // NIP-07 extensions inject window.nostr async — give them time
            nip07Available = await detectNostrExtension(2500);
        });
    });
</script>

<svelte:head>
    <title>Publish | SCRUTINY Lens</title>
</svelte:head>

<div>
    <h2 class="text-xl font-semibold tracking-tight mb-2">
        Publish SCRUTINY Event
    </h2>
    <p class="text-sm text-muted-foreground mb-6">
        Choose the type of event to publish to Nostr relays.
    </p>

    {#if !nip07Available}
        <Alert.Root variant="destructive" class="mb-6">
            <AlertTriangleIcon class="size-4" />
            <Alert.Title>No NIP-07 extension detected</Alert.Title>
            <Alert.Description>
                Install a Nostr signing extension to publish events:
                <a
                    href="https://getalby.com"
                    target="_blank"
                    rel="noopener"
                    class="text-primary hover:underline">Alby</a
                >,
                <a
                    href="https://github.com/nicolgit/nos2x"
                    target="_blank"
                    rel="noopener"
                    class="text-primary hover:underline">nos2x</a
                >, or
                <a
                    href="https://github.com/nicolgit/amber"
                    target="_blank"
                    rel="noopener"
                    class="text-primary hover:underline">Amber</a
                > (mobile).
            </Alert.Description>
        </Alert.Root>
    {/if}

    <div
        class="grid grid-cols-1 md:grid-cols-3 gap-px border border-border rounded-md overflow-hidden bg-border"
    >
        <a
            href="/publish/product"
            class="group bg-background p-6 flex flex-col gap-3 hover:bg-muted/50 transition-colors"
        >
            <div class="flex items-center gap-2">
                <PackageIcon class="h-5 w-5 text-primary" />
                <EventTypeBadge type="product" />
            </div>
            <h3
                class="text-sm font-semibold group-hover:text-primary transition-colors"
            >
                Product Event
            </h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
                Define a product, hardware model, or software package.
            </p>
        </a>

        <a
            href="/publish/metadata"
            class="group bg-background p-6 flex flex-col gap-3 hover:bg-muted/50 transition-colors"
        >
            <div class="flex items-center gap-2">
                <FileTextIcon class="h-5 w-5 text-muted-foreground" />
                <EventTypeBadge type="metadata" />
            </div>
            <h3
                class="text-sm font-semibold group-hover:text-primary transition-colors"
            >
                Metadata Event
            </h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
                Publish security intelligence, test results, or measurements.
            </p>
        </a>

        <a
            href="/publish/binding"
            class="group bg-background p-6 flex flex-col gap-3 hover:bg-muted/50 transition-colors"
        >
            <div class="flex items-center gap-2">
                <LinkIcon class="h-5 w-5 text-primary/70" />
                <EventTypeBadge type="binding" />
            </div>
            <h3
                class="text-sm font-semibold group-hover:text-primary transition-colors"
            >
                Binding Event
            </h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
                Connect metadata to a product with a specific relationship.
            </p>
        </a>
    </div>
</div>
