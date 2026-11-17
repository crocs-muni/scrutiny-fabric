# ADR-0010: Version fields compare as digit strings

| | |
|---|---|
| **Status** | Accepted |
| **Spec release** | 0.7.1 |
| **Rules** | VER-1, VER-4 |

## Context

The retired `scrutiny-vMMP` scheme claimed that lexicographic comparison of the tag coincides with semantic ordering. That held only because every field had exactly one digit. When a field needs two digits, `"10"` sorts before `"9"` as a string, which is the opposite of numeric order.

Reading the fields "as numbers" also fails. In JavaScript, the language of many Nostr clients, the only number type is an IEEE-754 double, exact only up to 2^53 − 1 (about 16 digits). Past that, two distinct fields that the grammar permits collapse to one value, and past a further width they overflow to `Infinity`, where `Infinity − Infinity` is `NaN` and the comparator stops returning a sign. VER-4 still obliges the consumer not to reject the higher-version event it can no longer order.

## Decision

Compare each of `MAJOR`, `MINOR` and `PATCH` as a decimal digit string: ignore leading zeros, the longer string is the greater number, and strings of equal length compare lexicographically. Compare the three fields in turn. This is the algorithm of Go's `x/mod/semver` (`compareInt`), RPM's `rpmvercmp` and dpkg's `verrevcmp`, none of which converts a field to a fixed-width integer.

## Consequences

The comparison has no digit ceiling and agrees with numeric order on every field. node-semver converts fields with `Number()` and so rejects fields above `Number.MAX_SAFE_INTEGER`. This protocol's grammar sets no such ceiling (ADR-0004).
