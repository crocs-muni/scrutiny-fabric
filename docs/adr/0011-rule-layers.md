# ADR-0011: Three rule layers (V, A, D) and tolerance outside V

| | |
|---|---|
| **Status** | Accepted; extended in 0.9.2 |
| **Spec release** | 0.9.0 (current form) |
| **Rules** | TR-1 and the Layer column of every table |

## Context

An event can fail in different ways, and a consumer's response differs. A malformed event must not be processed. A patch that fails to apply must be reported and must freeze the chain, but the event is valid. An event that breaks a discovery convention is still a valid event. A single "invalid" outcome would hide these differences, and implementations would settle on different ones.

## Decision

Rules are partitioned by what they constrain: V (is the event well-formed), A (does it apply to chain state), D (how consumers find and show it). The consequences differ: reject, annotate and freeze, hide. A V-valid event is not rejected by an A or D rule (TR-1). The tolerance is deliberate and bounded: what a consumer accepts is stated, so it does not become silent acceptance of ambiguity (compare RFC 9413 on the limits of the robustness principle).

V rules take two forms. Exclusion rules say what is outside the valid set; inclusion rules, such as C2, C3 and C7, say what must not be treated as outside it. A consumer that is stricter than the grammar triggers no A or D rule, so without an inclusion rule nothing would forbid it.

A rule about how an event is built is not a V rule. Context-line counts (P1), fence lengths (E4) and line endings (P3) are producer obligations: a consumer cannot observe a violation, or rejecting would be disproportionate where a gentler outcome exists. They stay in A and D. A fourth layer for them was rejected because it would change no consumer behavior (ADR-0009).

The three producer rules named above, as they were argued in their rows before 0.9.2:

- P1: `--unified=3` and its equivalents give a maximum that the tool supplies where the content affords it, never a minimum it guarantees, and "available" depends on the target event's content, which a validity check over a single event never sees.
- E4: an opening fence of `max(3, N + 1)` backticks lets any payload be embedded unambiguously, including hunks over content that itself contains backtick fences. A consumer has nothing to check: a payload whose backtick run reached the fence length would have closed the block early (E3), and the bytes after it are not part of the payload at all (E5).
- P3: a CRLF payload fails to match LF content, because PB-2 forbids normalizing the payload bytes, and T1 handles it as an ordinary failure to apply. Rejecting it in layer V would pre-empt that with a harsher outcome for the same defect.

A test for placing a rule: could a consumer holding the event tell whether the rule was honored, and is rejection the outcome wanted when it was not? Two noes mean the rule is not a V rule.

## Consequences

An earlier draft listed "manifests" of rule IDs for each layer next to the tables. A manifest that disagreed with a table put two rules in the wrong layer for three releases. The Layer column of each rule table is now the only authority, and `rules.json` lists every rule's layer.
