/**
 * fi-muni LLM call — grounded, structured Q&A for the Claim Ledger.
 *
 * Server-only. Calls the fi-muni OpenAI-compatible gateway and returns an
 * answer plus citations, grounded ONLY on the supplied SCRUTINY events.
 *
 * The fi-muni gateway does not reliably enforce JSON-schema structured output,
 * so we ask for JSON in the prompt, then parse tolerantly and validate with
 * Zod. If the model's output can't be parsed into the Claim Ledger shape we
 * degrade gracefully (return the prose answer with no citations) rather than
 * failing the request — the frontend contract { answer, citations } always holds.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const BASE_URL = env.FI_MUNI_BASE_URL || 'https://llm.fi.muni.cz/v1';
const MODEL = env.LLM_MODEL || 'qwen3.5-122b';

const citationSchema = z.object({
    claim: z.string().optional().default(''),
    eventId: z.string().optional().default(''),
    quote: z.string().optional().default('')
});

const answerSchema = z.object({
    answer: z.string(),
    citations: z.array(citationSchema).optional().default([])
});

export interface LlmAnswer {
    answer: string;
    citations: { claim: string; eventId: string; quote: string }[];
}

const SYSTEM = `You are SCRUTINY Lens, an assistant that answers questions about security certification events (Common Criteria certificates and their related metadata, bindings, and patches).

Grounding rules:
- Answer ONLY using the SCRUTINY events provided in the context. Do not use outside knowledge.
- If the provided events do not contain the answer, say so plainly. Do not speculate or fill gaps.
- Quotes must be copied exactly from the event content or tags. Never invent an event id or a quote.

Output format (IMPORTANT):
Respond with ONLY a single JSON object and nothing else — no markdown fences, no commentary before or after. Use exactly this shape:
{"answer":"<your answer as plain text>","citations":[{"claim":"<one factual claim from your answer>","eventId":"<the source event id>","quote":"<short verbatim quote from that event>"}]}
Include one citation entry per factual claim. If the events do not support an answer, set "answer" to a brief explanation and "citations" to [].`;

/** True when the gateway key is present; used by the health route. */
export function isConfigured(): boolean {
    return Boolean(env.FI_MUNI_API_KEY);
}

export function modelName(): string {
    return MODEL;
}

/**
 * Pull a JSON object out of a model response that may be wrapped in markdown
 * fences or padded with prose, and validate it into the Claim Ledger shape.
 * Returns null if no valid answer object can be recovered.
 */
function parseAnswer(text: string): LlmAnswer | null {
    let candidate = text.trim();

    // Strip a leading ```json / ``` fence and trailing ``` if present.
    const fence = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fence) candidate = fence[1].trim();

    // Otherwise slice from the first { to the last } (drops surrounding prose).
    if (!candidate.startsWith('{')) {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start === -1 || end <= start) return null;
        candidate = candidate.slice(start, end + 1);
    }

    let raw: unknown;
    try {
        raw = JSON.parse(candidate);
    } catch {
        return null;
    }

    const result = answerSchema.safeParse(raw);
    if (!result.success) return null;

    // Keep only citations that actually point at something.
    const citations = result.data.citations
        .filter((c) => c.claim && c.eventId)
        .map((c) => ({ claim: c.claim, eventId: c.eventId, quote: c.quote }));

    return { answer: result.data.answer, citations };
}

export async function answerFromEvents(opts: {
    question: string;
    /** JSON string: array of SCRUTINY events (the only allowed source). */
    contextEvents: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<LlmAnswer> {
    const apiKey = env.FI_MUNI_API_KEY;
    if (!apiKey) throw new Error('FI_MUNI_API_KEY is not configured');

    const provider = createOpenAICompatible({ name: 'fi-muni', baseURL: BASE_URL, apiKey });

    const historyText = (opts.history ?? [])
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

    const prompt = [
        historyText && `Prior conversation:\n${historyText}`,
        `SCRUTINY events (the ONLY allowed source):\n${opts.contextEvents}`,
        `Question: ${opts.question}`
    ]
        .filter(Boolean)
        .join('\n\n');

    const { text } = await generateText({
        model: provider(MODEL),
        system: SYSTEM,
        prompt,
        temperature: 0.1
    });

    const parsed = parseAnswer(text);
    if (parsed) return parsed;

    // Graceful degradation: the model answered but not as parseable JSON.
    // Return the prose so the user still gets an answer; the Claim Ledger is
    // simply empty for this turn.
    return { answer: text.trim() || 'No answer was generated.', citations: [] };
}
