# Cross-language runtime conformance v2

- Area: Runtime contract and native SDK portability
- Status: specified; adapters pending
- Owner: Jarod
- Last updated: 2026-08-05

This directory fixes the behavior chosen in
[ADR-0030](../../docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md) before
either TypeScript 2.x or `Kajay.Core` implements it. It is executable specification,
not a record of current TypeScript 1.x behavior. The normal conformance gate continues
to run v1 until an adapter deliberately opts into v2.

V2 inherits every v1 case that does not conflict with this document. Its files contain
the new and changed cases rather than copied v1 data. A v2 runner runs the inherited
v1 definition, expression, and lifecycle cases, normalizes v1 lifecycle scenarios to
the v2 survey-scenario protocol, then runs the v2 files. The v2 rules below supersede
v1 prose about boolean numeric coercion, host date parsing, host string conversion,
host rounding, and regular expressions.

## Adapter interface

V2 has four operations:

1. Canonicalize a definition.
2. Parse and canonically print an expression.
3. Evaluate an expression with explicit values, functions, and clock.
4. Execute a semantic survey scenario.

The fourth operation replaces v1's lifecycle-only operation. It accepts semantic
actions and reports observable state, ordered events, and an optional observation.
Validation and scoring therefore do not add one shallow adapter method each. Language
method names, task identities, model references, and exception classes never appear in
the corpus.

Each scenario has `expectInitial`, followed by `steps`. A step contains an `action` and
its complete expected result. Every step reports `state` and ordered `events`; an action
that asks a question also reports one `observation`:

- `validate-current-page` reports `validation`, with stable error kinds rather than
  localized prose;
- `measure-score` reports `score`, with earned and possible marks; and
- mutating actions have no observation.

V1 lifecycle actions normalize directly into this shape. Future v2 cases may add
semantic actions only when they still belong to the one survey-scenario interface.

## Tagged values

V2 retains v1's tagged representation:

- `{ "kind": "json", "value": ... }` for JSON, including explicit `null`;
- `{ "kind": "undefined" }` for absent; and
- `{ "kind": "date", "value": "<UTC ISO instant>" }` for a runtime instant.

Numbers are finite IEEE-754 binary64 values. Negative zero normalizes to JSON zero at
an adapter seam. Source spans and ordinal text comparison use zero-based UTF-16 code
units; pattern matching explicitly uses Unicode scalar values instead.

## Value semantics

The value kinds are absent, null, boolean, finite number, string, UTC instant, array,
and object. `absent == null` remains true in expressions, while answer storage and
events keep them distinct.

Numeric text is an optional sign followed by decimal digits with an optional fraction
and base-ten exponent. A leading decimal point is accepted only when followed by a
digit. The whitespace ignored at both ends is the exact `\s` set defined by Pattern
Profile v1 below. Hexadecimal, binary, octal, empty, locale-formatted, `NaN`, and
infinite text is not numeric. Booleans are not numbers.

Equality and ordering follow ADR-0030. Object equality is structural and ignores key
order; array order remains significant. Ordinal text comparison is by UTF-16 code unit,
not current culture or Unicode collation. Arrays and objects never become host default
strings. Rounding is midpoint-away-from-zero.

Absent, null, empty string, and empty array are empty. Those values plus false and
numeric zero are false; every other supported value is true. In particular, `"0"`, a
UTC instant, and an object with no properties are true.

Function names use ASCII-insensitive comparison. Choice search uses Unicode 17.0
Default Case Folding without normalization; its generated table must be committed
before an adapter claims v2. Explicit choice sorting uses stable ordinal UTF-16 order.
URL value placeholders use UTF-8 RFC 3986 encoding, while deployment endpoint
placeholders remain verbatim host-owned URL components.

## Date grammar

Accepted date text is either `YYYY-MM-DD` or:

```text
YYYY-MM-DDTHH:mm:ss[.S|.SS|.SSS](Z|+HH:mm|-HH:mm)
```

Date-only text is midnight UTC. An offset date-time normalizes to UTC milliseconds.
Years have exactly four digits. Calendar fields must form a real Gregorian date;
`24:00`, leap seconds, a missing offset, more than millisecond precision, and host
culture formats are invalid. Date functions read only the explicit corpus clock and
UTC calendar fields.

## Kajay Pattern Profile v1

A regex validator consumes a Kajay pattern, not a host regex. Matching is
case-sensitive and searches unless `^` or `$` anchors it. Captures are not observable.
The grammar supports:

- literals, escaped punctuation, and dot;
- positive and negated character classes with scalar-value ranges;
- `\d`, `\w`, `\s` and their uppercase inverses;
- grouping, alternation, `^`, and `$`; and
- `*`, `+`, `?`, `{n}`, and `{n,m}` quantifiers.

`\d` is `[0-9]`; `\w` is `[A-Za-z0-9_]`. `\s` is tab, line feed, vertical tab, form
feed, carriage return, space, no-break space, ogham space mark, U+2000–U+200A, line
separator, paragraph separator, narrow no-break space, medium mathematical space,
ideographic space, and byte-order mark. Dot excludes carriage return, line feed, line
separator, and paragraph separator. Anchors refer to the whole value; v1 has no
multiline mode.

Backreferences, lookaround, named or observable captures, atomic groups, conditionals,
inline flags, Unicode property escapes, lazy or possessive quantifiers, and host-engine
escapes are invalid. Source is limited to 512 Unicode scalar values, the compiled form
to 4,096 states, bounded repetitions to 1,000, and input to 64 KiB. Compilation and
matching must be observably linear in input length for a fixed compiled pattern.

An invalid or over-limit pattern remains in canonical definition output, emits one
`invalid-pattern` error diagnostic at the `regex` property path, and acts as no
respondent rule. The author can fix it; the respondent is never blocked by it.

## Current claim

No adapter passes v2 yet. TypeScript 1.x continues to pass v1. The executable progress
gates prove that both public runtime seams pass all 25 new expression-evaluation cases;
both also pass all 2 new definition cases and 3 of the 5 new survey-scenario cases.
The remaining survey scenarios are pending.
Cross-runtime v2 compatibility may be claimed only after both the TypeScript 2.x and
C# adapters pass the inherited and v2 cases through their public runtime seams.
