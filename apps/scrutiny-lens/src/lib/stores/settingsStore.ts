/**
 * Settings store — user preferences.
 */

import { writable } from 'svelte/store';

export const settings = writable({
    /** Whether to show untrusted events in default views. */
    showUntrusted: false,
    /** AI service URL (relative by default, configurable for dev). */
    aiServiceUrl: '/api/chat'
});
