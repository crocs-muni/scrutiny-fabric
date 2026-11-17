# Optional signals

These NIPs give implementations auxiliary signals for ranking, spam deterrence and attention. None is required for conformance, and [the specification](../protocol-spec.md) gives them no effect on validity, admission or resolution.

| NIP | Signal | How it is used |
|---|---|---|
| [NIP-13](https://github.com/nostr-protocol/nips/blob/master/13.md) proof of work | Publisher-side cost, against spam at publication time | A publisher may add a `nonce` tag with a committed difficulty. A relay that supports [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) may advertise `min_pow_difficulty`. A publisher should read the relay's information document before publishing and meet any advertised minimum. The protocol mandates no minimum. |
| [NIP-18](https://github.com/nostr-protocol/nips/blob/master/18.md) reposts | Consumer-side distribution signal | Repost events (`kind: 6`) that reference a SCRUTINY event show that someone shared it. Query `{"kinds": [6], "#e": ["<event-id>"]}`. |
| [NIP-25](https://github.com/nostr-protocol/nips/blob/master/25.md) reactions | Consumer-side sentiment signal | Reactions (`kind: 7`) give lightweight feedback. Query `{"kinds": [7], "#e": ["<event-id>"]}`. |
| [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) zaps | Consumer-side economic endorsement | Zap receipts (`kind: 9735`) are verifiable payment proofs that reference the zapped event. Query `{"kinds": [9735], "#e": ["<event-id>"]}`. |
