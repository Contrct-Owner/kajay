# Cross-language runtime conformance v1

- Area: Runtime contract and SDK portability
- Status: established
- Owner: Jarod
- Last updated: 2026-08-05

This directory is executable specification, not example data. Every runtime adapter
must produce the same observable results for these cases. The TypeScript adapter is
`scripts/core-conformance-adapter.mjs`; future .NET or other adapters implement the
same four operations: canonicalize a definition, parse an expression, evaluate an
expression, and execute a lifecycle scenario.

Only the TypeScript adapter implements all four operations today. The C# adapter's
definition operation passes all seven definition cases and their fixed-point checks,
and its expression parser passes all five parsing cases. Expression evaluation and
its public value/evaluator seam passes all fifteen evaluation cases. Lifecycle passes
two of four scenarios. V1 is therefore an executable portability contract, not evidence of
compatibility between two complete runtimes. That claim requires at least two maintained
adapters passing this same version.

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

## Localized strings

A property the metadata marks localizable accepts `{ "default": …, "<locale>": … }` as
well as a plain string, and **canonical output keeps the object exactly as authored**. A
runtime that resolved it while reading would emit a monolingual definition, which the
fixed-point rule would not catch — both passes would agree, and every other translation
would be gone. The same object on a property that is *not* localizable is a
`property-type-mismatch`: translating a condition breaks the survey in whichever
language somebody translated it into.

The definition's `locale` is the one it opens in. Which locale a respondent switched to
is runtime state and never appears in canonical output, on the same rule that keeps
`visibleIf`'s current answer out of it.

Fallback order for a localizable property is exact locale, then base language
(`fr-CA` → `fr`), then `default`, then empty.

## Time in a lifecycle scenario

A scenario may name a `clock` — an ISO-8601 instant — and move it with `advance-clock`,
which advances by whole seconds and then asks the runtime to look. `start-timer` begins
the survey's clocks; nothing is timed until it does, because a survey parsed to score a
stored response is not being sat by anybody.

Advancing and looking are **one action** deliberately. A runtime that scheduled its own
callbacks would have nothing for the corpus to call, and one that computes has nothing
to report until something asks — so the corpus fixes the second arrangement and a
runtime built on the first cannot pass it by accident.

Expiry emits no event of its own. A survey that runs out of time emits exactly what
manual completion emits, in the same order, and a page that runs out of time turns
silently — so the timed scenarios discriminate by *what they complete after* rather
than by a timer event that would have to be invented for them.

## What is not here yet

**Quiz scoring.** `correctAnswer` canonicalizes in `definitions.json`, but what a given
set of answers *scores* has no case, because scoring is a pure query and v1 has four
adapter operations, none of which can ask one. Adding a fifth is not the additive change
it looks like: every adapter that passes v1 today would stop passing it, which is the
thing versioning exists to prevent. The rules for it belong in an ADR and probably in
`conformance/v2`. Scoring will be designed as the first shared v2 change alongside a
second maintained runtime that needs it, before either adapter claims v2 compatibility;
it will not be guessed into the contract in advance. Until then scoring is specified
by the TypeScript suite alone, which is exactly the limitation ADR-0020 requires us to
state rather than hide.

The second maintained runtime and the v2 design now exist: ADR-0030 selects
`Kajay.Core`, and [conformance v2](../v2/README.md) replaces the lifecycle-only
operation with a general survey-scenario operation that can observe scoring. This v1
limitation remains part of the v1 contract; the new v2 files are specified with both
adapters still pending.

Changing existing v1 expectations is a contract change and requires an ADR. Additive
cases may be appended when they clarify behavior already intended. An incompatible
change creates `conformance/v2` and keeps v1 available for older SDK trains.
