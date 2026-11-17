# ADR-0003: Release notes, rule rationale and decisions live in separate places

| | |
|---|---|
| **Status** | Accepted; amended by ADR-0009 and the restructure of 0.9.1 |
| **Spec release** | 0.6.1 |
| **Former record** | DECISIONS S3 |

## Context

The inline changelog had grown to 13% of the specification's words. Its entries grew from 24 words per bullet at v0.5.7 to 138 at v0.6.1 because it did three jobs at once: release notes, per-rule rationale and defect traceability. Rationale was ordered by release, so a reader who asked why T2 works as it does had to know which release touched T2.

## Decision

- `CHANGELOG.md` holds terse release notes, one entry per version, citing rule IDs.
- A decision record in `docs/adr/` holds the argument for a cross-cutting choice or a long-running rule. A rule row keeps at most one sentence of rationale and links to the record.

## Consequences

Since 0.9.1 the specification holds no history and no extended argument, and its rule tables are the rules. Records are append-only: a changed decision gets a new record that supersedes the old one.
