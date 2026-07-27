import { defineConfig } from 'jsrepo';

export default defineConfig({
    // configure where stuff comes from here
    registries: [],
    // configure where stuff goes here
    paths: {
		ui: '$lib/components/ui',
		lib: '$lib',
		hook: '$lib/hooks'
	},
});