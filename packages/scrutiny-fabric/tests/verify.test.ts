import { describe, expect, it, vi, afterEach } from 'vitest';
import { verifyArtifactHash } from '../src/verify/index.js';
import { ErrorCode } from '../src/types/index.js';
import { createHash } from 'node:crypto';

// Setup global fetch mock
const originalFetch = global.fetch;

describe('verifyArtifactHash', () => {

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    const createMockStream = (chunks: Uint8Array[]) => {
        let i = 0;
        return {
            getReader: () => ({
                read: async () => {
                    if (i < chunks.length) {
                        return { done: false, value: chunks[i++] };
                    }
                    return { done: true, value: undefined };
                },
                cancel: vi.fn(),
            })
        };
    };

    it('rejects an artifact missing a url', async () => {
        const result = await verifyArtifactHash({ raw: ['imeta'], x: 'abc', extras: {} });
        expect(result.ok).toBe(false);
        expect((result as any).error.issues[0].code).toBe(ErrorCode.VERIFY_MISSING_URL);
    });

    it('rejects an artifact missing an x (hash)', async () => {
        const result = await verifyArtifactHash({ raw: ['imeta'], url: 'http://test', extras: {} });
        expect(result.ok).toBe(false);
        expect((result as any).error.issues[0].code).toBe(ErrorCode.VERIFY_MISSING_HASH);
    });

    it('returns true for a matching hash', async () => {
        const payload = Buffer.from('hello world');
        const hash = createHash('sha256').update(payload).digest('hex');

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockStream([payload]),
        });

        const result = await verifyArtifactHash({ raw: ['imeta'], url: 'http://test', x: hash, extras: {} });
        expect(result.ok).toBe(true);
    });

    it('returns error for a hash mismatch', async () => {
        const payload = Buffer.from('hello malicious world');
        const wrongHash = createHash('sha256').update(Buffer.from('safe')).digest('hex');

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockStream([payload]),
        });

        const result = await verifyArtifactHash({ raw: ['imeta'], url: 'http://test', x: wrongHash, extras: {} });
        expect(result.ok).toBe(false);
        expect((result as any).error.issues[0].code).toBe(ErrorCode.VERIFY_HASH_MISMATCH);
    });

    it('aborts and returns error if stream exceeds max size constraints (zip-bomb protection)', async () => {
        const payload = Buffer.alloc(1024 * 60); // 60KB

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockStream([payload]), // Single chunk of 60KB
        });

        // Enforce max 50KB length
        const result = await verifyArtifactHash(
            { raw: ['imeta'], url: 'http://test', x: '123', extras: {} },
            { maxSizeBytes: 50 * 1024 }
        );
        expect(result.ok).toBe(false);
        expect((result as any).error.issues[0].code).toBe(ErrorCode.VERIFY_FILE_TOO_LARGE);
    });
});
