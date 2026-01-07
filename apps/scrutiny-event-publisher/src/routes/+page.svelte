<script lang="ts">
  import SidebarDrafts from '$lib/components/layout/SidebarDrafts.svelte';
  import EventSummaryPanel from '$lib/components/layout/EventSummaryPanel.svelte';
  import RelayConfigModal from '$lib/components/layout/RelayConfigModal.svelte';
  import ProductEventForm from '$lib/components/forms/ProductEventForm.svelte';
  import { currentDraft } from '$lib/stores/drafts';
  import { themeStore, toggleTheme } from '$lib/stores/theme';
  import { isOnline, offlineWarning } from '$lib/stores/network';
  import { nostrStatus, nostrPubkey, formatPubkeyShort, recheckNostrExtension } from '$lib/nostr/signer';
  import { connectedRelayCount, totalRelayCount } from '$lib/nostr/publisher';
  import { ScrollArea } from 'bits-ui';
  import { Moon, Sun, Monitor } from 'lucide-svelte';

  // Modal state
  let showRelayModal = $state(false);

  // NIP-07 status display
  function getNip07StatusColor(status: string): string {
    if (status === 'available') return 'bg-green-500';
    if (status === 'checking') return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function getNip07StatusText(status: string, pubkey: string | null): string {
    if (status === 'checking') return 'Checking...';
    if (status === 'available' && pubkey) return `Connected: ${formatPubkeyShort(pubkey)}`;
    return 'Extension not found';
  }

  // Relay status helpers
  function getRelayStatusColor(connected: number, total: number): string {
    if (total === 0) return 'bg-gray-400';
    if (connected === 0) return 'bg-red-500';
    if (connected < total) return 'bg-yellow-500';
    return 'bg-green-500';
  }
</script>

<div class="flex h-screen overflow-hidden">
  <!-- Left Sidebar: Draft list -->
  <div class="w-64 flex-shrink-0">
    <SidebarDrafts />
  </div>

  <!-- Right side: Header + Center and Right columns -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Offline warning banner (full width) -->
    {#if $offlineWarning}
      <div class="flex-shrink-0 px-4 py-2 bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-sm flex items-center gap-2">
        <span>⚠️</span>
        <span>{$offlineWarning}</span>
      </div>
    {/if}

    <!-- Header bar (spans both center and right) -->
    <header class="flex-shrink-0 px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">SCRUTINY Event Publisher</h1>
        <p class="text-sm text-[var(--muted-foreground)]">
          Create and publish SCRUTINY protocol events on Nostr
        </p>
      </div>

      <!-- Status indicators and controls -->
      <div class="flex items-center gap-4">
        <!-- Theme toggle -->
        <button
          onclick={toggleTheme}
          class="p-2 rounded-md hover:bg-[var(--accent)] transition-colors"
          title="Toggle theme ({$themeStore})"
        >
          {#if $themeStore === 'dark'}
            <Moon class="w-5 h-5" />
          {:else if $themeStore === 'light'}
            <Sun class="w-5 h-5" />
          {:else}
            <Monitor class="w-5 h-5" />
          {/if}
        </button>

        <!-- Online/Offline indicator -->
        <div class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full {$isOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
          <span class="text-[var(--muted-foreground)]">{$isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <!-- NIP-07 Status indicator -->
        <button
          onclick={recheckNostrExtension}
          class="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)] hover:bg-[var(--accent)] cursor-pointer transition-colors"
          title="Click to recheck NIP-07 extension"
        >
          <span class="w-2 h-2 rounded-full {getNip07StatusColor($nostrStatus)}"></span>
          <span>
            NIP-07: {getNip07StatusText($nostrStatus, $nostrPubkey)}
          </span>
        </button>

        <!-- Relay Status indicator (opens modal) -->
        <button
          onclick={() => (showRelayModal = true)}
          class="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)] hover:bg-[var(--accent)] cursor-pointer transition-colors"
          title="Click to configure relays"
        >
          <span class="w-2 h-2 rounded-full {getRelayStatusColor($connectedRelayCount, $totalRelayCount)}"></span>
          <span>
            Relays: {$connectedRelayCount}/{$totalRelayCount}
          </span>
        </button>
      </div>
    </header>

    <!-- Content area: Center (form) + Right (preview) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Center Column: Form section (scrollable) -->
      <ScrollArea.Root class="flex-1">
        <ScrollArea.Viewport class="h-full p-6">
          {#if $currentDraft}
            {#if $currentDraft.type === 'product'}
              <ProductEventForm />
            {:else}
              <div class="text-center py-12 text-[var(--muted-foreground)]">
                <p class="text-lg">Form for "{$currentDraft.type}" events coming soon.</p>
              </div>
            {/if}
          {:else}
            <div class="text-center py-12 text-[var(--muted-foreground)]">
              <p class="text-lg mb-4">No draft selected</p>
              <p class="text-sm">Create a new event from the sidebar to get started.</p>
            </div>
          {/if}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" class="flex w-2.5 touch-none select-none border-l border-l-transparent p-px transition-all">
          <ScrollArea.Thumb class="bg-[var(--muted-foreground)] flex-1 rounded-full" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      <!-- Right Panel: Preview (fixed width) -->
      <div class="w-80 flex-shrink-0">
        <EventSummaryPanel />
      </div>
    </div>
  </div>
</div>

<!-- Relay Configuration Modal -->
<RelayConfigModal open={showRelayModal} onclose={() => (showRelayModal = false)} />
