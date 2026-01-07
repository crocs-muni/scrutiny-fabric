<script lang="ts">
  import { productEventFormSchema } from '$lib/scrutiny/schemas';
  import type { ProductEventFormValues, ProductStatus } from '$lib/scrutiny/types';
  import { createEmptyProductFormValues } from '$lib/scrutiny/types';
  import {
    PRODUCT_STATUS_OPTIONS,
    FORM_FACTOR_OPTIONS,
    CRYPTO_SUITE_OPTIONS,
    ECC_CURVE_OPTIONS,
    HASH_FUNCTION_OPTIONS,
    CERT_SCHEME_OPTIONS,
    COMMON_CRITERIA_LEVELS,
  } from '$lib/scrutiny/constants';
  import SelectField from '$lib/components/SelectField.svelte';
  import {
    currentDraft,
    updateCurrentDraft,
    updateCurrentDraftTitle,
    markDraftPublished,
  } from '$lib/stores/drafts';
  import { buildProductEvent, generateProductContent } from '$lib/scrutiny/eventBuilder';
  import { nostrStatus, nostrPubkey, signEventTemplate } from '$lib/nostr/signer';
  import { publishToRelays, type PublishResult } from '$lib/nostr/publisher';
  import type { VerifiedEvent } from 'nostr-tools';
  import { DateField, Separator, Collapsible } from 'bits-ui';
  import { ChevronDown } from 'lucide-svelte';
  import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date';
  const inputBase =
    'w-full rounded-md bg-[var(--input)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] placeholder:text-[var(--muted-foreground)]';
  const selectBase = `${inputBase} bg-[var(--background)]`;
  const textareaBase =
    'w-full rounded-md bg-[var(--input)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] placeholder:text-[var(--muted-foreground)]';
  const chipClass = 'text-xs px-2 py-1 rounded bg-[var(--muted)] text-[var(--foreground)]';
  const cardClass = 'bg-[var(--card)] text-[var(--card-foreground)] shadow-sm rounded-xl border border-[var(--border)] p-6 space-y-4';
  let form: ProductEventFormValues = $state(createEmptyProductFormValues());
  let errors: Record<string, string> = $state({});

  // Content editing state
  let isContentManual: boolean = $state(false);
  let manualContent: string = $state('');

  // Derived: auto-generated content based on current form values
  let generatedContent: string = $derived(generateProductContent(form, { isTest: form.isTestMode }));

  // Signing and publishing state
  let signedEvent: VerifiedEvent | null = $state(null);
  let signingError: string | null = $state(null);
  let isSigning: boolean = $state(false);
  let isPublishing: boolean = $state(false);
  let publishResults: Record<string, { ok: boolean; error?: string }> | null = $state(null);

  const todayDate = today(getLocalTimeZone());

  function toDateValue(value?: string): DateValue | undefined {
    if (!value) return undefined;
    try {
      return parseDate(value);
    } catch (err) {
      console.warn('Invalid date string, resetting field', value, err);
      return undefined;
    }
  }

  function toIsoDateString(value?: DateValue): string {
    return value ? value.toString() : '';
  }

  let releaseDateValue: DateValue | undefined = $state();
  let eolDateValue: DateValue | undefined = $state();
  let supportUntilValue: DateValue | undefined = $state();

  // Sync form with current draft when it changes
  $effect(() => {
    if ($currentDraft && $currentDraft.type === 'product') {
      const data = ($currentDraft.data as ProductEventFormValues) || createEmptyProductFormValues();
      // merge defaults to backfill new fields for older drafts
      form = { ...createEmptyProductFormValues(), ...data };
      // Reset signing state when draft changes
      signedEvent = null;
      signingError = null;
      publishResults = null;
      // Reset content state - check if draft had manual content
      if (data.contentOverride && data.contentOverride.trim()) {
        isContentManual = true;
        manualContent = data.contentOverride;
      } else {
        isContentManual = false;
        manualContent = '';
      }
    }
  });

  // Keep Bits UI date fields in sync when drafts load or form resets
  $effect(() => {
    releaseDateValue = toDateValue(form.releaseDate);
    eolDateValue = toDateValue(form.eolDate);
    supportUntilValue = toDateValue(form.supportUntil);
  });

  // Content mode toggle handlers
  function switchToManualContent(): void {
    manualContent = generatedContent;
    isContentManual = true;
    form.contentOverride = manualContent;
    saveToStore();
  }

  function switchToAutoContent(): void {
    isContentManual = false;
    manualContent = '';
    form.contentOverride = '';
    saveToStore();
  }

  function handleManualContentChange(): void {
    form.contentOverride = manualContent;
    saveToStore();
  }

  function toggleTestMode(): void {
    form.isTestMode = !form.isTestMode;
    saveToStore();
  }

  // Validate the form and return whether it's valid
  function validate(): boolean {
    const parseResult = productEventFormSchema.safeParse(form);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      errors = fieldErrors;
      return false;
    }
    errors = {};
    return true;
  }

  // Save form data to the draft store
  function saveToStore(): void {
    updateCurrentDraft<ProductEventFormValues>((data) => {
      Object.assign(data, form);
    });
    // Update draft title based on product name
    if (form.name) {
      updateCurrentDraftTitle(form.name);
    }
  }

  // Handle blur: validate + save
  function handleBlur(): void {
    validate();
    saveToStore();
  }

  function handleReleaseDateChange(value?: DateValue): void {
    releaseDateValue = value;
    form.releaseDate = toIsoDateString(value);
    handleBlur();
  }

  function handleEolDateChange(value?: DateValue): void {
    eolDateValue = value;
    form.eolDate = toIsoDateString(value);
    handleBlur();
  }

  function handleSupportUntilChange(value?: DateValue): void {
    supportUntilValue = value;
    form.supportUntil = toIsoDateString(value);
    handleBlur();
  }

  // Handle form submission (just validation)
  function handleSubmit(): void {
    if (!validate()) {
      console.log('Validation failed', errors);
      return;
    }
    saveToStore();
    // Trigger signing flow
    handlePreviewAndSign();
  }

  // Handle Preview & Sign
  async function handlePreviewAndSign(): Promise<void> {
    // Clear previous state
    signingError = null;
    signedEvent = null;
    publishResults = null;

    // Validate first
    if (!validate()) {
      signingError = 'Please fix validation errors before signing.';
      return;
    }

    // Check NIP-07 availability
    if ($nostrStatus !== 'available') {
      signingError = 'NIP-07 extension not available. Please install a Nostr browser extension (like nos2x or Alby) to sign events.';
      return;
    }

    if (!$nostrPubkey) {
      signingError = 'Could not get public key from NIP-07 extension.';
      return;
    }

    saveToStore();
    isSigning = true;

    try {
      // Build the event template
      const template = buildProductEvent(form, Math.floor(Date.now() / 1000), { isTest: form.isTestMode });

      // Sign using NIP-07
      const signed = await signEventTemplate(template);
      signedEvent = signed;
      console.log('Event signed successfully:', signed);
    } catch (error) {
      signingError = error instanceof Error ? error.message : 'Failed to sign event';
      console.error('Signing error:', error);
    } finally {
      isSigning = false;
    }
  }

  // Handle Publish
  async function handlePublish(): Promise<void> {
    if (!signedEvent) {
      signingError = 'Please sign the event first.';
      return;
    }

    isPublishing = true;
    publishResults = null;

    try {
      const results = await publishToRelays(signedEvent);
      publishResults = results;

      // Check if at least one relay succeeded
      const successCount = Object.values(results).filter((r: PublishResult) => r.ok).length;
      if (successCount > 0 && $currentDraft) {
        markDraftPublished($currentDraft.id);
      }

      console.log('Publish results:', results);
    } catch (error) {
      signingError = error instanceof Error ? error.message : 'Failed to publish event';
      console.error('Publishing error:', error);
    } finally {
      isPublishing = false;
    }
  }

  // Toggle helpers for multi-value fields
  function toggleArrayValue(array: string[], value: string): string[] {
    if (array.includes(value)) {
      return array.filter((v) => v !== value);
    }
    return [...array, value];
  }

  // Compatible With helpers
  let compatibleWithInput: string = $state('');

  function addCompatibleWith(): void {
    const value = compatibleWithInput.trim();
    if (value && /^[a-fA-F0-9]{64}$/.test(value) && !form.compatibleWith.includes(value)) {
      form.compatibleWith = [...form.compatibleWith, value];
      compatibleWithInput = '';
      saveToStore();
    }
  }

  function removeCompatibleWith(index: number): void {
    form.compatibleWith = form.compatibleWith.filter((_, i) => i !== index);
    saveToStore();
  }
</script>

<div class="bg-[var(--background)] text-[var(--foreground)] pb-2">
  <div class="mx-auto max-w-7xl px-6 pb-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.08em] text-[var(--muted-foreground)]">SCRUTINY Event Publisher</p>
        <h1 class="text-2xl font-semibold">Product Event</h1>
      </div>
    </div>

    <Separator.Root class="border-t border-[var(--border)]" />

    <div class="max-w-5xl mx-auto">
      <form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

  <!-- Section: Core Identity (Essential) -->
  <section class={cardClass}>
    <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
      <span>Core Identity</span>
      <span class="text-xs text-[var(--muted-foreground)] font-normal">(Essential)</span>
    </h3>

    <div class="grid gap-4 md:grid-cols-2">
      <!-- Vendor -->
      <div class="space-y-1">
        <label for="vendor" class="block text-sm font-medium">
          Vendor <span class="text-[var(--destructive)]">*</span>
        </label>
        <input
          id="vendor"
          type="text"
          bind:value={form.vendor}
          onblur={handleBlur}
          placeholder="e.g. NXP Semiconductors"
          class={`${inputBase} ${errors.vendor ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
        />
        {#if errors.vendor}
          <p class="text-xs text-[var(--destructive)]">{errors.vendor}</p>
        {/if}
      </div>

      <!-- Product Name -->
      <div class="space-y-1">
        <label for="name" class="block text-sm font-medium">
          Product Name <span class="text-[var(--destructive)]">*</span>
        </label>
        <input
          id="name"
          type="text"
          bind:value={form.name}
          onblur={handleBlur}
          placeholder="e.g. J3A080 Secure Smart Card Controller"
          class={`${inputBase} ${errors.name ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
        />
        {#if errors.name}
          <p class="text-xs text-[var(--destructive)]">{errors.name}</p>
        {/if}
      </div>

      <!-- Version -->
      <div class="space-y-1">
        <label for="version" class="block text-sm font-medium">Version</label>
        <input
          id="version"
          type="text"
          bind:value={form.version}
          onblur={handleBlur}
          placeholder="e.g. 3.0 or Rev 3"
          class={inputBase}
        />
      </div>

      <!-- Category -->
      <div class="space-y-1">
        <label for="category" class="block text-sm font-medium">Category</label>
        <input
          id="category"
          type="text"
          bind:value={form.category}
          onblur={handleBlur}
          placeholder="e.g. smartcard, hsm, library"
          class={inputBase}
        />
      </div>

      <!-- Status -->
      <fieldset class="space-y-1">
        <legend class="text-sm font-medium">Status</legend>
        <SelectField
          value={form.status || ''}
          onValueChange={(val) => (form.status = val as ProductStatus || undefined)}
          items={PRODUCT_STATUS_OPTIONS}
          placeholder="Select status..."
          ariaLabel="Product Status"
        />
      </fieldset>
    </div>
  </section>

  <!-- Section: Lifecycle -->
  <section class={cardClass}>
    <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
      <span>Lifecycle</span>
      <span class="text-xs text-[var(--muted-foreground)] font-normal">(Essential)</span>
    </h3>

    <div class="grid gap-4 md:grid-cols-3">
      <!-- Release Date -->
      <div class="space-y-1">
        <DateField.Root
          value={releaseDateValue}
          placeholder={releaseDateValue ?? todayDate}
          onValueChange={handleReleaseDateChange}
        >
          <DateField.Label class="block text-sm font-medium">Release Date</DateField.Label>
          <DateField.Input
            name="releaseDate"
            class={`w-full rounded-md border px-3 py-2 text-sm bg-[var(--input)] text-[var(--foreground)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:border-[var(--ring)] hover:border-[var(--ring)] transition-colors ${errors.releaseDate ? 'border-[var(--destructive)]' : 'border-[var(--border)]'}`}
          >
            {#snippet children({ segments })}
              {#each segments as { part, value }, i (part + i)}
                {#if part === 'literal'}
                  <DateField.Segment {part} class="px-1 text-[var(--muted-foreground)]">{value}</DateField.Segment>
                {:else}
                  <DateField.Segment
                    {part}
                    class="px-1 py-1 rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 focus:outline-none focus:bg-[var(--muted)] hover:bg-[var(--muted)] aria-[valuetext=Empty]:text-[var(--muted-foreground)] data-[invalid]:text-[var(--destructive)]"
                  >
                    {value}
                  </DateField.Segment>
                {/if}
              {/each}
            {/snippet}
          </DateField.Input>
        </DateField.Root>
        {#if errors.releaseDate}
          <p class="text-xs text-[var(--destructive)]">{errors.releaseDate}</p>
        {/if}
      </div>

      <!-- EOL Date -->
      <div class="space-y-1">
        <DateField.Root
          value={eolDateValue}
          placeholder={eolDateValue ?? todayDate}
          onValueChange={handleEolDateChange}
        >
          <DateField.Label class="block text-sm font-medium">End of Life Date</DateField.Label>
          <DateField.Input
            name="eolDate"
            class={`w-full rounded-md border px-3 py-2 text-sm bg-[var(--input)] text-[var(--foreground)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:border-[var(--ring)] hover:border-[var(--ring)] transition-colors ${errors.eolDate ? 'border-[var(--destructive)]' : 'border-[var(--border)]'}`}
          >
            {#snippet children({ segments })}
              {#each segments as { part, value }, i (part + i)}
                {#if part === 'literal'}
                  <DateField.Segment {part} class="px-1 text-[var(--muted-foreground)]">{value}</DateField.Segment>
                {:else}
                  <DateField.Segment
                    {part}
                    class="px-1 py-1 rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 focus:outline-none focus:bg-[var(--muted)] hover:bg-[var(--muted)] aria-[valuetext=Empty]:text-[var(--muted-foreground)] data-[invalid]:text-[var(--destructive)]"
                  >
                    {value}
                  </DateField.Segment>
                {/if}
              {/each}
            {/snippet}
          </DateField.Input>
        </DateField.Root>
        {#if errors.eolDate}
          <p class="text-xs text-[var(--destructive)]">{errors.eolDate}</p>
        {/if}
      </div>

      <!-- Support Until -->
      <div class="space-y-1">
        <DateField.Root
          value={supportUntilValue}
          placeholder={supportUntilValue ?? todayDate}
          onValueChange={handleSupportUntilChange}
        >
          <DateField.Label class="block text-sm font-medium">Support Until</DateField.Label>
          <DateField.Input
            name="supportUntil"
            class={`w-full rounded-md border px-3 py-2 text-sm bg-[var(--input)] text-[var(--foreground)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:border-[var(--ring)] hover:border-[var(--ring)] transition-colors ${errors.supportUntil ? 'border-[var(--destructive)]' : 'border-[var(--border)]'}`}
          >
            {#snippet children({ segments })}
              {#each segments as { part, value }, i (part + i)}
                {#if part === 'literal'}
                  <DateField.Segment {part} class="px-1 text-[var(--muted-foreground)]">{value}</DateField.Segment>
                {:else}
                  <DateField.Segment
                    {part}
                    class="px-1 py-1 rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 focus:outline-none focus:bg-[var(--muted)] hover:bg-[var(--muted)] aria-[valuetext=Empty]:text-[var(--muted-foreground)] data-[invalid]:text-[var(--destructive)]"
                  >
                    {value}
                  </DateField.Segment>
                {/if}
              {/each}
            {/snippet}
          </DateField.Input>
        </DateField.Root>
        {#if errors.supportUntil}
          <p class="text-xs text-[var(--destructive)]">{errors.supportUntil}</p>
        {/if}
      </div>
    </div>
  </section>

  <!-- Advanced sections (collapsible) -->
  <Collapsible.Root>
    <Collapsible.Trigger
      class="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer group py-2"
    >
      <ChevronDown size={14} class="transition-transform duration-200 group-data-[state=open]:rotate-180" />
      <span>Show Advanced Settings</span>
    </Collapsible.Trigger>
    
    <Collapsible.Content class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
      <div class="pt-4 space-y-6">
        <!-- Section: Identifiers & Discovery -->
    <section class={cardClass}>
      <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
        <span>Identifiers & Discovery</span>
        <span class="text-xs text-[var(--muted-foreground)] font-normal">(Advanced)</span>
      </h3>

      <div class="grid grid-cols-1 gap-4">
        <!-- CPE 2.3 -->
        <div class="space-y-1">
          <label for="cpe23" class="block text-sm font-medium">CPE 2.3</label>
          <input
            id="cpe23"
            type="text"
            bind:value={form.cpe23}
            onblur={handleBlur}
            placeholder="cpe:2.3:h:nxp:j3a080:3:*:*:*:*:*:*:*"
            class={`${inputBase} font-mono ${errors.cpe23 ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.cpe23}
            <p class="text-xs text-[var(--destructive)]">{errors.cpe23}</p>
          {/if}
          <p class="text-xs text-[var(--muted-foreground)]">Common Platform Enumeration identifier</p>
        </div>

        <!-- Package URL -->
        <div class="space-y-1">
          <label for="purl" class="block text-sm font-medium">Package URL (purl)</label>
          <input
            id="purl"
            type="text"
            bind:value={form.purl}
            onblur={handleBlur}
            placeholder="pkg:github/openssl/openssl@3.0.0"
            class={`${inputBase} font-mono ${errors.purl ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.purl}
            <p class="text-xs text-[var(--destructive)]">{errors.purl}</p>
          {/if}
        </div>
      </div>
    </section>

    <!-- Section: Platform & Specs -->
    <section class={cardClass}>
      <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
        <span>Platform & Specifications</span>
        <span class="text-xs text-[var(--muted-foreground)] font-normal">(Advanced)</span>
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Form Factor -->
        <fieldset class="space-y-1">
          <legend class="text-sm font-medium">Form Factor</legend>
          <SelectField
            value={form.formFactor}
            onValueChange={(val) => (form.formFactor = val)}
            items={FORM_FACTOR_OPTIONS}
            placeholder="Select form factor..."
            ariaLabel="Form Factor"
          />
        </fieldset>

        <!-- Chip -->
        <div class="space-y-1">
          <label for="chip" class="block text-sm font-medium">Chip / Processor</label>
          <input
            id="chip"
            type="text"
            bind:value={form.chip}
            onblur={handleBlur}
            placeholder="e.g. NXP SmartMX2"
            class={inputBase}
          />
        </div>

        <!-- Memory RAM -->
        <div class="space-y-1">
          <label for="memoryRam" class="block text-sm font-medium">RAM (bytes)</label>
          <input
            id="memoryRam"
            type="text"
            bind:value={form.memoryRam}
            onblur={handleBlur}
            placeholder="e.g. 10240"
            class={`${inputBase} ${errors.memoryRam ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.memoryRam}
            <p class="text-xs text-[var(--destructive)]">{errors.memoryRam}</p>
          {/if}
        </div>

        <!-- Memory EEPROM -->
        <div class="space-y-1">
          <label for="memoryEeprom" class="block text-sm font-medium">EEPROM (bytes)</label>
          <input
            id="memoryEeprom"
            type="text"
            bind:value={form.memoryEeprom}
            onblur={handleBlur}
            placeholder="e.g. 147456"
            class={`${inputBase} ${errors.memoryEeprom ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.memoryEeprom}
            <p class="text-xs text-[var(--destructive)]">{errors.memoryEeprom}</p>
          {/if}
        </div>

        <!-- JavaCard Version -->
        <div class="space-y-1">
          <label for="javacardVersion" class="block text-sm font-medium">JavaCard Version</label>
          <input
            id="javacardVersion"
            type="text"
            bind:value={form.javacardVersion}
            onblur={handleBlur}
            placeholder="e.g. 3.0.4"
            class={inputBase}
          />
        </div>

        <!-- GlobalPlatform -->
        <div class="space-y-1">
          <label for="globalplatform" class="block text-sm font-medium">GlobalPlatform Version</label>
          <input
            id="globalplatform"
            type="text"
            bind:value={form.globalplatform}
            onblur={handleBlur}
            placeholder="e.g. 2.2.1"
            class={inputBase}
          />
        </div>
      </div>
    </section>

    <!-- Section: Crypto Capabilities -->
    <section class={cardClass}>
      <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
        <span>Cryptographic Capabilities</span>
        <span class="text-xs text-[var(--muted-foreground)] font-normal">(Advanced)</span>
      </h3>

      <div class="space-y-4">
        <!-- Crypto Suites -->
        <fieldset class="space-y-2">
          <legend class="block text-sm font-medium">Supported Algorithms</legend>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Supported Algorithms">
            {#each CRYPTO_SUITE_OPTIONS as suite}
              <button
                type="button"
                onclick={() => { form.cryptoSuites = toggleArrayValue(form.cryptoSuites, suite); saveToStore(); }}
                class="px-3 py-1 text-sm rounded-full border transition-colors
                       {form.cryptoSuites.includes(suite)
                         ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                         : 'border-[var(--border)] hover:bg-[var(--accent)]'}"
              >
                {suite}
              </button>
            {/each}
          </div>
        </fieldset>

        <!-- Max Key Length -->
        <div class="space-y-1 max-w-xs">
          <label for="keyLengthMax" class="block text-sm font-medium">Max Key Length (bits)</label>
          <input
            id="keyLengthMax"
            type="text"
            bind:value={form.keyLengthMax}
            onblur={handleBlur}
            placeholder="e.g. 4096"
            class={`${inputBase} ${errors.keyLengthMax ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.keyLengthMax}
            <p class="text-xs text-[var(--destructive)]">{errors.keyLengthMax}</p>
          {/if}
        </div>

        <!-- ECC Curves -->
        <fieldset class="space-y-2">
          <legend class="block text-sm font-medium">ECC Curves</legend>
          <div class="flex flex-wrap gap-2" role="group" aria-label="ECC Curves">
            {#each ECC_CURVE_OPTIONS as curve}
              <button
                type="button"
                onclick={() => { form.eccCurves = toggleArrayValue(form.eccCurves, curve); saveToStore(); }}
                class="px-3 py-1 text-sm rounded-full border transition-colors
                       {form.eccCurves.includes(curve)
                         ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                         : 'border-[var(--border)] hover:bg-[var(--accent)]'}"
              >
                {curve}
              </button>
            {/each}
          </div>
        </fieldset>

        <!-- Hash Functions -->
        <fieldset class="space-y-2">
          <legend class="block text-sm font-medium">Hash Functions</legend>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Hash Functions">
            {#each HASH_FUNCTION_OPTIONS as hash}
              <button
                type="button"
                onclick={() => { form.hashFunctions = toggleArrayValue(form.hashFunctions, hash); saveToStore(); }}
                class="px-3 py-1 text-sm rounded-full border transition-colors
                       {form.hashFunctions.includes(hash)
                         ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                         : 'border-[var(--border)] hover:bg-[var(--accent)]'}"
              >
                {hash}
              </button>
            {/each}
          </div>
        </fieldset>
      </div>
    </section>

    <!-- Section: Documentation URLs -->
    <section class={cardClass}>
      <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
        <span>Documentation</span>
        <span class="text-xs text-[var(--muted-foreground)] font-normal">(Advanced)</span>
      </h3>

      <div class="grid grid-cols-1 gap-4">
        <!-- Canonical URL -->
        <div class="space-y-1">
          <label for="canonicalUrl" class="block text-sm font-medium">Official Product Page</label>
          <input
            id="canonicalUrl"
            type="url"
            bind:value={form.canonicalUrl}
            onblur={handleBlur}
            placeholder="https://..."
            class={`${inputBase} ${errors.canonicalUrl ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.canonicalUrl}
            <p class="text-xs text-[var(--destructive)]">{errors.canonicalUrl}</p>
          {/if}
        </div>

        <!-- Datasheet URL -->
        <div class="space-y-1">
          <label for="datasheetUrl" class="block text-sm font-medium">Datasheet URL</label>
          <input
            id="datasheetUrl"
            type="url"
            bind:value={form.datasheetUrl}
            onblur={handleBlur}
            placeholder="https://..."
            class={`${inputBase} ${errors.datasheetUrl ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.datasheetUrl}
            <p class="text-xs text-[var(--destructive)]">{errors.datasheetUrl}</p>
          {/if}
        </div>

        <!-- Manual URL -->
        <div class="space-y-1">
          <label for="manualUrl" class="block text-sm font-medium">Manual URL</label>
          <input
            id="manualUrl"
            type="url"
            bind:value={form.manualUrl}
            onblur={handleBlur}
            placeholder="https://..."
            class={`${inputBase} ${errors.manualUrl ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.manualUrl}
            <p class="text-xs text-[var(--destructive)]">{errors.manualUrl}</p>
          {/if}
        </div>

        <!-- SDK URL -->
        <div class="space-y-1">
          <label for="sdkUrl" class="block text-sm font-medium">SDK URL</label>
          <input
            id="sdkUrl"
            type="url"
            bind:value={form.sdkUrl}
            onblur={handleBlur}
            placeholder="https://..."
            class={`${inputBase} ${errors.sdkUrl ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.sdkUrl}
            <p class="text-xs text-[var(--destructive)]">{errors.sdkUrl}</p>
          {/if}
        </div>

        <!-- SBOM URL -->
        <div class="space-y-1">
          <label for="sbomUrl" class="block text-sm font-medium">SBOM URL</label>
          <input
            id="sbomUrl"
            type="url"
            bind:value={form.sbomUrl}
            onblur={handleBlur}
            placeholder="https://..."
            class={`${inputBase} ${errors.sbomUrl ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.sbomUrl}
            <p class="text-xs text-[var(--destructive)]">{errors.sbomUrl}</p>
          {/if}
          <p class="text-xs text-[var(--muted-foreground)]">Software Bill of Materials</p>
        </div>
      </div>
    </section>

    <!-- Section: Certification -->
    <section class={cardClass}>
      <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
        <span>Certification</span>
        <span class="text-xs text-[var(--muted-foreground)] font-normal">(Advanced)</span>
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Cert Scheme -->
        <fieldset class="space-y-1">
          <legend class="text-sm font-medium">Certification Scheme</legend>
          <SelectField
            value={form.certScheme}
            onValueChange={(val) => (form.certScheme = val)}
            items={CERT_SCHEME_OPTIONS}
            placeholder="Select scheme..."
            ariaLabel="Certification Scheme"
          />
          {#if errors.certScheme}
            <p class="text-xs text-[var(--destructive)]">{errors.certScheme}</p>
          {/if}
        </fieldset>

        <!-- Cert ID -->
        <div class="space-y-1">
          <label for="certId" class="block text-sm font-medium">Certificate ID</label>
          <input
            id="certId"
            type="text"
            bind:value={form.certId}
            onblur={handleBlur}
            placeholder="e.g. BSI-DSZ-CC-0505-2011"
            class={inputBase}
          />
        </div>
      </div>

      <!-- Cert Levels -->
      <fieldset class="space-y-2">
        <legend class="block text-sm font-medium">Certification Levels</legend>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Certification Levels">
          {#each COMMON_CRITERIA_LEVELS as level}
            <button
              type="button"
              onclick={() => { form.certLevels = toggleArrayValue(form.certLevels, level); saveToStore(); }}
              class="px-3 py-1 text-sm rounded-full border transition-colors
                     {form.certLevels.includes(level)
                       ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                       : 'border-[var(--border)] hover:bg-[var(--accent)]'}"
            >
              {level}
            </button>
          {/each}
        </div>
      </fieldset>
    </section>

    <!-- Section: Relationships -->
    <section class={cardClass}>
      <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 mt-0 mb-0">
        <span>Relationships</span>
        <span class="text-xs text-[var(--muted-foreground)] font-normal">(Advanced)</span>
      </h3>
      <p class="text-xs text-[var(--muted-foreground)] pb-2 mt-0 mb-0">
        Link this product to other SCRUTINY ProductEvents using their 64-character hex event IDs.
      </p>
      <div class="border-b border-[var(--border)] mb-4"></div>

      <div class="grid grid-cols-1 gap-4">
        <!-- Supersedes -->
        <div class="space-y-1">
          <label for="supersedes" class="block text-sm font-medium">Supersedes</label>
          <input
            id="supersedes"
            type="text"
            bind:value={form.supersedes}
            onblur={handleBlur}
            placeholder="Event ID of older product this replaces..."
            class={`${inputBase} font-mono ${errors.supersedes ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.supersedes}
            <p class="text-xs text-[var(--destructive)]">{errors.supersedes}</p>
          {/if}
          <p class="text-xs text-[var(--muted-foreground)]">This product replaces/supersedes the referenced product</p>
        </div>

        <!-- Successor -->
        <div class="space-y-1">
          <label for="successor" class="block text-sm font-medium">Successor</label>
          <input
            id="successor"
            type="text"
            bind:value={form.successor}
            onblur={handleBlur}
            placeholder="Event ID of newer product that replaces this..."
            class={`${inputBase} font-mono ${errors.successor ? 'border-[var(--destructive)] ring-[var(--destructive)] focus:ring-[var(--destructive)]' : ''}`}
          />
          {#if errors.successor}
            <p class="text-xs text-[var(--destructive)]">{errors.successor}</p>
          {/if}
          <p class="text-xs text-[var(--muted-foreground)]">This product is replaced by the referenced product</p>
        </div>

        <!-- Compatible With -->
        <div class="space-y-2">
          <label for="compatibleWithInput" class="block text-sm font-medium">Compatible With</label>
          <div class="flex gap-2">
            <input
              id="compatibleWithInput"
              type="text"
              bind:value={compatibleWithInput}
              placeholder="Add event ID of compatible product..."
              class={`flex-1 ${inputBase} font-mono`}
            />
            <button
              type="button"
              onclick={addCompatibleWith}
              class="px-3 py-2 text-sm font-medium rounded-md border border-[var(--border)]
                     hover:bg-[var(--accent)] transition-colors"
            >
              Add
            </button>
          </div>
          {#if form.compatibleWith.length > 0}
            <div class="space-y-1">
              {#each form.compatibleWith as compatId, i}
                <div class="flex items-center gap-2 p-2 bg-[var(--muted)]/50 rounded text-xs font-mono">
                  <span class="flex-1 truncate">{compatId}</span>
                  <button
                    type="button"
                    onclick={() => removeCompatibleWith(i)}
                    class="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <p class="text-xs text-[var(--muted-foreground)]">Products that are compatible/interoperable with this one</p>
        </div>
      </div>
    </section>

    <!-- Section: Event Content -->
    <section class={cardClass}>
      <div class="flex items-center justify-between">
        <h3 class="text-xl tracking-tight font-semibold flex items-center gap-2 text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
          <span>Event Content</span>
        </h3>
        <div class="flex items-center gap-2">
          {#if isContentManual}
            <span class="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
              Manual Mode
            </span>
            <button
              type="button"
              onclick={switchToAutoContent}
              class="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
            >
              Reset to Auto
            </button>
          {:else}
            <span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
              Auto-Generated
            </span>
            <button
              type="button"
              onclick={switchToManualContent}
              class="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
            >
              Edit Manually
            </button>
          {/if}
        </div>
      </div>

      <div class="space-y-2">
        {#if isContentManual}
          <!-- Manual mode: editable textarea -->
          <textarea
            bind:value={manualContent}
            onblur={handleManualContentChange}
            rows={8}
            class={`${textareaBase} font-mono min-h-[180px]`}
          ></textarea>
          <p class="text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ Manual mode: Content won't update when you change fields above.
          </p>
        {:else}
          <!-- Auto mode: read-only preview -->
          <div class="relative">
            <pre class="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono
                        bg-[var(--muted)] text-[var(--muted-foreground)] whitespace-pre-wrap
                        min-h-[120px]">{generatedContent}</pre>
          </div>
        {/if}

        <!-- Disclaimer -->
        <p class="text-xs text-[var(--muted-foreground)] leading-relaxed">
          This is the human-readable text of your Nostr event. It's auto-generated from your form fields.
          Manual edits stop syncing with the form.
        </p>
      </div>
    </section>
      </div>
    </Collapsible.Content>
  </Collapsible.Root>

  <!-- Submit section -->
  <div class="pt-4 border-t border-[var(--border)] space-y-4">
    <!-- Validation status and buttons -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-[var(--muted-foreground)]">
        {#if Object.keys(errors).length > 0}
          <span class="text-[var(--destructive)]">⚠ {Object.keys(errors).length} validation error(s)</span>
        {:else}
          <span class="text-green-600">✓ Form is valid</span>
        {/if}
      </div>

      <div class="flex gap-3">
        <button
          type="button"
          onclick={() => validate()}
          class="px-4 py-2 text-sm font-medium rounded-md border border-[var(--border)]
                 hover:bg-[var(--accent)] transition-colors"
        >
          Validate
        </button>
        <button
          type="button"
          onclick={handlePreviewAndSign}
          disabled={isSigning}
          class="px-4 py-2 text-sm font-medium rounded-md
                 bg-[var(--primary)] text-[var(--primary-foreground)]
                 hover:bg-[var(--primary)]/90 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigning ? 'Signing...' : 'Preview & Sign'}
        </button>
        {#if signedEvent}
          <button
            type="button"
            onclick={handlePublish}
            disabled={isPublishing}
            class="px-4 py-2 text-sm font-medium rounded-md
                   bg-green-600 text-white
                   hover:bg-green-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing ? 'Publishing...' : 'Publish to Relays'}
          </button>
        {/if}
      </div>
    </div>

    <!-- Error message -->
    {#if signingError}
      <div class="p-3 rounded-md bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
        <p class="font-medium">Error</p>
        <p>{signingError}</p>
      </div>
    {/if}

    <!-- Signed event preview -->
    {#if signedEvent}
      <div class="space-y-2">
        <h4 class="text-sm font-semibold flex items-center gap-2">
          <span class="text-green-600">✓</span>
          Signed Event
        </h4>
        <div class="p-3 rounded-md bg-[var(--muted)]/50 overflow-x-auto">
          <pre class="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(signedEvent, null, 2)}</pre>
        </div>
      </div>
    {/if}

    <!-- Publish results -->
    {#if publishResults}
      <div class="space-y-2">
        <h4 class="text-sm font-semibold">Publish Results</h4>
        <div class="space-y-1">
          {#each Object.entries(publishResults) as [relay, result]}
            <div class="flex items-center gap-2 text-sm p-2 rounded-md bg-[var(--muted)]/30">
              <span class="w-2 h-2 rounded-full {result.ok ? 'bg-green-500' : 'bg-[var(--destructive)]'}"></span>
              <span class="font-mono text-xs flex-1 truncate">{relay}</span>
              <span class="{result.ok ? 'text-green-600' : 'text-[var(--destructive)]'}">
                {result.ok ? 'OK' : result.error || 'Failed'}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</form>
    </div>
  </div>
</div>
