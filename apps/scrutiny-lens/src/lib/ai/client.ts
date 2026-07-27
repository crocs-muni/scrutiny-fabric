/**
 * AI chat client — fetch wrapper for /api/chat proxy route.
 *
 * Supports both non-streaming and SSE streaming modes.
 */

import type { ChatRequest, ChatResponse, Citation } from './types.js';

// ---------------------------------------------------------------------------
// Non-streaming
// ---------------------------------------------------------------------------

/**
 * Send a chat message and receive the full response.
 */
export async function sendChatMessage(
    request: ChatRequest,
    baseUrl = '/api/chat'
): Promise<ChatResponse> {
    console.log('[SCRUTINY:ai] Sending chat message', { question: request.question.slice(0, 60) + '…', baseUrl });
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });

    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        console.error('[SCRUTINY:ai] Chat request failed:', res.status, text);
        throw new Error(`Chat request failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    console.log('[SCRUTINY:ai] Chat response received', { answerLength: data.answer?.length, citations: data.citations?.length });

    // Map snake_case API response to camelCase Citation interface
    const citations: Citation[] = (data.citations ?? []).map((c: Record<string, string>) => ({
        claim: c.claim,
        eventId: c.event_id ?? c.eventId,
        quote: c.quote,
    }));

    return { answer: data.answer, citations };
}

// ---------------------------------------------------------------------------
// SSE streaming
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
    onToken: (token: string) => void;
    onCitations: (citations: Citation[]) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
}

/**
 * Send a chat message and stream the response via SSE.
 * Returns an abort function.
 */
export function streamChatMessage(
    request: ChatRequest,
    callbacks: StreamCallbacks,
    baseUrl = '/api/chat/stream'
): { abort: () => void } {
    const controller = new AbortController();

    (async () => {
        try {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal
            });

            if (!res.ok) {
                const text = await res.text().catch(() => 'Unknown error');
                throw new Error(`Stream request failed (${res.status}): ${text}`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            callbacks.onComplete();
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.token) {
                                callbacks.onToken(parsed.token);
                            }
                            if (parsed.citations) {
                                callbacks.onCitations(parsed.citations);
                            }
                        } catch {
                            // Skip malformed SSE data
                        }
                    }
                }
            }

            callbacks.onComplete();
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            callbacks.onError(err instanceof Error ? err : new Error(String(err)));
        }
    })();

    return { abort: () => controller.abort() };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Check if the AI service is available.
 */
export async function checkAiHealth(baseUrl = '/api/chat'): Promise<boolean> {
    try {
        console.log('[SCRUTINY:ai] Checking health at', `${baseUrl}/health`);
        const res = await fetch(`${baseUrl}/health`, { method: 'GET' });
        const ok = res.ok;
        console.log('[SCRUTINY:ai] Health check:', ok ? '✅ available' : '❌ unhealthy');
        return ok;
    } catch {
        console.warn('[SCRUTINY:ai] Health check: ❌ unreachable');
        return false;
    }
}
