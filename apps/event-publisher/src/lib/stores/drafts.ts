// src/lib/stores/drafts.ts
// Svelte stores for managing draft events (chat-style sessions)

import { writable, derived, get } from 'svelte/store';
import type { EventType, ProductEventFormValues } from '$lib/scrutiny/types';
import { createEmptyProductFormValues } from '$lib/scrutiny/types';

/**
 * Generic draft structure for all event types
 */
export interface Draft<T = unknown> {
  id: string;
  type: EventType;
  title: string;
  lastModified: number; // Unix timestamp in milliseconds
  status: 'draft' | 'published';
  data: T;
}

const STORAGE_KEY = 'scrutiny_drafts_v1';

/**
 * Generate a unique ID for drafts
 */
function generateId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load drafts from localStorage
 */
function loadDrafts(): Draft[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Draft[];
  } catch (e) {
    console.error('Failed to load drafts from localStorage:', e);
    return [];
  }
}

/**
 * Save drafts to localStorage
 */
function saveDrafts(drafts: Draft[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.error('Failed to save drafts to localStorage:', e);
  }
}

// Initialize with saved drafts (only in browser)
const initialDrafts = typeof window !== 'undefined' ? loadDrafts() : [];

// Ensure a deterministic initial selection when drafts already exist
const initialCurrentDraftId = initialDrafts.length > 0 ? initialDrafts[0].id : null;

/**
 * Main store for all drafts
 */
export const draftsStore = writable<Draft[]>(initialDrafts);

// Auto-save to localStorage whenever drafts change
draftsStore.subscribe((value) => {
  if (typeof window !== 'undefined') {
    saveDrafts(value);
  }
});

/**
 * Currently selected draft ID
 */
export const currentDraftId = writable<string | null>(initialCurrentDraftId);

function ensureCurrentDraftSelection(): void {
  const drafts = get(draftsStore);
  const current = get(currentDraftId);

  if (!drafts.some((draft) => draft.id === current)) {
    currentDraftId.set(drafts[0]?.id ?? null);
  }
}

/**
 * Derived store for the currently selected draft
 */
export const currentDraft = derived(
  [draftsStore, currentDraftId],
  ([$draftsStore, $currentDraftId]) =>
    $draftsStore.find((d) => d.id === $currentDraftId) ?? null
);

/**
 * Create a new ProductEvent draft and add it to the store
 * @returns The newly created draft
 */
export function createProductDraft(): Draft<ProductEventFormValues> {
  const draft: Draft<ProductEventFormValues> = {
    id: generateId(),
    type: 'product',
    title: 'Untitled Product',
    lastModified: Date.now(),
    status: 'draft',
    data: createEmptyProductFormValues(),
  };

  draftsStore.update((drafts) => [draft, ...drafts]);
  currentDraftId.set(draft.id);

  return draft;
}

/**
 * Set the current draft by ID
 */
export function setCurrentDraft(id: string | null): void {
  currentDraftId.set(id);
}

/**
 * Update the currently selected draft's data
 * @param updater - Function that receives and modifies the draft data
 */
export function updateCurrentDraft<T extends object>(updater: (data: T) => void): void {
  const id = get(currentDraftId);
  if (!id) return;

  draftsStore.update((drafts) => {
    return drafts.map((draft) => {
      if (draft.id === id) {
        const newData = JSON.parse(JSON.stringify(draft.data)) as T;
        updater(newData);
        return {
          ...draft,
          data: newData,
          lastModified: Date.now(),
        };
      }
      return draft;
    });
  });
}

/**
 * Update the current draft's title
 */
export function updateCurrentDraftTitle(title: string): void {
  const id = get(currentDraftId);
  if (!id) return;

  draftsStore.update((drafts) => {
    return drafts.map((draft) => {
      if (draft.id === id) {
        return {
          ...draft,
          title: title || 'Untitled',
          lastModified: Date.now(),
        };
      }
      return draft;
    });
  });
}

/**
 * Update a draft by ID with new data
 */
export function updateDraft<T>(id: string, data: Partial<Draft<T>>): void {
  draftsStore.update((drafts) => {
    return drafts.map((draft) => {
      if (draft.id === id) {
        return {
          ...draft,
          ...data,
          lastModified: Date.now(),
        };
      }
      return draft;
    });
  });
}

/**
 * Delete a draft by ID
 */
export function deleteDraft(id: string): void {
  const current = get(currentDraftId);

  draftsStore.update((drafts) => drafts.filter((d) => d.id !== id));

  // If we deleted the current draft, clear selection
  if (current === id) {
    const remaining = get(draftsStore);
    currentDraftId.set(remaining.length > 0 ? remaining[0].id : null);
  }
}

/**
 * Mark a draft as published
 */
export function markDraftPublished(id: string): void {
  draftsStore.update((drafts) => {
    return drafts.map((draft) => {
      if (draft.id === id) {
        return {
          ...draft,
          status: 'published' as const,
          lastModified: Date.now(),
        };
      }
      return draft;
    });
  });
}

/**
 * Export all drafts as JSON
 */
export function exportDrafts(): string {
  const drafts = get(draftsStore);
  return JSON.stringify(drafts, null, 2);
}

/**
 * Import drafts from JSON
 * @param json - JSON string containing drafts array
 * @param mode - 'merge' adds to existing, 'replace' clears existing
 */
export function importDrafts(json: string, mode: 'merge' | 'replace' = 'merge'): void {
  try {
    const imported = JSON.parse(json) as Draft[];

    if (!Array.isArray(imported)) {
      throw new Error('Invalid drafts format: expected array');
    }

    if (mode === 'replace') {
      draftsStore.set(imported);
    } else {
      draftsStore.update((existing) => {
        const existingIds = new Set(existing.map((d) => d.id));
        const newDrafts = imported.filter((d) => !existingIds.has(d.id));
        return [...newDrafts, ...existing];
      });
    }

    ensureCurrentDraftSelection();
  } catch (e) {
    console.error('Failed to import drafts:', e);
    throw e;
  }
}
