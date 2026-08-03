# Cross-language runtime conformance v1

- Area: Runtime contract and SDK portability
- Status: established
- Owner: Jarod
- Last updated: 2026-08-03

This directory is executable specification, not example data. Every runtime adapter
must produce the same observable results for these cases. The TypeScript adapter is
`scripts/core-conformance-adapter.mjs`; future .NET or other adapters implement the
same four operations: canonicalize a definition, parse an expression, evaluate an
expression, and execute a lifecycle scenario.

## Value representation

Corpus files are JSON, while runtime evaluation can also produce `undefined` and a
date. Expected expression and event values therefore use one of these tagged forms:

- `{ "kind": "json", "value": ... }` for any JSON value, including `null`.
- `{ "kind": "undefined" }` for an absent value.
- `{ "kind": "date", "value": "<ISO-8601 instant>" }` for a runtime date.

Numbers are finite IEEE-754 binary64 values. A runtime must not serialize `NaN` or
infinity into definitions or responses. Numeric strings and booleans participate in
numeric coercion exactly as the expression cases demonstrate.

Dates are instants. Built-in date functions use UTC calendar fields; `today()` is UTC
midnight and reads the corpus's explicit `clock`. Parsing an ISO date-only string means
UTC midnight. No conformance case may depend on the machine's locale or time zone.

## Definition semantics

`definitions.json` proves diagnostics, canonicalization, and the fixed-point rule from
ADR-0002. Object key order is semantically significant only for canonical output:
schema version, type discriminator when needed, registered properties, registered
child collections, then preserved unknown properties. Defaults are omitted unless the
metadata marks a property required.

## Expression semantics

`expressions.json` fixes accepted spellings, canonical printing, precedence,
coercion, emptiness, membership, short-circuiting, date behavior, and stable error
codes. Source spans use zero-based, half-open UTF-16 offsets, matching JSON and the
editing surfaces built over JavaScript strings.

Asynchronous functions never suspend a dependency transaction. Their first evaluation
returns absent while work is pending; the result is cached by case-insensitive name and
JSON arguments; the affected rules run again when it settles. A rejection is cached,
reported as `function-failed`, and is not retried until the cache is replaced. The
corpus fixes the evaluator's unavailable, pending, resolved, and failed outcomes. Cache
and re-evaluation scheduling remain runtime-level scenarios because they need a host
scheduler rather than a value evaluator.

## Lifecycle semantics

`lifecycle.json` describes semantic actions rather than language-specific method
names. Events are ordered. Completion emits the response before the state transition,
and repeated no-op actions emit nothing. Adapter object identities are intentionally
absent from the corpus; cross-language consumers depend on names, values, states, and
event order instead.

Changing existing v1 expectations is a contract change and requires an ADR. Additive
cases may be appended when they clarify behavior already intended. An incompatible
change creates `conformance/v2` and keeps v1 available for older SDK trains.
