# ADR-0003: Release notes and decisions live outside the specification

| | |
|---|---|
| **Status** | Accepted; extended in 0.9.1 |
| **Spec release** | 0.6.1 |
| **Former record** | DECISIONS S3 |

## Context

The inline changelog had grown to 13% of the specification's words. Its entries grew from 24 words per bullet at v0.5.7 to 138 at v0.6.1 because it did three jobs at once: release notes, per-rule rationale and defect traceability. Rationale was ordered by release, so a reader who asked why T2 works as it does had to know which release touched T2.

## Decision

- `CHANGELOG.md` holds terse release notes, one entry per version, citing rule IDs.
- Per-rule rationale is at most one sentence next to the rule, with a link to the record that holds the argument. Cross-cutting rationale lives in a decision record.

## Consequences

In 0.9.1 the decision records moved from `DECISIONS.md` to `docs/adr/`, and the arguments that sat in the specification body moved to records 0010 to 0017. Rule rows keep their inline rationale and may be trimmed in a later normative release. Records are append-only: a changed decision gets a new record that supersedes the old one.
