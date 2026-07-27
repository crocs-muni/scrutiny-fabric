/**
 * Session store — current chat session state.
 */

import { writable, get } from 'svelte/store';
import type { ChatMessage, ChatSession } from '../ai/types.js';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const currentSession = writable<ChatSession | null>(null);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create a new chat session with the given context event IDs.
 */
export function createSession(contextEventIds: string[]): void {
    const session: ChatSession = {
        id: crypto.randomUUID(),
        messages: [],
        contextEventIds,
        createdAt: Date.now()
    };
    currentSession.set(session);
}

/**
 * Add a message to the current session.
 */
export function addMessage(message: ChatMessage): void {
    currentSession.update((session) => {
        if (!session) return session;
        return {
            ...session,
            messages: [...session.messages, message]
        };
    });
}

/**
 * Clear the current session.
 */
export function clearSession(): void {
    currentSession.set(null);
}

/**
 * Get the message history for the current session (for context injection).
 */
export function getHistory(): ChatMessage[] {
    const session = get(currentSession);
    return session?.messages ?? [];
}
