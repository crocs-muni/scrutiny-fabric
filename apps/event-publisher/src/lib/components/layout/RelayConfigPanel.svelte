<script lang="ts">
  import {
    relaysStore,
    relayStatuses,
    connectedRelayCount,
    totalRelayCount,
    DEFAULT_RELAYS,
  } from '$lib/nostr/publisher';

  // State for adding new relay
  let newRelayUrl = $state('');
  let addError = $state('');

  // Panel visibility
  let isExpanded = $state(false);

  function handleAddRelay() {
    addError = '';
    const trimmed = newRelayUrl.trim();

    if (!trimmed) {
      addError = 'Please enter a relay URL';
      return;
    }

    // Basic URL validation
    if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) {
      // Will be normalized by the store, but warn about non-wss
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

<div class="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
  <!-- Header - clickable to expand/collapse -->
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[hsl(var(--accent))] transition-colors rounded-t-lg"
  >
    <div class="flex items-center gap-3">
      <span class="text-lg">📡</span>
      <div>
        <h3 class="font-medium text-sm">Relay Configuration</h3>
        <p class="text-xs text-[hsl(var(--muted-foreground))]">
          {$connectedRelayCount}/{$totalRelayCount} connected
        </p>
      </div>
    </div>
    <span class="text-[hsl(var(--muted-foreground))] transition-transform {isExpanded ? 'rotate-180' : ''}">
      ▼
    </span>
  </button>

  <!-- Expandable content -->
  {#if isExpanded}
    <div class="px-4 pb-4 border-t border-[hsl(var(--border))]">
      <!-- Relay list -->
      <div class="mt-3 space-y-2">
        {#each $relaysStore as url}
          <div class="flex items-center gap-2 p-2 bg-[hsl(var(--muted))] rounded-md text-sm">
            <!-- Status indicator -->
            <span
              class="w-2 h-2 rounded-full flex-shrink-0 {getStatusColor(url)}"
              title={getStatusText(url)}
            ></span>

            <!-- Relay URL -->
            <span class="flex-1 font-mono text-xs truncate" title={url}>
              {url}
            </span>

            <!-- Default badge -->
            {#if isDefaultRelay(url)}
              <span class="text-xs px-1.5 py-0.5 bg-[hsl(var(--accent))] rounded text-[hsl(var(--muted-foreground))]">
                default
              </span>
            {/if}

            <!-- Remove button -->
            <button
              type="button"
              onclick={() => handleRemoveRelay(url)}
              class="p-1 text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
              title="Remove relay"
            >
              ✕
            </button>
          </div>
        {/each}

        {#if $relaysStore.length === 0}
          <p class="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
            No relays configured. Add one below or reset to defaults.
          </p>
        {/if}
      </div>

      <!-- Add relay form -->
      <div class="mt-4">
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newRelayUrl}
            placeholder="wss://relay.example.com"
            class="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            onkeydown={(e) => e.key === 'Enter' && handleAddRelay()}
          />
          <button
            type="button"
            onclick={handleAddRelay}
            class="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
        {#if addError}
          <p class="mt-1 text-xs text-red-500">{addError}</p>
        {/if}
      </div>

      <!-- Reset to defaults -->
      <div class="mt-4 pt-3 border-t border-[hsl(var(--border))]">
        <button
          type="button"
          onclick={handleResetToDefaults}
          class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Reset to default relays
        </button>
      </div>
    </div>
  {/if}
</div>
