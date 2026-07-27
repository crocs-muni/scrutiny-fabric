/**
 * Utility functions — formatting helpers for display.
 */

/**
 * Truncate a hex string (event ID or pubkey) for display.
 * Shows first N and last N characters with ellipsis.
 */
export function truncateHex(hex: string, chars = 8): string {
    if (hex.length <= chars * 2) return hex;
    return `${hex.slice(0, chars)}…${hex.slice(-chars)}`;
}

/**
 * Format a Unix timestamp to a human-readable date string.
 */
export function formatTimestamp(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleString();
}

/**
 * Format a relative time (e.g., "5 minutes ago").
 */
export function formatRelativeTime(unixSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixSeconds;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return formatTimestamp(unixSeconds);
}

/**
 * Get a human-readable label for a SCRUTINY event type.
 */
export function eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        product: 'Product',
        metadata: 'Metadata',
        binding: 'Binding',
        update: 'Update',
        retract: 'Retraction'
    };
    return labels[type] ?? type;
}

/**
 * Get a human-readable label for a relationship type.
 */
export function relationshipLabel(rel: string): string {
    const labels: Record<string, string> = {
        test: 'Tests',
        vulnerability: 'Vulnerability',
        patch: 'Patches',
        certification: 'Certification',
        audit: 'Audit',
        analysis: 'Analysis',
        contains: 'Contains',
        depends_on: 'Depends on',
        provides: 'Provides',
        same: 'Same as',
        related: 'Related to'
    };
    return labels[rel] ?? rel;
}
