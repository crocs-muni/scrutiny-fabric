<script lang="ts">
  import {
    relaysStore,
    relayStatuses,
    connectedRelayCount,
    totalRelayCount,
    DEFAULT_RELAYS,
  } from '$lib/nostr/publisher';

  // Props
  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  // State for adding new relay
  let newRelayUrl = $state('');
  let addError = $state('');

  function handleAddRelay() {
    addError = '';
    const trimmed = newRelayUrl.trim();

    if (!trimmed) {
      addError = 'Please enter a relay URL';
      return;
    }

    // Basic URL validation
    if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) {
      if (trimmed.includes('://') && !trimmed.startsWith('wss://')) {
        addError = 'Relay URL must use wss:// protocol';
        return;
      }
    }

    const added = relaysStore.addRelay(trimmed);
    if (added) {
      newRelayUrl = '';
    } else {
      addError = 'Relay already exists';
    }
  }

  function handleRemoveRelay(url: string) {
    relaysStore.removeRelay(url);
  }

  function handleResetToDefaults() {
    if (confirm('Reset to default relays? This will remove any custom relays you added.')) {
      relaysStore.resetToDefaults();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  function getStatusColor(url: string): string {
    const status = $relayStatuses[url];
    if (!status) return 'bg-gray-400';
    switch (status.status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  }

  function getStatusText(url: string): string {
    const status = $relayStatuses[url];
    if (!status) return 'Not connected';
    switch (status.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return status.error || 'Error';
      default:
        return 'Disconnected';
    }
  }

  function isDefaultRelay(url: string): boolean {
    return DEFAULT_RELAYS.includes(url);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    role="presentation"
    onclick={handleBackdropClick}
  >
    <!-- Modal -->
    <div
      class="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relay-modal-title"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div class="flex items-center gap-3">
          <span class="text-xl">📡</span>
          <div>
            <h2 id="relay-modal-title" class="text-lg font-semibold">Relay Configuration</h2>
            <p class="text-sm text-[var(--muted-foreground)]">
              {$connectedRelayCount}/{$totalRelayCount} relays connected
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={onclose}
          class="p-2 rounded-md hover:bg-[var(--accent)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- Relay list -->
        <div class="space-y-2">
          {#each $relaysStore as url}
            <div class="flex items-center gap-3 p-3 bg-[var(--muted)] rounded-md">
              <!-- Status indicator -->
              <span
                class="w-2.5 h-2.5 rounded-full flex-shrink-0 {getStatusColor(url)}"
                title={getStatusText(url)}
              ></span>

              <!-- Relay URL and status -->
              <div class="flex-1 min-w-0">
                <p class="font-mono text-sm truncate" title={url}>{url}</p>
                <p class="text-xs text-[var(--muted-foreground)]">{getStatusText(url)}</p>
              </div>

              <!-- Default badge -->
              {#if isDefaultRelay(url)}
                <span class="text-xs px-2 py-1 bg-[var(--accent)] rounded text-[var(--muted-foreground)] flex-shrink-0">
                  default
                </span>
              {/if}

              <!-- Remove button -->
              <button
                type="button"
                onclick={() => handleRemoveRelay(url)}
                class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors flex-shrink-0 text-lg font-light"
                title="Remove relay"
              >
                ×
              </button>
            </div>
          {/each}

          {#if $relaysStore.length === 0}
            <div class="text-center py-8 text-[var(--muted-foreground)]">
              <p class="text-lg mb-2">No relays configured</p>
              <p class="text-sm">Add a relay below or reset to defaults.</p>
            </div>
          {/if}
        </div>

        <!-- Add relay form -->
        <div class="mt-6">
          <label for="new-relay-input" class="block text-sm font-medium mb-2">Add New Relay</label>
          <div class="flex gap-2">
            <input
              id="new-relay-input"
              type="text"
              bind:value={newRelayUrl}
              placeholder="wss://relay.example.com"
              class="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              onkeydown={(e) => e.key === 'Enter' && handleAddRelay()}
            />
            <button
              type="button"
              onclick={handleAddRelay}
              class="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          </div>
          {#if addError}
            <p class="mt-1 text-xs text-[var(--destructive)]">{addError}</p>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]">
        <button
          type="button"
          onclick={handleResetToDefaults}
          class="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onclick={onclose}
          class="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
