import { describe, it, expect, vi } from 'vitest';
import { verifyFileHash, convertToRawURL, isLikelyCORSSupported } from './hashVerification';

describe('hashVerification', () => {
  describe('convertToRawURL', () => {
    it('converts GitHub blob URLs to raw URLs', () => {
      const blobUrl = 'https://github.com/owner/repo/blob/main/path/to/file.csv';
      const expected = 'https://raw.githubusercontent.com/owner/repo/main/path/to/file.csv';
      expect(convertToRawURL(blobUrl)).toBe(expected);
    });

    it('handles nested paths correctly', () => {
      const blobUrl = 'https://github.com/owner/repo/blob/main/dir1/dir2/file.txt';
      const expected = 'https://raw.githubusercontent.com/owner/repo/main/dir1/dir2/file.txt';
      expect(convertToRawURL(blobUrl)).toBe(expected);
    });

    it('returns original URL for non-GitHub URLs', () => {
      const url = 'https://example.com/file.pdf';
      expect(convertToRawURL(url)).toBe(url);
    });

    it('returns original URL for already raw GitHub URLs', () => {
      const url = 'https://raw.githubusercontent.com/owner/repo/main/file.csv';
      expect(convertToRawURL(url)).toBe(url);
    });

    it('handles invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-url';
      expect(convertToRawURL(invalidUrl)).toBe(invalidUrl);
    });
  });

  describe('isLikelyCORSSupported', () => {
    it('returns true for githubusercontent.com', () => {
      expect(isLikelyCORSSupported('https://raw.githubusercontent.com/owner/repo/main/file.csv')).toBe(true);
    });

    it('returns true for GitHub blob URLs', () => {
      expect(isLikelyCORSSupported('https://github.com/owner/repo/blob/main/file.csv')).toBe(true);
    });

    it('returns true for common CDNs', () => {
      expect(isLikelyCORSSupported('https://cdn.jsdelivr.net/file.js')).toBe(true);
      expect(isLikelyCORSSupported('https://unpkg.com/package/file.js')).toBe(true);
    });

    it('returns false for unknown domains', () => {
      expect(isLikelyCORSSupported('https://example.com/file.pdf')).toBe(false);
    });

    it('handles invalid URLs gracefully', () => {
      expect(isLikelyCORSSupported('not-a-url')).toBe(false);
    });
  });

  describe('verifyFileHash', () => {
    it('detects invalid hash format', async () => {
      const result = await verifyFileHash('https://example.com/file.pdf', 'invalid-hash');
      expect(result.status).toBe('unsupported');
      expect(result.error).toContain('Invalid hash format');
    });

    it('detects short hash', async () => {
      const result = await verifyFileHash('https://example.com/file.pdf', 'abc123');
      expect(result.status).toBe('unsupported');
      expect(result.error).toContain('Invalid hash format');
    });

    it('accepts valid 64-character hex hash format', async () => {
      const validHash = '0855f3246fe76e797e23c303fd315fee0075fbcdf7afbd31289466908ec9f88c';
      
      // Mock fetch to return a small file
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': '4' }),
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array([116, 101, 115, 116]) }) // 'test'
              .mockResolvedValueOnce({ done: true })
          })
        }
      });

      const result = await verifyFileHash('https://example.com/test.txt', validHash);
      
      // The hash won't match 'test', but it should not be 'unsupported'
      expect(result.status).not.toBe('unsupported');
      expect(result.computedHash).toBeDefined();
    });
  });
});
