// src/lib/stores/theme.ts
// Dark mode theme store with localStorage persistence

import { writable } from 'svelte/store';

const STORAGE_KEY = 'scrutiny_theme';

type Theme = 'light' | 'dark' | 'system';

function getInitialTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const effectiveTheme = theme === 'system' ? getSystemPreference() : theme;
  
  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

const initial = typeof window !== 'undefined' ? getInitialTheme() : 'system';

export const themeStore = writable<Theme>(initial);

// Apply theme on change and persist
themeStore.subscribe((theme) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }
});

// Listen for system preference changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    themeStore.update((current) => {
      if (current === 'system') {
        applyTheme('system');
      }
      return current;
    });
  });
  
  // Apply initial theme
  applyTheme(initial);
}

export function toggleTheme(): void {
  themeStore.update((current) => {
    if (current === 'light') return 'dark';
    if (current === 'dark') return 'system';
    return 'light';
  });
}

export function setTheme(theme: Theme): void {
  themeStore.set(theme);
}
