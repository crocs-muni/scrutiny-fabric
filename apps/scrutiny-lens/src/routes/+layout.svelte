<script lang="ts">
	import "../app.css";
	import { ModeWatcher } from "mode-watcher";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import { page } from "$app/stores";
	import { initRelays, relayHealth } from "$lib/stores/relayStore.js";
	import { initTrust } from "$lib/stores/trustStore.js";
	import { destroyNdk } from "$lib/nostr/pool.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";

	let { children } = $props();

	import { untrack } from "svelte";

	$effect(() => {
		untrack(async () => {
			console.log("[SCRUTINY:app] Layout mounted — initializing stores");
			await initRelays();
			await initTrust();
			console.log("[SCRUTINY:app] Initialization complete");
		});

		return () => {
			console.log("[SCRUTINY:app] Layout unmounting — cleaning up pool");
			destroyNdk();
		};
	});

	const navLinks = [
		{ href: "/search", label: "Search" },
		{ href: "/publish", label: "Publish" },
		{ href: "/settings", label: "Settings" },
	];

	function isActive(path: string, href: string): boolean {
		if (href === "/") return path === "/";
		return path.startsWith(href);
	}

	// Dashboard routes get wider layout
	let isDashboard = $derived($page.url.pathname.startsWith("/event/"));
</script>

<ModeWatcher />
<Toaster />

<div class="min-h-screen flex flex-col">
	<!-- Navigation -->
	<header
		class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm"
	>
		<nav
			class="mx-auto flex h-14 items-center justify-between px-6"
			class:max-w-[1920px]={isDashboard}
			class:max-w-[1200px]={!isDashboard}
		>
			<a
				href="/"
				class="font-heading text-lg font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
			>
				SCRUTINY<span class="text-muted-foreground font-normal ml-1"
					>LENS</span
				>
			</a>

			<div class="flex items-center gap-1 text-sm">
				{#each navLinks as { href, label }}
					<a
						{href}
						class="px-3 py-1.5 font-medium transition-colors rounded-md
							{isActive($page.url.pathname, href)
							? 'text-primary bg-primary/5'
							: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
					>
						{label}
					</a>
				{/each}
			</div>
		</nav>
	</header>

	<!-- Relay warning banner -->
	{#if $relayHealth === "red"}
		<div class="px-6 py-2">
			<Alert.Root variant="destructive" class="max-w-[1200px] mx-auto">
				<AlertTriangleIcon class="size-4" />
				<Alert.Title>Relays disconnected</Alert.Title>
				<Alert.Description>Results may be incomplete.</Alert.Description
				>
			</Alert.Root>
		</div>
	{/if}

	<!-- Main content -->
	<main
		class="flex-1 mx-auto w-full px-6"
		class:max-w-[1920px]={isDashboard}
		class:max-w-[1200px]={!isDashboard}
		class:py-8={!isDashboard}
	>
		{@render children()}
	</main>

	<!-- Footer (hidden on dashboard routes) -->
	{#if !isDashboard}
		<div class="crosshatch-divider"></div>
		<footer class="border-t border-border py-6 text-center">
			<p class="text-xs text-muted-foreground font-mono">
				SCRUTINY Fabric Protocol · Open Source
			</p>
		</footer>
	{/if}
</div>
