<script lang="ts">
  import {
    draftsStore,
    currentDraftId,
    setCurrentDraft,
    createProductDraft,
    deleteDraft,
    exportDrafts,
    importDrafts,
    currentDraft,
    updateCurrentDraft,
  } from '$lib/stores/drafts';
  import { EVENT_TYPE_CONFIG } from '$lib/scrutiny/constants';
  import { Popover, Switch, ScrollArea } from 'bits-ui';
  import { Terminal } from 'lucide-svelte';
  import type { ProductEventFormValues } from '$lib/scrutiny/types';

  // Test mode state
  let isTestMode = $derived.by(() => {
    if (!$currentDraft || $currentDraft.type !== 'product') return false;
    return ($currentDraft.data as ProductEventFormValues)?.isTestMode || false;
  });

  function toggleTestMode() {
    if (!$currentDraft || $currentDraft.type !== 'product') return;
    updateCurrentDraft<ProductEventFormValues>((data) => {
      data.isTestMode = !data.isTestMode;
    });
  }

  // Format relative time
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  function handleNewProduct() {
    createProductDraft();
  }

  function handleDeleteDraft(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (confirm('Delete this draft?')) {
      deleteDraft(id);
    }
  }

  function handleExport() {
    const data = exportDrafts();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrutiny-drafts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let fileInput: HTMLInputElement;

  function handleImportClick() {
    fileInput?.click();
  }

  function handleImportFile(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const mode = confirm('Replace all existing drafts? (Cancel to merge instead)') ? 'replace' : 'merge';
        importDrafts(content, mode);
        alert(`Drafts imported successfully (${mode} mode)`);
      } catch (err) {
        alert('Failed to import drafts: Invalid file format');
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    target.value = '';
  }
</script>

<!-- Hidden file input for import -->
<input
  type="file"
  accept=".json"
  bind:this={fileInput}
  onchange={handleImportFile}
  class="hidden"
/>

<aside class="h-full flex flex-col bg-[var(--muted)]/30 border-r border-[var(--border)]">
  <!-- Header -->
  <div class="p-4 border-b border-[var(--border)]">
    <h2 class="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
      Drafts
    </h2>
  </div>

  <!-- New Event Button -->
  <div class="p-3 border-b border-[var(--border)]">
    <button
      onclick={handleNewProduct}
      class="w-full px-3 py-2 text-sm font-medium rounded-md
             bg-[var(--primary)] text-[var(--primary-foreground)]
             hover:bg-[var(--primary)]/90 transition-colors
             flex items-center justify-center gap-2"
    >
      <span>+</span>
      <span>New Product Event</span>
    </button>
  </div>

  <!-- Drafts List (scrollable with fixed height) -->
  <ScrollArea.Root class="flex-1 min-h-0">
    <ScrollArea.Viewport class="h-full">
      {#if $draftsStore.length === 0}
        <div class="p-4 text-center text-sm text-[var(--muted-foreground)]">
          No drafts yet.<br />
          Create a new event to get started.
        </div>
      {:else}
        <ul class="py-2">
          {#each $draftsStore as draft (draft.id)}
            {@const config = EVENT_TYPE_CONFIG[draft.type]}
            {@const isSelected = $currentDraftId === draft.id}
            <li class="relative group">
              <button
                onclick={() => setCurrentDraft(draft.id)}
                class="w-full px-3 py-2 pr-8 text-left flex items-center gap-3 hover:bg-[var(--accent)] transition-colors
                       {isSelected ? 'bg-[var(--accent)] border-l-2 border-[var(--primary)]' : ''}"
              >
                <!-- Icon -->
                <span class="flex-shrink-0" title={config.label}>
                  {#if typeof config.icon === 'string'}
                    <span class="text-lg">{config.icon}</span>
                  {:else}
                    {@const Icon = config.icon}
                    <Icon class="w-5 h-5" />
                  {/if}
                </span>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium truncate">
                      {draft.title || 'Untitled'}
                    </span>
                    {#if draft.status === 'published'}
                      <span class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Published
                      </span>
                    {/if}
                  </div>
                  <div class="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {config.label} · {formatRelativeTime(draft.lastModified)}
                  </div>
                </div>

              </button>
              <!-- Delete button (separate from main button to avoid nesting) -->
              <button
                onclick={(e) => handleDeleteDraft(draft.id, e)}
                class="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors opacity-0 group-hover:opacity-100"
                title="Delete draft"
              >
                ✕
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="vertical" class="flex w-2.5 touch-none select-none border-l border-l-transparent p-px transition-all">
      <ScrollArea.Thumb class="bg-[var(--muted-foreground)] flex-1 rounded-full" />
    </ScrollArea.Scrollbar>
  </ScrollArea.Root>

  <!-- Footer with import/export and dev menu -->
  <div class="p-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)] flex items-center justify-between flex-none">
    <!-- Dev menu popover -->
    <Popover.Root>
      <Popover.Trigger
        class="p-1.5 rounded hover:bg-[var(--accent)] transition-colors"
        title="Developer menu"
      >
        <Terminal size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="end"
          sideOffset={8}
          class="z-50 w-56 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-4 shadow-md"
        >
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-[var(--foreground)]">Developer Options</h3>
            <div class="flex items-center justify-between">
              <label for="test-mode-switch" class="text-sm text-[var(--foreground)]">Test Mode</label>
              <Switch.Root
                id="test-mode-switch"
                checked={isTestMode}
                onclick={toggleTestMode}
                disabled={!$currentDraft || $currentDraft.type !== 'product'}
                class="relative h-6 w-11 rounded-full border border-[var(--border)] bg-[var(--muted)] transition-colors data-[state=checked]:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Switch.Thumb class="block h-5 w-5 rounded-full bg-[var(--background)] shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-5" />
              </Switch.Root>
            </div>
            <p class="text-xs text-[var(--muted-foreground)]">Adds #scrutiny_test tag for testing</p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <!-- Import/Export buttons -->
    <div class="flex gap-2">
      <button onclick={handleImportClick} class="hover:underline hover:text-[var(--foreground)] transition-colors">Import</button>
      <span>·</span>
      <button onclick={handleExport} class="hover:underline hover:text-[var(--foreground)] transition-colors">Export</button>
    </div>
  </div>
</aside>
