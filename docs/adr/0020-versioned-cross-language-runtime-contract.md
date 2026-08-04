# ADR-0020 — Versioned cross-language runtime contract

- Area: Runtime portability and SDK conformance
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

## Context

The headless core and JSON definition format make another runtime implementation
possible, but possibility is not compatibility. Shape is already captured by JSON
Schema; behavior still lived in TypeScript implementation and tests: canonical output,
expression coercion, dates, error codes, lifecycle states, and event order.

A .NET implementation copied from that code would make TypeScript the undocumented
specification. The two implementations would diverge anywhere JavaScript behavior was
accidental or a test could not be reused.

## Decision

The cross-language runtime interface has three committed, versioned layers:

1. `contracts/survey-schema.json` describes definition shape and format identity.
2. `contracts/runtime-metadata.json` and `runtime-diagnostics.json` describe registry
   facts and stable machine-readable error vocabulary without constructors or objects.
3. `conformance/v1/` describes observable behavior as JSON cases for definition
   canonicalization, expressions, values, diagnostics, lifecycle states, and events.

Each runtime supplies a small adapter over those operations. The TypeScript adapter is
the first implementation and runs in CI. A future .NET adapter earns v1 compatibility
by running the same corpus; it does not copy TypeScript tests or reach into TypeScript
internals.

There is currently one adapter. That makes the seam executable and keeps TypeScript
behavior reviewable, but it does not yet demonstrate compatibility between runtimes.
Cross-runtime compatibility may be claimed only for a corpus version passed by at
least two maintained adapters.

Corpus actions are semantic rather than method names. Values that JSON cannot express
use tagged encodings for absent and date values. Dates use UTC calendar semantics and
an explicit clock; numbers are finite IEEE-754 binary64 values. Diagnostic code lists
are the source of their exported TypeScript unions, so introducing an uncatalogued code
fails compilation before contract drift is checked.

Survey validation kinds remain extensible because a custom validator's registered type
is its kind. The diagnostic contract records built-ins and states that extension seam
instead of pretending the list is closed.

## Versioning

Additive cases that clarify existing v1 behavior remain in v1. V1 has exactly four
adapter operations. Changing an existing expectation, changing one of those
operations, or adding a fifth operation creates `conformance/v2`; older corpus
versions remain available for older SDK trains. Generated metadata and diagnostic
contracts carry their own contract version separately from the survey definition's
`schemaVersion`.

Do not create v2 merely to make the interface look more complete. A second runtime may
first target v1. If quiz scoring is needed by both maintained runtimes, its cases and
fifth operation are designed as the first shared v2 change alongside that runtime,
before either adapter claims v2 compatibility. Scoring remains TypeScript-specified
until that concrete second caller exists.

Contract generation and conformance are separate CI gates. Shape can remain unchanged
while behavior drifts, and behavior can remain unchanged while metadata drifts; one
check would hide that distinction.

## Consequences

- Runtime behavior is reviewable as data and reusable by implementations in any
  language.
- Until a second adapter passes a corpus version, the repository proves a versioned
  portability seam rather than cross-runtime compatibility.
- The TypeScript core becomes an adapter behind the shared seam rather than the
  specification by accident.
- A new runtime is still a reimplementation, not generated application code. The
  corpus removes semantic discovery; it does not remove implementation work.
- Cross-language artifacts describe an embedded runtime. Introducing a centralized
  HTTP/RPC service would be a separate decision involving transport, persistence,
  authentication, and concurrency.
- Cache scheduling for asynchronous expression functions is documented but remains a
  runtime-level scenario; its value outcomes are already adapter-neutral and executable.

## Alternatives considered

- **JSON Schema alone.** Rejected: it cannot describe evaluation, canonicalization,
  errors, state transitions, or event order.
- **Generate C# models from TypeScript declarations.** Rejected: declarations expose
  TypeScript's interface, including object relationships, and still omit behavior.
- **Share implementation through JavaScript embedding or WebAssembly.** Deferred until
  a real runtime needs it. It would trade a native SDK for deployment complexity and
  does not remove the need for a behavioral contract.

## Parent and related links

- [North Star §6](../NORTH_STAR.md#6-multi-framework-and-multi-runtime-strategy)
- [ADR-0002](./0002-round-trip-fixed-point.md)
- [ADR-0003](./0003-hand-rolled-expression-parser.md)
- [ADR-0011](./0011-contract-identity-and-format-version.md)
- [Conformance v1](../../conformance/v1/README.md)
