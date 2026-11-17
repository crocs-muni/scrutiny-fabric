# Architecture decision records

One decision per file, append-only. To change a decision, add a record that supersedes it and update the old record's status line. The layout follows the ADR directory of `scrutiny-fabric-tools`.

A record explains why the specification reads as it does; it never changes what the specification requires. Records 0001 to 0009 are the former `DECISIONS.md` entries S1 to S10 (S4 and S7 are merged into 0004), and records 0010 to 0017 hold arguments that used to sit inside the specification body.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-bcp-14-keywords.md) | Normative keywords follow BCP 14 (RFC 2119 and RFC 8174) | Accepted |
| [0002](0002-licence-mit-for-pre-1-0.md) | MIT licence retained until 1.0 | Accepted; revisit before 1.0 |
| [0003](0003-changelog-rationale-and-decisions-split.md) | Release notes, rule rationale and decisions live in separate places | Accepted; extended in 0.9.1 |
| [0004](0004-version-tag-scheme.md) | Version tag `scrutiny-v<MAJOR>.<MINOR>.<PATCH>` | Accepted; supersedes the three-digit `scrutiny-vMMP` form |
| [0005](0005-governance-infrastructure-deferred.md) | Governance, citation and contribution infrastructure deferred | Accepted; revisit at 1.0 |
| [0006](0006-ci-validator-deferred.md) | CI validation of the rule registry deferred | Accepted; revisit when the tools repository is public |
| [0007](0007-version-comparison-clamp-and-hold.md) | Digit-string version comparison, T2 clamp and UR-4 hold | Accepted |
| [0008](0008-per-line-floor-and-closing-fence.md) | RL-2 per-line floor and E3 closing-fence existence | Accepted |
| [0009](0009-v0-9-0-release-shape.md) | One release for every change to rule wording; layers stay three; `supersedes` | Accepted |
| [0010](0010-digit-string-version-ordering.md) | Version fields compare as digit strings | Accepted |
| [0011](0011-rule-layers.md) | Three rule layers (V, A, D) and tolerance outside V | Accepted |
| [0012](0012-tip-of-an-unpatched-chain.md) | The root event is the tip of a chain with no patches | Accepted |
| [0013](0013-pure-insertion-position-and-carry-forward.md) | Position of a pure-insertion hunk | Accepted |
| [0014](0014-self-fork-and-halt-precedence.md) | Self-fork and HALT precedence; deleting a sibling | Accepted |
| [0015](0015-confluence-and-unobserved-references.md) | Ingestion is confluent; unobserved references are held | Accepted |
| [0016](0016-departures-from-nip-10-and-nip-09.md) | Fabric-specific departures from NIP-10 and NIP-09 | Accepted |
| [0017](0017-patch-root-typing.md) | A Patch's root must be a Product or Metadata event | Accepted |
