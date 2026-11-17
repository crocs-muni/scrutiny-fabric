# ADR-0001: Normative keywords follow BCP 14 (RFC 2119 and RFC 8174)

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.9.0 |
| **Former record** | DECISIONS S1 |

## Context

The specification used MUST, SHOULD and MAY throughout without defining them. Two vocabularies were available: RFC 2119 with RFC 8174, which Nostr's own NIPs use, and the shall/should/may vocabulary of ISO/IEC Directives Part 2.

## Decision

The specification uses the BCP 14 keywords and states the boilerplate once, in "Keywords and conformance". Outside quotations, other documents use lowercase modal verbs.

## Consequences

A reader who moves between a NIP and this specification meets one normative vocabulary. The boilerplate also says which role each rule binds (producer, consumer, relay) and what conformance means, and that a SHOULD may be departed from only for a documented reason.
