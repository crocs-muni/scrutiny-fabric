# ADR-0004: Version tag `scrutiny-v<MAJOR>.<MINOR>.<PATCH>`

| | |
|---|---|
| **Status** | Accepted; supersedes the three-digit `scrutiny-vMMP` form |
| **Spec release** | 0.7.0 |
| **Former record** | DECISIONS S4 and S7 |

## Context

The original tag was `scrutiny-vMMP`, three digits, one per field. It was kept at first on the reasoning that changing a wire format is itself breaking. That reasoning failed: the ordering rule (VER-1) was already false as soon as any field needed two digits, and the field widths could not grow without a format change.

## Decision

The version tag value is `MAJOR.MINOR.PATCH` with unpadded decimal integers and no digit-count ceiling in any field. The old form is retired outright, with no dual-path acceptance, because no real corpus existed to keep compatible.

**Rejected: a dedicated `v` tag.** The first draft of the amendment added `["v", "<MAJOR>.<MINOR>.<PATCH>"]`. `i` and `k` reuse letters that NIP-73 already claims, but `v` would have been Fabric minting a claim on an unclaimed letter with no NIP behind it, and there is no registry to learn whether another application claims it later. It also bought nothing, since `{"#t": ["scrutiny-v0.7.0"]}` already gives exact-match relay filtering. The fix stays inside the `scrutiny-` namespace that Fabric already owns.

**Release number.** The change broke every previously valid event, so it is not a PATCH. While MAJOR is 0 this project puts a breaking change in the MINOR slot, which gives 0.7.0, not 0.6.3 or 1.0.0.

## Consequences

The vectors were regenerated with the unpadded form; their `id` and `sig` fields were placeholders, so no cryptographic relationship changed. The tools library had pinned the old digests, which went stale until it re-vendored. See ADR-0010 for how versions compare.
