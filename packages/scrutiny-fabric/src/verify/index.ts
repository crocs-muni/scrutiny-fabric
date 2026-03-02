import * as crypto from 'node:crypto';
import type { ParsedImeta } from '../types/index.js';
import { ErrorCode, issue, ok, err, type Result, type ScrutinyError } from '../types/index.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface VerifyArtifactOptions {
    /** Maximum allowed file size in bytes. Defaults to 50MB (50 * 1024 * 1024). */
    maxSizeBytes?: number;
    /** Timeout in milliseconds. Defaults to 30,000ms. */
    timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<VerifyArtifactOptions> = {
    maxSizeBytes: 50 * 1024 * 1024,
    timeoutMs: 30000,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Securely verify that a remote file matches its expected SHA-256 hash.
 * 
 * Streams the file directly into a `crypto` hasher without buffering the entire
 * file into memory or writing to disk. Enforces a strict bytes limit to 
 * prevent DoS (zip-bombs / memory exhaustion) and uses an `AbortController` 
 * for timeouts.
 *
 * @param artifact — A parsed NIP-92 imeta tag containing at least `url` and `x`.
 * @param options  — Optional configuration for size limits and timeouts.
 */
export const verifyArtifactHash = async (
    artifact: ParsedImeta,
    options?: VerifyArtifactOptions,
): Promise<Result<true, ScrutinyError>> => {
    const config = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

    if (!artifact.url) {
        return err({ issues: [issue(ErrorCode.VERIFY_MISSING_URL, 'Artifact is missing a url field')] });
    }
    if (!artifact.x) {
        return err({ issues: [issue(ErrorCode.VERIFY_MISSING_HASH, 'Artifact is missing an x (SHA-256) field')] });
    }

    const expectedHash = artifact.x.toLowerCase();
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), config.timeoutMs);

    let response: Response;
    try {
        response = await fetch(artifact.url, {
            signal: abortController.signal,
            method: 'GET',
        });
    } catch (e: unknown) {
        clearTimeout(timeoutId);
        if ((e as Error).name === 'AbortError') {
            return err({ issues: [issue(ErrorCode.VERIFY_TIMEOUT, `Fetch timed out after ${config.timeoutMs}ms`, { url: artifact.url })] });
        }
        return err({ issues: [issue(ErrorCode.VERIFY_FETCH_FAILED, `Fetch failed: ${(e as Error).message}`, { url: artifact.url })] });
    }

    if (!response.ok || !response.body) {
        clearTimeout(timeoutId);
        return err({ issues: [issue(ErrorCode.VERIFY_FETCH_FAILED, `HTTP ${response.status} ${response.statusText}`, { url: artifact.url })] });
    }

    // @ts-ignore - dynamic crypto import for node
    const crypto = await import('node:crypto');
    const hasher = crypto.createHash('sha256');
    let bytesRead = 0;

    try {
        // @ts-ignore Node 18+ native fetch body is a ReadableStream<Uint8Array>
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
                bytesRead += value.length;
                if (bytesRead > config.maxSizeBytes) {
                    abortController.abort(); // Kill the socket
                    reader.cancel();
                    return err({
                        issues: [
                            issue(
                                ErrorCode.VERIFY_FILE_TOO_LARGE,
                                `File exceeded maximum allowed size of ${config.maxSizeBytes} bytes`,
                                { bytesRead, maxSizeBytes: config.maxSizeBytes }
                            ),
                        ],
                    });
                }
                hasher.update(value);
            }
        }
    } catch (e: unknown) {
        // If we aborted it ourselves, it was either a timeout or size limit.
        if ((e as Error).name === 'AbortError') {
            if (bytesRead > config.maxSizeBytes) {
                return err({
                    issues: [
                        issue(
                            ErrorCode.VERIFY_FILE_TOO_LARGE,
                            `File exceeded maximum allowed size of ${config.maxSizeBytes} bytes`,
                            { bytesRead, maxSizeBytes: config.maxSizeBytes }
                        ),
                    ],
                });
            }
            return err({ issues: [issue(ErrorCode.VERIFY_TIMEOUT, `Stream processing timed out after ${config.timeoutMs}ms`, { url: artifact.url })] });
        }
        return err({ issues: [issue(ErrorCode.VERIFY_FETCH_FAILED, `Error reading stream: ${(e as Error).message}`)] });
    } finally {
        clearTimeout(timeoutId);
    }

    const actualHash = hasher.digest('hex');
    if (actualHash !== expectedHash) {
        return err({
            issues: [
                issue(
                    ErrorCode.VERIFY_HASH_MISMATCH,
                    `Artifact hash mismatch. Expected ${expectedHash}, got ${actualHash}`,
                    { expected: expectedHash, actual: actualHash, url: artifact.url }
                ),
            ],
        });
    }

    return ok(true);
};
