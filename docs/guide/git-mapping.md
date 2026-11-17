# Git mapping

This note maps the concepts of git onto SCRUTINY Fabric for readers who know git. It is not normative: [the specification](../protocol-spec.md) defines every behavior.

| Git concept | SCRUTINY counterpart | Notes |
|---|---|---|
| Commit | Patch event | Carries a unified diff. |
| Parent pointer | NIP-10 `e reply` marker | Threading serves as commit lineage. |
| Linear branch | Canonical chain | Strictly linear, root-author patches only. Two patches with one parent are a [self-fork](../protocol-spec.md#62-self-fork), which leaves the chain undefined; it is not a feature. |
| Patch (unified diff) | Fenced `diff` block in a patch's `content` | Real `git diff` output, covered by the event signature. |
| `git apply`, `patch -u` | Patch application | Implementations may delegate to either. |
| Review comment anchored to a commit | Foreign patch as an [overlay](../protocol-spec.md#63-foreign-overlays) | A foreign author proposes a change against one event in the chain. Like a comment anchored to a commit and not to a branch, an overlay is read against the target's resolved content, not against the tip. A foreign patch cannot reply to another foreign patch. |
| Merge conflict | Overlay in the *conflict* state | Shown to the user. There is no protocol-level resolution. |
| Signing | Nostr event signature | Equivalent to commit signing. |

SCRUTINY does not borrow branch names and refs, annotated tags, the index, the working tree, remotes and push or pull (relays are the transport), rebase, submodules, hooks, pack files or merges. Merges are on the [roadmap](roadmap.md).
