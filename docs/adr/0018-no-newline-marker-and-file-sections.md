# ADR-0018: The no-newline marker is keyed on its prefix; a `---` line starts a file section

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.9.2 (arguments moved out of the rules) |
| **Rules** | C5, C8 |

## Context

Two details of the consumer grammar need an argument that does not belong in a rule row. A hunk line beginning with `\` marks a missing line terminator, and the text after the backslash is not fixed. A line beginning with `---` can be a removed line or a file header.

## Decision

- **C5.** The marker is recognized by its `\` prefix. GNU diff and git translate its text through gettext: `\ No newline at end of file` under an English locale, `\ Kein Zeilenumbruch am Dateiende` under `LANG=de_DE.UTF-8`. Matching the English text loses the signal on a payload produced under another locale, which changes the resulting bytes that PB-1 makes normative.
- **C8.** A `---` line where a hunk line could appear begins a new file section. The grammar admits both readings, and C8 takes the one that lets a payload carry several file sections. The cost is stated in the specification: a removal of a line whose content is exactly `-- a/content` cannot be expressed. C1 fixes the path tokens of every section to `a/content` and `b/content`, so all sections address the same content, and their hunks are processed as one sequence in document order (T3).

## Consequences

A consumer that keys on the marker's text, or that reads a `---` line as a removal, produces different bytes from one that follows C5 and C8 for the same payload.
