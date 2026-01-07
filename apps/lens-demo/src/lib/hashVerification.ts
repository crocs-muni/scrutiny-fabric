/**
 * Hash verification utilities for external files
 */

export type VerificationStatus = 'pending' | 'verifying' | 'verified' | 'failed' | 'mismatch' | 'unsupported';

export interface VerificationResult {
  status: VerificationStatus;
  computedHash?: string;
  error?: string;
}

/**
 * Compute SHA-256 hash of a file from a URL
 * @param url - URL of the file to hash
 * @param onProgress - Optional progress callback (0-100)
 * @returns Promise with the computed hash (hex string)
 */
export async function computeFileHash(
  url: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Fetch the file with streaming support
    const response = await fetch(url, {
      // Add no-cors mode as fallback, but prefer cors for better error handling
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    // Get the response body as a stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    // Read the stream and get the data
    const data = await readStream(reader, total, onProgress);

    // Create SHA-256 digest (pass the Uint8Array directly)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS error: Cannot access file from this domain. The server must allow cross-origin requests.');
    }
    throw error;
  }
}

/**
 * Read a stream and accumulate the data
 */
async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  total: number,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (onProgress && total > 0) {
      const progress = Math.round((receivedLength / total) * 100);
      onProgress(progress);
    }
  }

  // Concatenate chunks into a single Uint8Array
  const result = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }

  return result.buffer;
}

/**
 * Verify that a file's hash matches the expected hash
 * @param url - URL of the file to verify
 * @param expectedHash - Expected SHA-256 hash (hex string)
 * @param onProgress - Optional progress callback (0-100)
 * @returns Verification result
 */
export async function verifyFileHash(
  url: string,
  expectedHash: string,
  onProgress?: (progress: number) => void
): Promise<VerificationResult> {
  try {
    // Normalize expected hash (remove any whitespace, convert to lowercase)
    const normalizedExpected = expectedHash.trim().toLowerCase();

    if (!normalizedExpected || !/^[a-f0-9]{64}$/i.test(normalizedExpected)) {
      return {
        status: 'unsupported',
        error: 'Invalid hash format (expected 64 hex characters)',
      };
    }

    // Compute the actual hash
    const computedHash = await computeFileHash(url, onProgress);
    const normalizedComputed = computedHash.toLowerCase();

    // Compare hashes
    if (normalizedComputed === normalizedExpected) {
      return {
        status: 'verified',
        computedHash,
      };
    } else {
      return {
        status: 'mismatch',
        computedHash,
        error: 'Hash mismatch: computed hash does not match provided hash',
      };
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Check if a URL is likely to support CORS
 * This is a heuristic check and not foolproof
 */
export function isLikelyCORSSupported(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // GitHub raw content typically supports CORS
    if (urlObj.hostname.includes('githubusercontent.com')) {
      return true;
    }

    // GitHub URLs (may need raw conversion)
    if (urlObj.hostname.includes('github.com')) {
      return urlObj.pathname.includes('/raw/') || urlObj.pathname.includes('/blob/');
    }

    // Common CDNs that support CORS
    const corsFriendlyDomains = [
      'cloudflare.com',
      'jsdelivr.net',
      'unpkg.com',
      'cdnjs.com',
    ];

    return corsFriendlyDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Convert GitHub blob URL to raw URL for better CORS support
 */
export function convertToRawURL(url: string): string {
  try {
    const urlObj = new URL(url);

    // Convert github.com/blob/ or github.com with /refs/heads/ to raw.githubusercontent.com
    if (urlObj.hostname === 'github.com') {
      // Handle /blob/ URLs: /owner/repo/blob/branch/path
      if (urlObj.pathname.includes('/blob/')) {
        const parts = urlObj.pathname.split('/');
        // Format: /owner/repo/blob/branch/path
        if (parts.length >= 5) {
          const owner = parts[1];
          const repo = parts[2];
          const branch = parts[4];
          const path = parts.slice(5).join('/');

          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        }
      }
      
      // Handle /refs/heads/ URLs in query or fragment
      // Example: https://github.com/.../file?ref=refs/heads/main
      // or paths like: /owner/repo/refs/heads/branch/path
      if (urlObj.pathname.includes('/refs/heads/') || urlObj.search.includes('ref=refs/heads/')) {
  const pathMatch = urlObj.pathname.match(/^\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+)$/);
        if (pathMatch) {
          const [, owner, repo, branch, path] = pathMatch;
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        }
      }
    }

    // Already a raw URL - return as is
    if (urlObj.hostname === 'raw.githubusercontent.com') {
      return url;
    }
  } catch {
    // If URL parsing fails, return original
  }

  return url;
}
