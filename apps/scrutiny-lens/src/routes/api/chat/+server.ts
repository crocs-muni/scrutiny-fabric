/**
 * POST /api/chat — non-streaming, grounded chat against the fi-muni LLM gateway.
 *
 * Validates the request, then calls the fi-muni OpenAI-compatible gateway
 * directly (no separate AI service). Returns { answer, citations } where each
 * citation is grounded in one of the supplied SCRUTINY events.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { answerFromEvents } from '$lib/ai/server.js';

const MAX_BODY_SIZE = 512 * 1024; // 512KB
const MAX_QUESTION_LENGTH = 2000;

export const POST: RequestHandler = async ({ request }) => {
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

    let parsedHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    if (history !== undefined) {
        if (typeof history !== 'string') {
            return error(400, 'Invalid "history" field');
        }
        try {
            const h = JSON.parse(history);
            if (Array.isArray(h)) parsedHistory = h;
        } catch {
            return error(400, '"history" is not valid JSON');
        }
    }

    try {
        const result = await answerFromEvents({
            question,
            contextEvents: contextEvents || '[]',
            history: parsedHistory
        });
        return json(result);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'LLM request failed';
        console.error('[SCRUTINY:ai] /api/chat failed:', msg);
        if (msg.includes('not configured')) return error(503, 'LLM gateway not configured');
        return error(502, `LLM gateway error: ${msg}`);
    }
};
