# ADR-0006: CI validation of the rule registry deferred

| | |
|---|---|
| **Status** | Accepted; revisit when the tools repository is public |
| **Former record** | DECISIONS S6 |

## Context

The plan was a GitHub Actions workflow in this public repository that runs the rule-registry validator of `scrutiny-fabric-tools` on every change to the specification. That repository is private, and a workflow in a public repository cannot check out a private one without a stored credential. Three options existed: a cross-repository checkout with a fine-grained token stored as a secret, a vendored copy of the extractor, or making the tools repository public.

## Decision

Skip CI for now. A vendored copy would recreate the hand-maintained duplicate that the generated extractor exists to avoid.

## Consequences

`node tools/verify-corpus.mjs` and `node tools/gen-rules.mjs --check` run by hand before each commit. Since 0.9.1 this repository generates `rules.json` itself, which removes the parsing dependency on the tools repository. Making the tools repository public would also remove the blocker.
