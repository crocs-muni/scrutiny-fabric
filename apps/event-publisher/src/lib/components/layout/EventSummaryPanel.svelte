<script lang="ts">
  import { currentDraft } from '$lib/stores/drafts';
  import { EVENT_TYPE_CONFIG } from '$lib/scrutiny/constants';
  import { buildProductEvent } from '$lib/scrutiny/eventBuilder';
  import type { ProductEventFormValues } from '$lib/scrutiny/types';
  import { Separator, ScrollArea } from "bits-ui";

  let previewJson = $derived.by(() => {
    if (!$currentDraft) return '// Select or create a draft to see preview';

    if ($currentDraft.type === 'product') {
      const form = $currentDraft.data as ProductEventFormValues;
      const template = buildProductEvent(form, Math.floor(Date.now() / 1000));
      return JSON.stringify(template, null, 2);
    }

    return '// Preview not available for this event type';
  });
</script>

<aside class="sticky top-0 h-screen flex flex-col bg-[var(--card)] border-l border-[var(--border)]">
  <!-- Header -->
  <div class="p-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
    <h2 class="text-sm font-semibold">Event Preview</h2>
    {#if $currentDraft}
      {@const config = EVENT_TYPE_CONFIG[$currentDraft.type]}
      <span class="text-xs px-2 py-1 rounded bg-[var(--accent)] flex items-center gap-1.5">
        {#if typeof config.icon === 'string'}
          {config.icon}
        {:else}
          {@const Icon = config.icon}
          <Icon class="w-3.5 h-3.5" />
        {/if}
        {config.label}
      </span>
    {/if}
  </div>

  <!-- Summary -->
  {#if $currentDraft}
    <div class="p-4 border-b border-[var(--border)] space-y-2 flex-shrink-0">
      <h3 class="text-sm font-medium">Summary</h3>
      <Separator.Root class="bg-[var(--border)] my-2 h-px w-full" />
      <dl class="text-xs space-y-1">
        <div class="flex justify-between">
          <dt class="text-[var(--muted-foreground)]">Title</dt>
          <dd class="font-medium">{$currentDraft.title || 'Untitled'}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-[var(--muted-foreground)]">Status</dt>
          <dd class="font-medium capitalize">{$currentDraft.status}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-[var(--muted-foreground)]">Type</dt>
          <dd class="font-medium capitalize">{$currentDraft.type}</dd>
        </div>
      </dl>
    </div>
  {/if}

  <!-- JSON Preview (scrollable) -->
  <div class="flex-1 overflow-hidden flex flex-col min-h-0">
    <div class="p-3 border-b border-[var(--border)] flex-shrink-0">
      <h3 class="text-sm font-medium">Nostr Event JSON</h3>
    </div>
    <ScrollArea.Root class="flex-1 min-h-0">
      <ScrollArea.Viewport class="h-full">
        <div class="p-3">
          <pre class="text-xs font-mono bg-[var(--muted)] p-3 rounded whitespace-pre-wrap break-all">{previewJson}</pre>
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" class="flex w-2.5 touch-none select-none border-l border-l-transparent p-px transition-all">
        <ScrollArea.Thumb class="bg-[var(--muted-foreground)] flex-1 rounded-full" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" class="flex h-2.5 touch-none select-none border-t border-t-transparent p-px transition-all">
        <ScrollArea.Thumb class="bg-[var(--muted-foreground)] rounded-full" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  </div>
</aside>
