# Roadmap

These are directions the protocol may take. None is part of [the specification](../protocol-spec.md), and the order is not a commitment.

- **Merges and overlay adoption.** The specification ignores root-author patches that reply to foreign patches. A later version may define explicit adoption: a root-author patch that machine-references the foreign overlay it incorporates. It may also define a merge primitive that lets a foreign author propose an overlay rebased onto a newer tip.
- **Recursive overlays.** Foreign patches may reply only to the root event or a root-author patch. A later version may allow a reply to an overlay, with rules for classification and admission when the parent overlay is not clean.
- **Atomic patch replacement.** A root author who wants to replace a patch just published must delete it and republish, which takes two events for one intent. A later version may define an atomic replacement. It would be separate from the `supersedes` marker for root events.
- **Confidential metadata.** [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) encrypted variants for embargoed disclosures, such as a coordinated CVE.
- **Vendor identity discovery.** [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md) lists for "products by vendor X" and similar curation.
- **Metadata-to-Metadata binding.** Bindings join a Product and a Metadata event only. A later version may allow Metadata to Metadata edges for derived findings or cross-advisory references.
- **Cherry-pick.** Attribution of diffs adopted from other patches, including machine-readable source references (`e` tags with a `cherry-pick` marker) and optional verification that the adopted diff matches its source. Deferred until ecosystem use supplies requirements.
- **Snapshot pins.** Markers `root:rev` and `link:rev` that name specific patch event IDs, so that a Binding author can record which patch state the Binding was evaluated against instead of leaving readers to infer it from `created_at`.
- **Data Vending Machine integration.** [NIP-90](https://github.com/nostr-protocol/nips/blob/master/90.md) job requests for SCRUTINY-derived computations, such as "summarize all CVE metadata bound to product X as a PDF". This needs a reserved job-request kind and an output MIME-type convention, and waits for at least one DVM provider to express interest.
