<script lang="ts">
  import { Select } from 'bits-ui';
  import { ChevronDown, Check } from 'lucide-svelte';

  interface Option {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
  }

  interface Props {
    value?: string;
    onValueChange?: (value: string) => void;
    items: readonly Option[];
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
  }

  let {
    value = '',
    onValueChange,
    items,
    placeholder = 'Select an option',
    disabled = false,
    ariaLabel,
  }: Props = $props();

  const selectedLabel = $derived(
    value ? (items as Option[]).find((item) => item.value === value)?.label : placeholder
  );
</script>

<Select.Root
  type="single"
  value={value || undefined}
  onValueChange={onValueChange}
  {disabled}
>
  <Select.Trigger
    class="w-full h-10 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] data-placeholder:text-[var(--muted-foreground)] data-disabled:opacity-50 data-disabled:cursor-not-allowed inline-flex items-center justify-between"
    aria-label={ariaLabel || placeholder}
  >
    <span class="truncate">{selectedLabel}</span>
    <ChevronDown class="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 ml-2" />
  </Select.Trigger>

  <Select.Portal>
    <Select.Content
      class="z-50 min-w-[var(--bits-select-anchor-width)] max-h-[var(--bits-select-content-available-height)] w-[var(--bits-select-anchor-width)] rounded-md border border-[var(--border)] bg-[var(--input)] shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
      sideOffset={5}
    >
      <Select.ScrollUpButton class="flex w-full items-center justify-center py-1">
        <ChevronDown class="w-4 h-4 rotate-180" />
      </Select.ScrollUpButton>

      <Select.Viewport class="p-1">
        {#each items as item (item.value)}
          <Select.Item
            value={item.value}
            label={item.label}
            disabled={item.disabled}
            class="relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] data-highlighted:bg-[var(--muted)] data-disabled:pointer-events-none data-disabled:opacity-50 focus:outline-none focus:bg-[var(--muted)]"
          >
            {#snippet children({ selected })}
              {#if selected}
                <div class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Check class="h-4 w-4" />
                </div>
              {/if}
              {item.label}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>

      <Select.ScrollDownButton class="flex w-full items-center justify-center py-1">
        <ChevronDown class="w-4 h-4" />
      </Select.ScrollDownButton>
    </Select.Content>
  </Select.Portal>
</Select.Root>
