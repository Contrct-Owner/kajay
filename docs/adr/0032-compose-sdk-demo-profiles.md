# ADR-0032: One SDK demo frontend with Compose runtime profiles

- Area: SDK demonstrations and deployment
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

Kajay has a published TypeScript product and a native C# SDK. Separate demos would
quickly differ in survey definition, user experience, and proof depth, making visual
differences look like runtime differences. The C# SDK is headless, while the renderer
and Creator are currently TypeScript React packages.

The demo also needs to be easy to start without installing both language toolchains,
and it must show real host responsibilities instead of wrapping SDK calls in sample-only
abstractions.

## Decision

Maintain one feature-oriented TypeScript frontend for the renderer and Creator. It
depends on a narrow `DemoRuntime` capability with two maintained adapters:

- `HttpDemoRuntime` calls a C# 14 ASP.NET Core API;
- `LocalDemoRuntime` calls `@kajay/core` directly in the browser.

Docker Compose selects those deployments with mutually exclusive `dotnet` and
`typescript` profiles. Both serve the same URL and the same authored definition. The
.NET profile uses Nginx as the same-origin frontend and API proxy; the TypeScript profile
needs no API process.

The C# API keeps endpoints thin. `DemoSurveyApplication` owns parsing,
canonicalization, answer conversion, lifecycle advancement, validation, and scoring
through public `Kajay.Core` interfaces. It is stateless: the browser owns interactive
renderer state and the API authoritatively replays final submissions.

The demo definition is stored once under `apps/sdk-demo/public/` and embedded into the
C# API at build time. The demo contract is application-local and does not replace or
extend the adapter-neutral conformance corpus.

## Consequences

- Framework profiles compare SDK behavior without also changing the UI.
- Adding another server runtime means implementing the same small application contract
  and adding a Compose profile; it does not fork the frontend.
- The C# API proves host validation and lifecycle use, not merely JSON parsing.
- Stateless replay makes multiple containers and concurrent users safe, at the cost of
  performing final validation separately from the browser's interactive validation.
- Both profiles intentionally bind port 4173, so only one profile should run at once.
- The frontend remains a TypeScript application even in the .NET profile because the
  currently published renderer and Creator are React packages.

## Parent and related links

- [ADR index](./README.md)
- [SDK demo guide](../sdk-demos.md)
- [C# SDK architecture](./0031-csharp-sdk-source-and-namespace-architecture.md)
