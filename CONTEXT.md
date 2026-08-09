# Kajay Project Context

- Area: Repository orientation and current project state
- Status: active
- Owner: Jarod
- Last updated: 2026-08-08

Kajay is an embedded survey runtime and Creator whose authoritative JSON definition and
versioned behavior contract support maintained native runtimes.

## Current state

- **TypeScript 1.0.0 is published.** The runtime, React adapter, Creator, Creator React
  adapter, and themes ship as the five `@kajay/*` packages.
- **Functional parity is delivered.** Checklist sections A–N and the assembled-Creator
  acceptance path are backed by named unit, browser, site E2E, conformance, and pack
  proofs.
- **`Kajay.Core` 1.0.0 is published on NuGet.** It targets .NET 10 and implements the
  framework-independent runtime behind the shared schema and conformance seam. Its
  version train is independent of the npm packages ([ADR-0030](./docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md));
  interoperability is claimed by schema and conformance version, never by version equality.
- **Kajay.io is the only application.** `apps/site` owns the marketing page,
  documentation, read-only documentation MCP endpoint, and playground.
- **Host policy is out of SDK scope.** Persistence, identity, authorization, workflow,
  audit, promotion, and deployment are responsibilities of consuming applications.

## Repository graph

```text
@kajay/core ← @kajay/react
      ↑
@kajay/creator-core ← @kajay/creator-react → @kajay/react

@kajay/themes is dependency-free.
apps/site consumes public TypeScript package exports only.
Kajay.Core independently implements the shared headless contract.
```

`@kajay/core` and `@kajay/creator-core` are DOM-free. React packages are adapters. No
package imports `@kajay/themes`; applications explicitly import its CSS or theme values.

## Topic index

| Topic | Authoritative detail |
| --- | --- |
| Product vision and package graph | [North Star](./docs/NORTH_STAR.md) |
| Repository ownership | [Repository organization](./REPOSITORY_ORGANIZATION.md) |
| Development and test policy | [Library development guidelines](./docs/library-development-guidelines-details.md) |
| Functional acceptance | [Feature-parity checklist](./docs/feature-parity-checklist.md) |
| Published TypeScript interfaces | [Public interface ledger](./docs/public-package-interfaces.md) |
| Native C# SDK | [ADR-0030](./docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md), [parity §Q](./docs/feature-parity-checklist.md#q--c-headless-sdk) |
| Cross-runtime behavior | [Conformance v1](./conformance/v1/README.md), [v2](./conformance/v2/README.md) |
| Repository scope decision | [ADR-0045](./docs/adr/0045-focus-repository-on-sdks-and-site.md) |
| Architecture decisions | [ADR index](./docs/adr/README.md) |

## Core vocabulary

- **Definition** — authoritative JSON describing an authored survey.
- **Survey** — the live headless runtime model: definition, answers, navigation,
  validation, expressions, events, and lifecycle.
- **Response Snapshot** — a versioned, definition-bound representation of response data
  and resumable runtime state. It contains no persistence, tenancy, authorization, or
  workflow metadata.
- **Creator** — the embeddable authoring product formed from headless Creator models and
  framework adapters.
- **Contract** — committed generated JSON defining schema, metadata, and stable
  diagnostics.
- **Conformance corpus** — adapter-neutral JSON cases for observable runtime behavior.
- **Runtime adapter** — one language's implementation of the conformance operations.
- **Host** — a consuming application that composes SDK packages and owns environmental
  policy such as storage, identity, orchestration, and deployment.

## Recent decision

On 2026-08-08 the repository retired its exploratory demo, workflow, promotion, and local
infrastructure applications. Their architectural findings remain in ADR history; the
maintained source now reflects the product boundary directly. See
[ADR-0045](./docs/adr/0045-focus-repository-on-sdks-and-site.md).
