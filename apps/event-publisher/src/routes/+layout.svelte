<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>SCRUTINY Publisher</title>
	<meta name="description" content="Create and publish SCRUTINY protocol events on Nostr" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
	{@render children()}
</div>
