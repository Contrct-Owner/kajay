# ADR-0033: Compare C# and TypeScript through symmetric HTTP peers

- Area: SDK demonstrations and deployment
- Status: superseded by 0045
- Owner: Jarod
- Last updated: 2026-08-08

## Context

ADR-0032 kept the renderer and Creator UI constant, but its runtime profiles could
only be run independently. The TypeScript path also executed in the browser while
the C# path crossed an HTTP boundary. That demonstrated either SDK, but did not make
their compatibility directly observable under equivalent hosting conditions.

## Decision

Run the C# and TypeScript SDKs as symmetric HTTP API peers. Keep the individual
`dotnet` and `typescript` Compose profiles, and add a `compare` profile that starts
both APIs behind one Nginx-hosted frontend. The frontend's runtime selector can direct
operations to either peer or to a comparing adapter.

Compare mode sends the same definition, answer-validation, submission, and Response
Snapshot round-trip operations
to both APIs concurrently. It compares stable observable facts: canonical definitions;
diagnostic code, path, and severity; validation identity; lifecycle outcome; response
data; score; definition digest; tagged snapshot JSON; and restored data. Human-facing
message prose is excluded because it is not part of the cross-language contract.

A definition or submission mismatch is shown and rejected. An answer-validation
mismatch fails closed and blocks navigation. The comparison adapter composes two
ordinary `DemoRuntime` implementations; UI components do not know how fan-out or
comparison works.

## Consequences

- The demo can show compatibility live while still allowing either runtime to be
  inspected independently.
- Both runtimes cross the same transport boundary and use the same authored input.
- A compatibility mismatch cannot be hidden behind a successful response from one
  runtime.
- The TypeScript demo gains a small Node HTTP host and container, increasing build
  cost but removing its browser-only special case.
- This is an integration demonstration. `conformance/v*/` remains the exhaustive,
  versioned semantic authority.

## Parent and related links

- [ADR index](./README.md)
- [Superseded deployment decision](./0032-compose-sdk-demo-profiles.md)
- [Versioned runtime contract](./0020-versioned-cross-language-runtime-contract.md)
