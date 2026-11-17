# ADR-0016: SCRUTINY-specific departures from NIP-10 and NIP-09

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.9.0 |
| **Rules** | E1, BD-2, SUP-4, DEL-11 |

## Context

Three behaviors of the protocol differ from the base layers it builds on, and a generic Nostr client meets all of them.

1. NIP-10 advises against markup in `kind: 1` content, and SCRUTINY Patches carry a CommonMark fenced block.
2. NIP-10 defines two `e` markers, `root` and `reply`, and SCRUTINY adds `link` (Bindings) and `supersedes` (Products and Metadata).
3. NIP-09 asks relays to delete the referenced event, and SCRUTINY-aware relays keep the original beside the deletion request.

## Decision

Keep all three, and list them as SCRUTINY-specific in §3.2 of the specification. There is no wire change. A generic client shows the Patch text as written, may ignore or misread the new markers, and sees the same deletion request as any other. Using `kind: 1` is what makes Products and Metadata readable as ordinary notes; a separate kind would give up that property (design principle: render gracefully in generic clients).

The deletion departure is limited to `scrutiny-fabric` events. The relay keeps the original so that readers can audit what the author retracted; it stores the deletion request beside the original and serves both to anyone who queries for them.

## Consequences

A relay that follows NIP-09 literally drops the original, and the audit trail then depends on other relays and on consumer caches (DEL-9).
