// src/lib/stores/network.ts
// Network/offline status store

import { writable, derived } from 'svelte/store';

function setOnlineStatus(value: boolean) {
  isOnline.set(value);
}

function getInitialOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export const isOnline = writable<boolean>(getInitialOnlineStatus());

// Set up event listeners for online/offline events (browser only)
if (typeof window !== 'undefined') {
  // Initial sync after hydration
  setOnlineStatus(navigator.onLine);

  window.addEventListener('online', () => {
    setOnlineStatus(true);
  });
  
  window.addEventListener('offline', () => {
    setOnlineStatus(false);
  });

  // Re-check when tab visibility changes (covers some OS resume cases)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setOnlineStatus(navigator.onLine);
    }
  });
}

// Derived store for offline warning message
export const offlineWarning = derived(isOnline, ($isOnline) => 
  $isOnline ? null : 'You appear to be offline. Events will be saved as drafts but cannot be published.'
);
