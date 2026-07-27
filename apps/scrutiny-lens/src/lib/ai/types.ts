/**
 * AI Chat types — Citation, ChatMessage, ChatSession, request/response types.
 */

// ---------------------------------------------------------------------------
// Citation (Claim Ledger entry)
// ---------------------------------------------------------------------------

export interface Citation {
    /** The factual claim made in the AI answer. */
    claim: string;
    /** The SCRUTINY event ID sourcing this claim. */
    eventId: string;
    /** Direct quote from the event content. */
    quote: string;
}

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    citations?: Citation[];
    timestamp: number;
}

// ---------------------------------------------------------------------------
// Chat session
// ---------------------------------------------------------------------------

export interface ChatSession {
    id: string;
    messages: ChatMessage[];
    /** Event IDs loaded as context for this session. */
    contextEventIds: string[];
    createdAt: number;
}

// ---------------------------------------------------------------------------
// API request/response
// ---------------------------------------------------------------------------

export interface ChatRequest {
    question: string;
    /** JSON-serialized array of SCRUTINY events. */
    contextEvents: string;
    /** JSON-serialized prior conversation turns. */
    history: string;
}

export interface ChatResponse {
    answer: string;
    citations: Citation[];
}
