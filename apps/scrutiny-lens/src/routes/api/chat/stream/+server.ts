/**
 * SvelteKit server route — proxy POST /api/chat/stream to Python AI service.
 *
 * Forwards the request to FastAPI /chat/stream and pipes the SSE response
 * body directly back to the browser without buffering.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
const MAX_BODY_SIZE = 512 * 1024; // 512 KB
const MAX_QUESTION_LENGTH = 2000;

export const POST: RequestHandler = async ({ request }) => {
    // Enforce content-length before parsing body
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
        return error(413, 'Request body too large');
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return error(400, 'Invalid JSON body');
    }

    const { question, contextEvents, history } = body as {
        question?: string;
        contextEvents?: string;
        history?: string;
    };

    if (!question || typeof question !== 'string') {
        return error(400, 'Missing or invalid "question" field');
    }
    if (question.length > MAX_QUESTION_LENGTH) {
        return error(400, `Question too long (max ${MAX_QUESTION_LENGTH} chars)`);
    }
    if (contextEvents !== undefined && typeof contextEvents !== 'string') {
        return error(400, 'Invalid "contextEvents" field');
    }
    if (contextEvents) {
        try {
            JSON.parse(contextEvents);
        } catch {
            return error(400, '"contextEvents" is not valid JSON');
        }
    }

    // Parse history separately — gives a proper 400 instead of falling through
    // to a 502 "AI service unavailable" when it's malformed client data.
    let historyParsed: unknown[] = [];
    if (history) {
        try {
            historyParsed = JSON.parse(history as string);
        } catch {
            return error(400, '"history" is not valid JSON');
        }
    }

    // Forward to AI service with a generous timeout that covers streaming latency.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min

    let upstream: Response;
    try {
        upstream = await fetch(`${AI_SERVICE_URL}/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                context_events: contextEvents || '[]',
                history: historyParsed
            }),
            signal: controller.signal
        });
    } catch (err) {
        clearTimeout(timeout);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        return error(isAbort ? 504 : 502, isAbort ? 'AI service timed out' : 'AI service unavailable');
    }

    if (!upstream.ok) {
        clearTimeout(timeout);
        const text = await upstream.text().catch(() => 'AI service error');
        return error(upstream.status >= 500 ? 502 : upstream.status, text);
    }

    // Pipe the SSE body stream directly to the browser.
    // clearTimeout is handled when the stream closes.
    const body2 = upstream.body;
    if (!body2) {
        clearTimeout(timeout);
        return error(502, 'AI service returned empty stream');
    }

    const piped = new ReadableStream({
        async start(controller2) {
            const reader = body2.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller2.enqueue(value);
                }
                controller2.close();
            } catch (e) {
                controller2.error(e);
            } finally {
                clearTimeout(timeout);
                reader.releaseLock();
            }
        },
        cancel() {
            clearTimeout(timeout);
            body2.cancel();
        }
    });

    return new Response(piped, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // disable nginx buffering if present
        }
    });
};
