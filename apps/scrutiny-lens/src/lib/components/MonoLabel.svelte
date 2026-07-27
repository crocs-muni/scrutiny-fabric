<script lang="ts">
    let { text, class: className = "" } = $props();
</script>

<span
    class="font-mono text-[0.8125rem] leading-relaxed text-muted-foreground select-all {className}"
>
    {text}
</span>
