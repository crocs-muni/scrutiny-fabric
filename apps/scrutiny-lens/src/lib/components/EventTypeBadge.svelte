<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";

    type EventType =
        | "product"
        | "metadata"
        | "binding"
        | "update"
        | "retract"
        | string;

    let { type, class: className = "" }: { type: EventType; class?: string } =
        $props();

    const labels: Record<string, string> = {
        product: "PRODUCT",
        metadata: "METADATA",
        binding: "BINDING",
        update: "UPDATE",
        retract: "RETRACT",
    };

    const colors: Record<string, string> = {
        product: "border-primary/40 text-primary bg-primary/5",
        metadata: "border-muted-foreground/30 text-muted-foreground bg-muted",
        binding: "border-primary/25 text-primary/70 bg-primary/5",
        update: "border-yellow-600/30 text-yellow-700 bg-yellow-50 dark:border-yellow-400/30 dark:text-yellow-400 dark:bg-yellow-400/5",
        retract: "border-destructive/30 text-destructive bg-destructive/5",
    };
</script>

<Badge
    variant="outline"
    class="font-mono text-[0.6875rem] tracking-wider px-2 py-0.5 rounded {colors[
        type
    ] ?? 'border-border text-muted-foreground'} {className}"
>
    {labels[type] ?? type.toUpperCase()}
</Badge>
