<script lang="ts">
    import {
        buildBindingEvent,
        type UnsignedEventTemplate,
        ALL_RELATIONSHIPS,
        SYMMETRIC_RELATIONSHIPS,
        DIRECTED_RELATIONSHIPS,
        isSymmetric as isSymmetricRel,
        type Relationship,
    } from "@scrutiny-fabric/scrutiny-fabric";
    import {
        signEvent,
        publishToRelays,
        getPublicKey,
    } from "$lib/nostr/publish.js";
    import { enabledRelayUrls } from "$lib/stores/relayStore.js";
    import { getEvent } from "$lib/stores/eventStore.js";
    import { relationshipLabel } from "$lib/utils/formatters.js";
    import { truncateHex } from "$lib/utils/formatters.js";
    import { sanitizeEventContent } from "$lib/security/sanitize.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Select from "$lib/components/ui/select/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { toast } from "svelte-sonner";
    import { page } from "$app/stores";
    import {
        Check as CheckIcon,
        ArrowRight as ArrowRightIcon,
        ArrowLeftRight as ArrowLeftRightIcon,
    } from "@lucide/svelte";
    import * as Stepper from "$lib/components/ui/stepper/index.js";
    import EventPicker from "$lib/components/EventPicker.svelte";
    import EventTypeBadge from "$lib/components/EventTypeBadge.svelte";
    import {
        extractScrutinyType,
        type NostrEvent,
    } from "@scrutiny-fabric/scrutiny-fabric";

    // ── Wizard state ──
    type FlowType = "symmetric" | "asymmetric";
    let flowType = $state<FlowType | null>(null);
    let currentStep = $state(1);

    let relationship = $state<string>("related");
    let content = $state("");
    let publishing = $state(false);

    // Symmetric: all selected events
    let symmetricEvents = $state<Set<string>>(new Set());

    // Asymmetric: root + quotes
    let rootEvent = $state<Set<string>>(new Set());
    let quoteEvents = $state<Set<string>>(new Set());

    // ── Step labels ──
    let stepLabels = $derived.by(() => {
        if (flowType === "symmetric") {
            return ["Category", "Select Events", "Review & Publish"];
        }
        return ["Category", "Select Root", "Select Quotes", "Review & Publish"];
    });

    let totalSteps = $derived(stepLabels.length);

    // ── Step validation ──
    let canAdvance = $derived.by(() => {
        if (currentStep === 1) return flowType !== null;
        if (flowType === "symmetric") {
            if (currentStep === 2) return symmetricEvents.size >= 2;
            return true;
        }
        // asymmetric
        if (currentStep === 2) return rootEvent.size === 1;
        if (currentStep === 3) return quoteEvents.size >= 1;
        return true;
    });

    function nextStep() {
        if (currentStep < totalSteps && canAdvance) {
            currentStep += 1;
        }
    }

    function prevStep() {
        if (currentStep > 1) {
            currentStep -= 1;
        }
    }

    function selectFlow(type: FlowType) {
        flowType = type;
        relationship = type === "symmetric" ? "related" : "test";
        // Reset selections when switching flow
        symmetricEvents = new Set();
        rootEvent = new Set();
        quoteEvents = new Set();
    }

    import { untrack } from "svelte";

    $effect(() => {
        untrack(() => {
            const prefillRoot = $page.url.searchParams.get("root");
            if (prefillRoot) {
                selectFlow("asymmetric");
                rootEvent = new Set([prefillRoot]);
                currentStep = 3; // jump straight to quoting
            }
        });
    });

    // ── Helpers ──
    function getEventName(id: string): string {
        const event = getEvent(id);
        if (!event) return truncateHex(id);
        return getDisplayName(event);
    }

    function getDisplayName(event: NostrEvent): string {
        const vendor = getLabelValue(event.tags, "scrutiny:product:vendor");
        const name = getLabelValue(event.tags, "scrutiny:product:name");
        const version = getLabelValue(event.tags, "scrutiny:product:version");
        const composed = [vendor, name, version].filter(Boolean).join(" ");
        if (composed) return composed;
        const c = sanitizeEventContent(event.content).slice(0, 50);
        return c || truncateHex(event.id as string);
    }

    function getLabelValue(
        tags: readonly (readonly string[])[],
        namespace: string,
    ): string {
        for (const tag of tags) {
            if (tag[0] === "l" && tag[2] === namespace && tag[1]) return tag[1];
        }
        return "";
    }

    // ── Compute binding pairs ──
    let bindingPairs = $derived.by(() => {
        const pairs: Array<{ root: string; quote: string }> = [];
        if (flowType === "symmetric") {
            const ids = [...symmetricEvents];
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    pairs.push({ root: ids[i], quote: ids[j] });
                }
            }
        } else {
            const rootId = [...rootEvent][0];
            if (rootId) {
                for (const quoteId of quoteEvents) {
                    pairs.push({ root: rootId, quote: quoteId });
                }
            }
        }
        return pairs;
    });

    let isCurrentRelSymmetric = $derived(isSymmetricRel(relationship));

    // ── Publish ──
    async function onPublish() {
        if (bindingPairs.length === 0) {
            toast.error("No bindings to create.");
            return;
        }

        publishing = true;
        try {
            const pubkey = await getPublicKey();
            let successCount = 0;
            let failCount = 0;

            for (const pair of bindingPairs) {
                const template = buildBindingEvent({
                    content: content.trim(),
                    anchor: { eventId: pair.root },
                    other: { eventId: pair.quote },
                    relationship: relationship as Relationship,
                });

                const signed = await signEvent({
                    kind: template.kind,
                    content: template.content,
                    tags: template.tags as string[][],
                    pubkey,
                    created_at: Math.floor(Date.now() / 1000),
                });

                const results = await publishToRelays(
                    $enabledRelayUrls,
                    signed,
                );
                const successes = results.filter((r) => r.success);
                if (successes.length > 0) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(
                    `Published ${successCount} binding${successCount !== 1 ? "s" : ""}`,
                );
            }
            if (failCount > 0) {
                toast.error(
                    `${failCount} binding${failCount !== 1 ? "s" : ""} failed`,
                );
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unknown error");
        } finally {
            publishing = false;
        }
    }
</script>

<svelte:head>
    <title>Publish Binding | SCRUTINY Lens</title>
</svelte:head>

<div>
    <h2 class="text-xl font-semibold tracking-tight mb-2">
        Publish Binding Event
    </h2>
    <p class="text-sm text-muted-foreground mb-6">
        Connect events with a specific relationship.
    </p>

    <!-- Stepper nav -->
    {#key flowType}
        <Stepper.Root bind:step={currentStep}>
            <div class="flex w-full mb-8 transition-all">
                <Stepper.Nav
                    orientation="horizontal"
                    class="w-full justify-between"
                >
                    {#each stepLabels as label, i}
                        <Stepper.Item>
                            <Stepper.Trigger>
                                <Stepper.Indicator>
                                    {i + 1}
                                </Stepper.Indicator>
                                <Stepper.Title
                                    class="text-xs hidden sm:block w-max"
                                    >{label}</Stepper.Title
                                >
                            </Stepper.Trigger>
                            <Stepper.Separator
                                class={i === stepLabels.length - 1
                                    ? "hidden"
                                    : ""}
                            />
                        </Stepper.Item>
                    {/each}
                </Stepper.Nav>
            </div>

            <Card.Root>
                <Card.Content class="pt-6">
                    <!-- ═══ STEP 1: Choose category ═══ -->
                    {#if currentStep === 1}
                        <div class="flex flex-col gap-4">
                            <div>
                                <h3 class="text-sm font-semibold mb-1">
                                    Choose Binding Category
                                </h3>
                                <p class="text-xs text-muted-foreground mb-4">
                                    Symmetric bindings connect events as equals.
                                    Directed bindings have a root (subject) and
                                    quote (object).
                                </p>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <!-- Symmetric -->
                                <button
                                    type="button"
                                    class="text-left border rounded-lg p-4 transition-all {flowType ===
                                    'symmetric'
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                        : 'border-border hover:border-primary/30'}"
                                    onclick={() => selectFlow("symmetric")}
                                >
                                    <div class="flex items-center gap-2 mb-2">
                                        <ArrowLeftRightIcon
                                            class="h-5 w-5 text-primary"
                                        />
                                        <span
                                            class="text-sm font-semibold text-foreground"
                                            >Symmetric</span
                                        >
                                    </div>
                                    <p
                                        class="text-xs text-muted-foreground mb-3"
                                    >
                                        Events are related as equals. No
                                        direction.
                                    </p>
                                    <div class="flex flex-wrap gap-1.5">
                                        {#each SYMMETRIC_RELATIONSHIPS as rel}
                                            <Badge
                                                variant="outline"
                                                class="text-[10px]"
                                                >{relationshipLabel(rel)}</Badge
                                            >
                                        {/each}
                                    </div>
                                </button>

                                <!-- Directed -->
                                <button
                                    type="button"
                                    class="text-left border rounded-lg p-4 transition-all {flowType ===
                                    'asymmetric'
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                        : 'border-border hover:border-primary/30'}"
                                    onclick={() => selectFlow("asymmetric")}
                                >
                                    <div class="flex items-center gap-2 mb-2">
                                        <ArrowRightIcon
                                            class="h-5 w-5 text-primary"
                                        />
                                        <span
                                            class="text-sm font-semibold text-foreground"
                                            >Directed</span
                                        >
                                    </div>
                                    <p
                                        class="text-xs text-muted-foreground mb-3"
                                    >
                                        Root (subject) → Quote (object). Has
                                        direction.
                                    </p>
                                    <div class="flex flex-wrap gap-1.5">
                                        {#each DIRECTED_RELATIONSHIPS as rel}
                                            <Badge
                                                variant="outline"
                                                class="text-[10px]"
                                                >{relationshipLabel(rel)}</Badge
                                            >
                                        {/each}
                                    </div>
                                </button>
                            </div>
                        </div>

                        <!-- ═══ STEP 2a: Symmetric — select all events ═══ -->
                    {:else if currentStep === 2 && flowType === "symmetric"}
                        <div class="flex flex-col gap-4">
                            <div>
                                <h3 class="text-sm font-semibold mb-1">
                                    Select Events
                                </h3>
                                <p class="text-xs text-muted-foreground mb-4">
                                    Choose at least 2 events. All pairs will be
                                    bound symmetrically.
                                </p>
                            </div>
                            <EventPicker
                                selected={symmetricEvents}
                                onSelectionChange={(next) =>
                                    (symmetricEvents = next)}
                                filterTypes={["product", "metadata"]}
                            />
                            {#if symmetricEvents.size >= 2}
                                <p class="text-xs text-muted-foreground">
                                    Will create <span
                                        class="text-foreground font-medium"
                                        >{(symmetricEvents.size *
                                            (symmetricEvents.size - 1)) /
                                            2}</span
                                    >
                                    binding{(symmetricEvents.size *
                                        (symmetricEvents.size - 1)) /
                                        2 !==
                                    1
                                        ? "s"
                                        : ""} (all pairs).
                                </p>
                            {/if}
                        </div>

                        <!-- ═══ STEP 2b: Asymmetric — select root ═══ -->
                    {:else if currentStep === 2 && flowType === "asymmetric"}
                        <div class="flex flex-col gap-4">
                            <div>
                                <h3 class="text-sm font-semibold mb-1">
                                    Select Root (Subject)
                                </h3>
                                <p class="text-xs text-muted-foreground mb-4">
                                    Choose exactly one event as the root/anchor
                                    of the binding.
                                </p>
                            </div>
                            <EventPicker
                                selected={rootEvent}
                                onSelectionChange={(next) => (rootEvent = next)}
                                singleSelect={true}
                                filterTypes={["product", "metadata"]}
                            />
                        </div>

                        <!-- ═══ STEP 3b: Asymmetric — select quotes ═══ -->
                    {:else if currentStep === 3 && flowType === "asymmetric"}
                        <div class="flex flex-col gap-4">
                            <div>
                                <h3 class="text-sm font-semibold mb-1">
                                    Select Quotes (Objects)
                                </h3>
                                <p class="text-xs text-muted-foreground mb-2">
                                    Choose one or more events to bind to the
                                    root.
                                </p>
                                {#if rootEvent.size > 0}
                                    <div
                                        class="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"
                                    >
                                        Root:
                                        <Badge
                                            variant="secondary"
                                            class="font-mono text-[10px]"
                                        >
                                            {getEventName([...rootEvent][0])}
                                        </Badge>
                                    </div>
                                {/if}
                            </div>
                            <EventPicker
                                selected={quoteEvents}
                                onSelectionChange={(next) =>
                                    (quoteEvents = next)}
                                filterTypes={["product", "metadata"]}
                                excludeIds={rootEvent}
                            />
                        </div>

                        <!-- ═══ REVIEW STEP (last step for both flows) ═══ -->
                    {:else if currentStep === totalSteps}
                        <div class="flex flex-col gap-5">
                            <div>
                                <h3 class="text-sm font-semibold mb-1">
                                    Review & Publish
                                </h3>
                                <p class="text-xs text-muted-foreground mb-4">
                                    {bindingPairs.length} binding{bindingPairs.length !==
                                    1
                                        ? "s"
                                        : ""} will be created.
                                </p>
                            </div>

                            <!-- Visual root ↔ quote layout -->
                            <div
                                class="flex flex-col md:flex-row items-stretch gap-4"
                            >
                                <!-- Root side -->
                                <div
                                    class="flex-1 border border-border rounded-lg overflow-hidden"
                                >
                                    <div
                                        class="px-3 py-2 bg-muted/30 border-b border-border"
                                    >
                                        <span
                                            class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                                            >Root</span
                                        >
                                    </div>
                                    <div
                                        class="p-2 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-hide"
                                    >
                                        {#if flowType === "symmetric"}
                                            {#each [...symmetricEvents] as id}
                                                {@const evt = getEvent(id)}
                                                <div
                                                    class="text-xs px-2 py-1.5 bg-muted/20 rounded border border-border/50 flex items-center gap-2"
                                                >
                                                    {#if evt}
                                                        <EventTypeBadge
                                                            type={extractScrutinyType(
                                                                evt,
                                                            ) ?? "unknown"}
                                                        />
                                                    {/if}
                                                    <span
                                                        class="font-medium truncate"
                                                        >{getEventName(
                                                            id,
                                                        )}</span
                                                    >
                                                </div>
                                            {/each}
                                        {:else}
                                            {#each [...rootEvent] as id}
                                                {@const evt = getEvent(id)}
                                                <div
                                                    class="text-xs px-2 py-1.5 bg-muted/20 rounded border border-border/50 flex items-center gap-2"
                                                >
                                                    {#if evt}
                                                        <EventTypeBadge
                                                            type={extractScrutinyType(
                                                                evt,
                                                            ) ?? "unknown"}
                                                        />
                                                    {/if}
                                                    <span
                                                        class="font-medium truncate"
                                                        >{getEventName(
                                                            id,
                                                        )}</span
                                                    >
                                                </div>
                                            {/each}
                                        {/if}
                                    </div>
                                </div>

                                <!-- Arrow + relationship selector -->
                                <div
                                    class="flex flex-col items-center justify-center gap-2 py-4 shrink-0"
                                >
                                    {#if isCurrentRelSymmetric}
                                        <ArrowLeftRightIcon
                                            class="h-5 w-5 text-primary"
                                        />
                                    {:else}
                                        <ArrowRightIcon
                                            class="h-5 w-5 text-primary"
                                        />
                                    {/if}
                                    <Select.Root
                                        type="single"
                                        value={relationship}
                                        onValueChange={(v) =>
                                            (relationship = v)}
                                    >
                                        <Select.Trigger
                                            class="w-[160px] h-8 text-xs"
                                        >
                                            <span
                                                >{relationshipLabel(
                                                    relationship,
                                                )}</span
                                            >
                                        </Select.Trigger>
                                        <Select.Content>
                                            {#each ALL_RELATIONSHIPS as rel}
                                                <Select.Item value={rel}>
                                                    {relationshipLabel(rel)}
                                                </Select.Item>
                                            {/each}
                                        </Select.Content>
                                    </Select.Root>
                                </div>

                                <!-- Quote side -->
                                <div
                                    class="flex-1 border border-border rounded-lg overflow-hidden"
                                >
                                    <div
                                        class="px-3 py-2 bg-muted/30 border-b border-border"
                                    >
                                        <span
                                            class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                                            >Quote</span
                                        >
                                    </div>
                                    <div
                                        class="p-2 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-hide"
                                    >
                                        {#if flowType === "symmetric"}
                                            {#each [...symmetricEvents] as id}
                                                {@const evt = getEvent(id)}
                                                <div
                                                    class="text-xs px-2 py-1.5 bg-muted/20 rounded border border-border/50 flex items-center gap-2"
                                                >
                                                    {#if evt}
                                                        <EventTypeBadge
                                                            type={extractScrutinyType(
                                                                evt,
                                                            ) ?? "unknown"}
                                                        />
                                                    {/if}
                                                    <span
                                                        class="font-medium truncate"
                                                        >{getEventName(
                                                            id,
                                                        )}</span
                                                    >
                                                </div>
                                            {/each}
                                        {:else}
                                            {#each [...quoteEvents] as id}
                                                {@const evt = getEvent(id)}
                                                <div
                                                    class="text-xs px-2 py-1.5 bg-muted/20 rounded border border-border/50 flex items-center gap-2"
                                                >
                                                    {#if evt}
                                                        <EventTypeBadge
                                                            type={extractScrutinyType(
                                                                evt,
                                                            ) ?? "unknown"}
                                                        />
                                                    {/if}
                                                    <span
                                                        class="font-medium truncate"
                                                        >{getEventName(
                                                            id,
                                                        )}</span
                                                    >
                                                </div>
                                            {/each}
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <!-- Description -->
                            <div class="space-y-1.5">
                                <Label for="binding-content"
                                    >Description (optional)</Label
                                >
                                <Textarea
                                    id="binding-content"
                                    bind:value={content}
                                    placeholder="Optional description for this binding"
                                    class="font-mono"
                                />
                            </div>

                            <!-- Publish -->
                            <Button
                                type="button"
                                disabled={publishing ||
                                    bindingPairs.length === 0}
                                class="w-full"
                                onclick={onPublish}
                            >
                                {publishing
                                    ? "Publishing…"
                                    : `Sign & Publish ${bindingPairs.length} Binding${bindingPairs.length !== 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    {/if}

                    <!-- Navigation buttons -->
                    <div
                        class="flex justify-between items-center mt-6 pt-4 border-t border-border"
                    >
                        <Stepper.Previous
                            variant="ghost"
                            size="sm"
                            disabled={currentStep === 1}
                        >
                            Back
                        </Stepper.Previous>
                        {#if currentStep < totalSteps}
                            <Stepper.Next size="sm" disabled={!canAdvance}>
                                {#if !canAdvance}
                                    {#if currentStep === 1}
                                        Select flow type
                                    {:else if flowType === "symmetric" && currentStep === 2}
                                        Select at least 2 events
                                    {:else if flowType === "asymmetric" && currentStep === 2}
                                        Select Root event
                                    {:else if flowType === "asymmetric" && currentStep === 3}
                                        Select 1 or more Quotes
                                    {:else}
                                        Next
                                    {/if}
                                {:else}
                                    Next
                                {/if}
                            </Stepper.Next>
                        {/if}
                    </div>
                </Card.Content>
            </Card.Root>
        </Stepper.Root>
    {/key}
</div>
