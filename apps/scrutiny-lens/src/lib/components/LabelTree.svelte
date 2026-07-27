<script lang="ts">
    import type { NostrEvent } from "@scrutiny-fabric/scrutiny-fabric";

    interface Props {
        event: NostrEvent;
        eventType: string | null;
    }

    let { event, eventType }: Props = $props();

    type LabelNode = {
        value?: string;
        children?: Record<string, LabelNode>;
    };

    let labelTree = $derived.by(() => {
        const root: Record<string, LabelNode> = {};

        for (const tag of event.tags) {
            if (tag[0] !== "l") continue;

            const val = tag[1] || "";
            const fqn = tag[2] || "";

            let pathStr = fqn;
            if (
                eventType === "product" &&
                fqn.startsWith("scrutiny:product:")
            ) {
                pathStr = fqn.replace("scrutiny:product:", "");
            } else if (
                eventType === "metadata" &&
                fqn.startsWith("scrutiny:metadata:")
            ) {
                pathStr = fqn.replace("scrutiny:metadata:", "");
            } else if (fqn.startsWith("scrutiny:")) {
                pathStr = fqn.replace("scrutiny:", "");
            }

            const parts = pathStr.split(":").filter(Boolean);
            if (parts.length === 0) continue;

            let current = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {};
                }

                if (i === parts.length - 1) {
                    current[part].value = val;
                } else {
                    if (!current[part].children) {
                        current[part].children = {};
                    }
                    current = current[part].children;
                }
            }
        }

        return root;
    });

    function formatLabel(str: string) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
    }
</script>

{#snippet renderNode(key: string, node: LabelNode, depth: number)}
    {#if node.children && Object.keys(node.children).length > 0}
        {#if depth === 0}
            <h4 class="mt-4 scroll-m-20 text-lg font-semibold tracking-tight">
                {formatLabel(key)}
            </h4>
        {:else if depth === 1}
            <h5
                style="margin-left: {depth * 1.5}rem;"
                class="mt-2 scroll-m-20 text-base font-medium tracking-tight"
            >
                {formatLabel(key)}
            </h5>
        {:else}
            <div
                style="margin-left: {depth * 1.5}rem;"
                class="mt-2 text-sm font-semibold text-muted-foreground tracking-tight"
            >
                {formatLabel(key)}
            </div>
        {/if}

        <div class="flex flex-col">
            {#each Object.entries(node.children) as [childKey, childNode]}
                {@render renderNode(childKey, childNode, depth + 1)}
            {/each}
        </div>
    {/if}

    {#if node.value}
        <div
            class="flex justify-between border-b border-dashed border-border py-2 mt-1"
            style="margin-left: {depth * 1.5}rem;"
        >
            <dt class="text-muted-foreground text-sm font-medium">
                {formatLabel(key)}
            </dt>
            <dd class="text-foreground text-sm break-all pl-4 text-right">
                {node.value}
            </dd>
        </div>
    {/if}
{/snippet}

{#if Object.keys(labelTree).length > 0}
    <div class="mt-4">
        <h3
            class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
        >
            Labels
        </h3>
        <dl class="flex flex-col pb-4">
            {#each Object.entries(labelTree) as [key, node]}
                {@render renderNode(key, node, 0)}
            {/each}
        </dl>
    </div>
{/if}
