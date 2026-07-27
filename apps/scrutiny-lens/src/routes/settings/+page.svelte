<script lang="ts">
    import {
        relays,
        relayStatuses,
        relayHealth,
        addRelay,
        removeRelay,
        toggleRelay,
    } from "$lib/stores/relayStore.js";
    import {
        trustedPubkeys,
        trustedCount,
        trustPubkey,
        untrustPubkey,
        showUntrusted,
    } from "$lib/stores/trustStore.js";
    import { addNdkRelay, removeNdkRelay } from "$lib/nostr/pool.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import * as FieldSet from "$lib/components/ui/field-set/index.js";
    import { CopyButton } from "$lib/components/ui/copy-button/index.js";
    import { toast } from "svelte-sonner";
    import PlusIcon from "@lucide/svelte/icons/plus";
    import TrashIcon from "@lucide/svelte/icons/trash-2";

    let newRelayUrl = $state("");
    let newPubkey = $state("");

    async function onAddRelay(e: SubmitEvent) {
        e.preventDefault();
        const url = newRelayUrl.trim();
        const success = await addRelay(url);
        if (success) {
            addNdkRelay(url);
            toast.success("Relay added", { description: url });
            newRelayUrl = "";
        } else {
            toast.error("Invalid URL (must be wss://) or already exists.");
        }
    }

    async function onToggleRelay(url: string) {
        await toggleRelay(url);
        const updated = $relays.find((r) => r.url === url);
        if (updated?.enabled) {
            addNdkRelay(url);
        } else {
            removeNdkRelay(url);
        }
    }

    async function onRemoveRelay(url: string) {
        removeNdkRelay(url);
        await removeRelay(url);
    }

    async function onAddPubkey(e: SubmitEvent) {
        e.preventDefault();
        const hex = newPubkey.trim().toLowerCase();
        if (hex.length !== 64 || !/^[0-9a-f]+$/.test(hex)) {
            toast.error("Must be a 64-character hex pubkey.");
            return;
        }
        await trustPubkey(hex);
        toast.success("Pubkey trusted");
        newPubkey = "";
    }
</script>

<svelte:head>
    <title>Settings | SCRUTINY Lens</title>
</svelte:head>

<div>
    <h2 class="text-xl font-semibold tracking-tight mb-6">Settings</h2>

    <Tabs.Root value="relays">
        <Tabs.List>
            <Tabs.Trigger value="relays">Relays</Tabs.Trigger>
            <Tabs.Trigger value="trust">Trust ({$trustedCount})</Tabs.Trigger>
        </Tabs.List>

        <!-- Relays Tab -->
        <Tabs.Content value="relays">
            <FieldSet.Root>
                <FieldSet.Title>Relay Configuration</FieldSet.Title>
                <FieldSet.Content>
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-xs font-mono text-muted-foreground"
                            >Status:</span
                        >
                        <span
                            class="inline-block w-2 h-2 rounded-full {$relayHealth ===
                            'green'
                                ? 'bg-green-500'
                                : $relayHealth === 'yellow'
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'}"
                        ></span>
                        <span class="text-xs font-mono text-muted-foreground"
                            >{$relayHealth}</span
                        >
                    </div>

                    <div class="flex flex-col gap-2">
                        {#each $relays as relay}
                            {@const status = $relayStatuses.get(relay.url)}
                            <div
                                class="flex items-center gap-3 py-2 px-3 rounded-md border border-border hover:border-border/80 transition-colors text-sm"
                            >
                                <Checkbox
                                    checked={relay.enabled}
                                    onCheckedChange={() =>
                                        onToggleRelay(relay.url)}
                                />
                                <div class="flex-1 min-w-0">
                                    <span class="font-medium"
                                        >{relay.label || "Custom"}</span
                                    >
                                    <span
                                        class="font-mono text-xs text-muted-foreground ml-2 truncate"
                                        >{relay.url}</span
                                    >
                                </div>
                                <div class="flex items-center gap-2">
                                    {#if status}
                                        <span
                                            class="inline-block w-1.5 h-1.5 rounded-full {status.connected
                                                ? 'bg-green-500'
                                                : 'bg-neutral-300 dark:bg-neutral-600'}"
                                        ></span>
                                    {/if}
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onclick={() => onRemoveRelay(relay.url)}
                                    >
                                        <TrashIcon
                                            class="h-3.5 w-3.5 text-muted-foreground hover:text-destructive"
                                        />
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </FieldSet.Content>
                <FieldSet.Footer>
                    <form onsubmit={onAddRelay} class="flex gap-2 w-full">
                        <Input
                            bind:value={newRelayUrl}
                            placeholder="wss://relay.example.com"
                            class="flex-1 font-mono"
                        />
                        <Button type="submit" variant="outline" size="sm">
                            <PlusIcon class="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                    </form>
                </FieldSet.Footer>
            </FieldSet.Root>
        </Tabs.Content>

        <!-- Trust Tab -->
        <Tabs.Content value="trust">
            <FieldSet.Root>
                <FieldSet.Title>Trusted Pubkeys</FieldSet.Title>
                <FieldSet.Content>
                    <div class="flex items-center gap-3 mb-4">
                        <Switch
                            bind:checked={$showUntrusted}
                            id="show-untrusted"
                        />
                        <Label for="show-untrusted" class="text-sm"
                            >Show untrusted events</Label
                        >
                    </div>

                    <div class="flex flex-col gap-1">
                        {#each [...$trustedPubkeys] as pk}
                            <div
                                class="flex items-center justify-between py-1.5 px-3 rounded-md border border-border hover:border-border/80 transition-colors group"
                            >
                                <code
                                    class="font-mono text-xs text-muted-foreground truncate select-all"
                                    >{pk}</code
                                >
                                <div class="flex items-center gap-1">
                                    <CopyButton
                                        text={pk}
                                        variant="ghost"
                                        size="icon-sm"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onclick={() => untrustPubkey(pk)}
                                    >
                                        <TrashIcon
                                            class="h-3.5 w-3.5 text-muted-foreground hover:text-destructive"
                                        />
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </FieldSet.Content>
                <FieldSet.Footer>
                    <form onsubmit={onAddPubkey} class="flex gap-2 w-full">
                        <Input
                            bind:value={newPubkey}
                            placeholder="64-char hex pubkey"
                            class="flex-1 font-mono"
                        />
                        <Button type="submit" variant="outline" size="sm">
                            <PlusIcon class="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                    </form>
                </FieldSet.Footer>
            </FieldSet.Root>
        </Tabs.Content>
    </Tabs.Root>
</div>
