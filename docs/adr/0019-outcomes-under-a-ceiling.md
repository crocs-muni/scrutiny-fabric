# ADR-0019: A ceiling has its own outcomes for chains and overlays

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.9.2 (arguments moved out of the rules) |
| **Rules** | RL-3, RL-5, OV-9 |

## Context

A consumer stops work when a configured ceiling is reached (section 4.5). The stop says nothing about whether a patch applies or an overlay is well formed. Without a named outcome, implementations report it as one of the existing ones.

## Decision

- **A chain stopped by a ceiling is *aborted under a ceiling* (RL-5).** Reporting it as `resolved` would name the last applied patch as the tip and claim a completeness the implementation does not have, and RC-3 then obliges service consumers to serve that result downstream. Reporting it as HALT is forbidden by RL-3: no patch was shown to fail.
- **An overlay stopped by a ceiling is `unclassified` (OV-9).** It is not `conflict`, because no failure was established. It is not `orphaned`, because the target is well defined and obtainable and the α/β rule does not apply. It is not `clean` or `stale`, because the hunks were never shown to apply.
- Both outcomes carry the resource-limit-exceeded annotation of RL-3 and do not cite H1.

## Consequences

A ceiling is never a finding against the event or its author. A chain with no defined tip also has no `clean` overlay (OV-10, ADR-0009).
