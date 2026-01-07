import { nip19 } from 'nostr-tools';

/**
 * Decode a Nostr identifier (note1, nevent1, or hex) to an event ID.
 * Returns null when the identifier cannot be resolved.
 */
export function decodeEventIdentifier(identifier: string): string | null {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('note1') || trimmed.startsWith('nevent1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'note') {
        return decoded.data;
      }
      if (decoded.type === 'nevent') {
        return decoded.data.id;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

/**
 * Validate whether the provided string looks like a supported event identifier.
 */
export function isValidEventIdentifier(identifier: string): boolean {
  return decodeEventIdentifier(identifier) !== null;
}
