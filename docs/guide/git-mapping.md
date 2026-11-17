# Git mapping

This note is not normative; [the specification](../protocol-spec.md) defines every behavior. For readers who know git, each row pairs a git concept with its Fabric counterpart.

| Git concept | Fabric counterpart | Notes |
|---|---|---|
| Commit | Patch event | Carries a unified diff. |
| Parent pointer | NIP-10 `e reply` marker | The reply chain is the commit lineage. |
| Linear branch | Canonical chain | Strictly linear, root-author patches only. Two patches with one parent are a [self-fork](../protocol-spec.md#62-self-fork), which leaves the chain undefined. |
| Patch (unified diff) | Fenced `diff` block in a patch's `content` | A unified diff with the fixed paths `a/content` and `b/content`. |
| `git apply`, `patch -u` | Patch application | Implementations may delegate hunk application to `git apply` or a diff library, but they must check [T1](../protocol-spec.md#rule-T1) themselves. |
| Review comment anchored to a commit | Foreign patch as an [overlay](../protocol-spec.md#63-foreign-overlays) | A foreign author proposes a change against one event in the chain. Like a comment anchored to a commit, an overlay is read against the resolved content of its target and not against the tip. A foreign patch cannot reply to another foreign patch. |
| Merge conflict | Overlay in the *conflict* state | The overlay is classified `conflict` and exposed through the client's API. The protocol has no merge. |
| Signing | Nostr event signature | Every event is signed, as a signed commit is. |

Git concepts not in the table have no Fabric counterpart. Merges are on the [roadmap](roadmap.md).
