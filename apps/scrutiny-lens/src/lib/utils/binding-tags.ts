import type { NostrEvent } from "@scrutiny-fabric/scrutiny-fabric";

const EVENT_ID_HEX = /^[0-9a-f]{64}$/i;

function isLikelyEventId(value: string | undefined): value is string {
	return typeof value === "string" && EVENT_ID_HEX.test(value);
}

/**
 * Extract all event IDs referenced by binding endpoint tags.
 *
 * This is intentionally tolerant for legacy or non-strict bindings:
 * - includes all `e` tag IDs
 * - includes all `q` tag IDs
 * - deduplicates while preserving first-seen order
 */
export function extractBindingReferencedEventIds(binding: NostrEvent): string[] {
	const ids = new Set<string>();

	for (const tag of binding.tags) {
		if ((tag[0] === "e" || tag[0] === "q") && isLikelyEventId(tag[1])) {
			ids.add(tag[1]);
		}
	}

	return [...ids];
}