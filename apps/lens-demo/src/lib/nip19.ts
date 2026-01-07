import { nip19 } from 'nostr-tools';

export function pubkeyToNpub(pubkey: string): string {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    // If encoding fails, return a truncated version of the pubkey
    return pubkey.length > 16
      ? `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 8)}`
      : pubkey;
  }
}

export function pubkeyToShortNpub(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey);
    // Format: npub1abc...xyz (first 8 chars after npub1, last 4)
    return `${npub.substring(0, 12)}...${npub.substring(npub.length - 4)}`;
  } catch {
    // If encoding fails, return a truncated version of the pubkey
    return pubkey.length > 16
      ? `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 8)}`
      : pubkey;
  }
}

export function eventIdToNote(eventId: string): string {
  try {
    return nip19.noteEncode(eventId);
  } catch {
    // If encoding fails, return a truncated version of the eventId
    return eventId.length > 16
      ? `${eventId.substring(0, 8)}...${eventId.substring(eventId.length - 8)}`
      : eventId;
  }
}

export function truncateId(id: string, prefixLen: number = 8, suffixLen: number = 8): string {
  if (id.length <= prefixLen + suffixLen) return id;
  return `${id.substring(0, prefixLen)}...${id.substring(id.length - suffixLen)}`;
}