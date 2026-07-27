/**
 * GET /api/chat/health — liveness of the LLM backend.
 *
 * Reports ok only when the fi-muni gateway key is configured, so the UI's
 * health indicator reflects whether chat will actually work.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { isConfigured, modelName } from '$lib/ai/server.js';

export const GET: RequestHandler = async () => {
    if (!isConfigured()) return error(503, 'LLM gateway not configured');
    return json({ status: 'ok', model: modelName() });
};
