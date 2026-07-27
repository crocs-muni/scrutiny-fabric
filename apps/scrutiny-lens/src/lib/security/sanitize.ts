/**
 * Content sanitization for untrusted Nostr event text.
 *
 * Nostr event content is user-generated from anonymous pubkeys.
 * We MUST sanitize before rendering to prevent XSS.
 */

/** HTML entities that must be escaped. */
const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
};

const ESCAPE_RE = /[&<>"'/]/g;

/**
 * Escape HTML special characters in untrusted text.
 * This is the primary defense against XSS from Nostr event content.
 */
export function escapeHtml(text: string): string {
    return text.replace(ESCAPE_RE, (char) => ESCAPE_MAP[char] || char);
}

/**
 * Sanitize Nostr event content for safe display.
 * Strips all HTML tags and escapes remaining special characters.
 * Returns plain text only.
 */
export function sanitizeEventContent(content: string): string {
    // Strip any HTML tags first
    const stripped = content.replace(/<[^>]*>/g, '');
    return escapeHtml(stripped);
}

/** Returns true if the host is a local loopback address (dev-only). */
function isLocalhost(host: string): boolean {
    const h = host.toLowerCase().replace(/:.*$/, ''); // strip port
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

/**
 * Validate a relay URL for security.
 * wss:// is required for all remote hosts.
 * ws:// is allowed only for localhost/127.0.0.1 (local dev relay).
 */
export function isValidRelayUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'wss:') return true;
        if (parsed.protocol === 'ws:' && isLocalhost(parsed.hostname)) return true;
        return false;
    } catch {
        return false;
    }
}

/**
 * Normalize a relay URL: lowercase host, strip trailing slash.
 * Preserves ws:// for localhost, enforces wss:// for everything else.
 */
export function normalizeRelayUrl(url: string): string | null {
    if (!isValidRelayUrl(url)) return null;
    try {
        const parsed = new URL(url);
        const scheme = parsed.protocol === 'ws:' && isLocalhost(parsed.hostname) ? 'ws' : 'wss';
        let normalized = `${scheme}://${parsed.host.toLowerCase()}`;
        if (parsed.pathname && parsed.pathname !== '/') {
            normalized += parsed.pathname.replace(/\/+$/, '');
        }
        return normalized;
    } catch {
        return null;
    }
}
