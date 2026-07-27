<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        buildMetadataEvent,
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
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Select from "$lib/components/ui/select/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import { Snippet } from "$lib/components/ui/snippet/index.js";
    import { toast } from "svelte-sonner";
    import { ChevronDown as ChevronDownIcon } from "@lucide/svelte";

    let content = $state("");
    let category = $state("");
    let identifiers = $state("");
    let showAdvanced = $state(false);
    let publishing = $state(false);
    let publishedEventId = $state<string | null>(null);

    const DRAFT_ID = "publish-metadata";
    const categories = [
        { value: "vulnerability", label: "Vulnerability" },
        { value: "test", label: "Test" },
        { value: "certification", label: "Certification" },
        { value: "audit", label: "Audit" },
        { value: "analysis", label: "Analysis" },
        { value: "patch", label: "Patch" },
    ];

    $effect(() => {
        saveDraft({
            id: DRAFT_ID,
            type: "metadata",
            data: { content, category, identifiers },
            updatedAt: Date.now(),
        });
    });

    function buildPreview(): UnsignedEventTemplate {
        const labels: Record<string, string[]> = {};
        if (category.trim())
            labels["scrutiny:metadata:measurement_category"] = [
                category.trim(),
            ];

        const ids = identifiers
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);

        return buildMetadataEvent({
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
                publishedEventId = signed.id as string;
                await removeDraft(DRAFT_ID);
            }
            if (failures.length > 0) {
                toast.error(`Failed on ${failures.length} relay(s)`);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unknown error");
        } finally {
            publishing = false;
        }
    }
</script>

<svelte:head>
    <title>Publish Metadata | SCRUTINY Lens</title>
</svelte:head>

<div>
    <h2 class="text-xl font-semibold tracking-tight mb-6">
        Publish Metadata Event
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
                <div class="space-y-1.5">
                    <Label for="content">Description / Report *</Label>
                    <Textarea
                        id="content"
                        bind:value={content}
                        required
                        placeholder="Security observation, test result, or measurement"
                        class="font-mono"
                    />
                </div>

                <div class="space-y-1.5">
                    <Label>Measurement Category</Label>
                    <Select.Root
                        type="single"
                        onValueChange={(v) => (category = v)}
                    >
                        <Select.Trigger>
                            <span
                                >{categories.find((c) => c.value === category)
                                    ?.label ?? "— Select —"}</span
                            >
                        </Select.Trigger>
                        <Select.Content>
                            {#each categories as cat}
                                <Select.Item value={cat.value}
                                    >{cat.label}</Select.Item
                                >
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>

                <div class="space-y-1.5">
                    <Label for="identifiers"
                        >External Identifiers (one per line)</Label
                    >
                    <Textarea
                        id="identifiers"
                        bind:value={identifiers}
                        placeholder={"cve:CVE-2017-15361\ncwe:CWE-310"}
                        class="font-mono"
                    />
                </div>

                <Collapsible.Root bind:open={showAdvanced}>
                    <Collapsible.Trigger
                        class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDownIcon
                            class="h-3.5 w-3.5 transition-transform {showAdvanced
                                ? 'rotate-180'
                                : ''}"
                        />
                        {showAdvanced ? "Hide" : "Show"} JSON Preview
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                        <div class="mt-3">
                            <Snippet
                                text={JSON.stringify(buildPreview(), null, 2)}
                            />
                        </div>
                    </Collapsible.Content>
                </Collapsible.Root>

                <Button
                    type="submit"
                    disabled={publishing || !content.trim()}
                    class="w-full"
                >
                    {publishing ? "Publishing…" : "Sign & Publish"}
                </Button>

                {#if publishedEventId}
                    <div
                        class="rounded-md border border-green-500/30 bg-green-500/5 p-4 flex flex-col gap-2"
                    >
                        <p class="text-sm font-medium text-foreground">
                            ✓ Metadata published successfully
                        </p>
                        <p class="text-xs text-muted-foreground">
                            To attach this metadata to a product, create a
                            binding.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onclick={() =>
                                goto(
                                    `/publish/binding?other=${publishedEventId}`,
                                )}
                        >
                            Create Binding →
                        </Button>
                    </div>
                {/if}
            </form>
        </Card.Content>
    </Card.Root>
</div>
