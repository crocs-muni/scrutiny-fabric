<script lang="ts">
    import {
        buildProductEvent,
        type UnsignedEventTemplate,
    } from "@scrutiny-fabric/scrutiny-fabric";
    import {
        signEvent,
        publishToRelays,
        getPublicKey,
        type PublishResult,
    } from "$lib/nostr/publish.js";
    import { enabledRelayUrls } from "$lib/stores/relayStore.js";
    import { saveDraft, removeDraft } from "$lib/cache/config.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import * as Alert from "$lib/components/ui/alert/index.js";
    import { Snippet } from "$lib/components/ui/snippet/index.js";
    import { toast } from "svelte-sonner";
    import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import InfoIcon from "@lucide/svelte/icons/info";

    let content = $state("");
    let vendor = $state("");
    let productName = $state("");
    let version = $state("");
    let identifiers = $state("");
    let showAdvanced = $state(false);
    let publishing = $state(false);

    const DRAFT_ID = "publish-product";

    $effect(() => {
        saveDraft({
            id: DRAFT_ID,
            type: "product",
            data: { content, vendor, productName, version, identifiers },
            updatedAt: Date.now(),
        });
    });

    function buildPreview(): UnsignedEventTemplate {
        const labels: Record<string, string[]> = {};
        if (vendor.trim()) labels["scrutiny:product:vendor"] = [vendor.trim()];
        if (productName.trim())
            labels["scrutiny:product:name"] = [productName.trim()];
        if (version.trim())
            labels["scrutiny:product:version"] = [version.trim()];

        const ids = identifiers
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);

        return buildProductEvent({
            content: content.trim(),
            identifiers: ids.length > 0 ? ids : undefined,
            labels: Object.keys(labels).length > 0 ? labels : undefined,
        });
    }

    async function onPublish() {
        if (!content.trim()) {
            toast.error("Content is required.");
            return;
        }

        publishing = true;

        try {
            const template = buildPreview();
            const pubkey = await getPublicKey();
            const signed = await signEvent({
                kind: template.kind,
                content: template.content,
                tags: template.tags as string[][],
                pubkey,
                created_at: Math.floor(Date.now() / 1000),
            });
            const results = await publishToRelays($enabledRelayUrls, signed);

            const successes = results.filter((r) => r.success);
            const failures = results.filter((r) => !r.success);

            if (successes.length > 0) {
                toast.success(`Published to ${successes.length} relay(s)`);
                await removeDraft(DRAFT_ID);
            }
            if (failures.length > 0) {
                toast.error(`Failed on ${failures.length} relay(s)`, {
                    description: failures
                        .map((r) => `${r.url}: ${r.error}`)
                        .join(", "),
                });
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unknown error");
        } finally {
            publishing = false;
        }
    }
</script>

<svelte:head>
    <title>Publish Product | SCRUTINY Lens</title>
</svelte:head>

<div>
    <h2 class="text-xl font-semibold tracking-tight mb-6">
        Publish Product Event
    </h2>

    <Card.Root>
        <Card.Content class="pt-6">
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    onPublish();
                }}
                class="flex flex-col gap-4"
            >
                <Collapsible.Root bind:open={showAdvanced}>
                    <Collapsible.Trigger
                        class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDownIcon
                            class="h-3.5 w-3.5 transition-transform {showAdvanced
                                ? 'rotate-180'
                                : ''}"
                        />
                        {showAdvanced ? "Hide" : "Show"} Event Preview
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                        <div class="mt-3">
                            <Snippet
                                text={JSON.stringify(buildPreview(), null, 2)}
                            />
                        </div>
                    </Collapsible.Content>
                </Collapsible.Root>
                <div class="space-y-1.5">
                    <Label for="content">Description *</Label>
                    <Textarea
                        id="content"
                        bind:value={content}
                        required
                        placeholder="Human-readable product description"
                        class="font-mono"
                    />
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="space-y-1.5">
                        <Label for="vendor">Vendor</Label>
                        <Input
                            id="vendor"
                            bind:value={vendor}
                            placeholder="e.g. Infineon"
                        />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="name">Product Name</Label>
                        <Input
                            id="name"
                            bind:value={productName}
                            placeholder="e.g. M7794A12"
                        />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="version">Version</Label>
                        <Input
                            id="version"
                            bind:value={version}
                            placeholder="e.g. 1.0.0"
                        />
                    </div>
                </div>

                <div class="space-y-1.5">
                    <Label for="identifiers"
                        >Canonical Identifiers (one per line)</Label
                    >
                    <Textarea
                        id="identifiers"
                        bind:value={identifiers}
                        placeholder={"cpe:2.3:h:infineon:m7794a12\npurl:pkg:npm/example"}
                        class="font-mono"
                    />
                </div>

                <div
                    class="rounded-md border border-border bg-muted/20 p-3 flex items-start gap-2.5"
                >
                    <InfoIcon class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div class="text-xs text-muted-foreground leading-relaxed">
                        <span class="font-medium text-foreground"
                            >How to sign:</span
                        >
                        You need a NIP-07 browser extension (e.g.,
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
                        >). Click "Sign & Publish" and approve the signing
                        request in the extension popup.
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={publishing || !content.trim()}
                    class="w-full"
                >
                    {publishing ? "Publishing…" : "Sign & Publish"}
                </Button>
            </form>
        </Card.Content>
    </Card.Root>
</div>
