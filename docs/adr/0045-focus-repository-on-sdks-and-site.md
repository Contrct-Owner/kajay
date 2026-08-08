# ADR-0045 — Focus the repository on the SDKs and Kajay.io

- Area: Repository and product boundaries
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-08

## Context

The repository accumulated a host demo, two runtime-specific demo APIs, Docker Compose
profiles, an authenticated workflow host, a promotion CLI, and related UI and integration
tests. Those projects answered useful design questions: the C# and TypeScript runtimes can
share contracts, Response Snapshots can cross runtime boundaries, and persistence,
authorization, promotion, and workflow policy can remain outside an SDK.

After those questions were settled, keeping the proof applications as supported products
made the repository imply a broader product than Kajay actually ships. Their framework and
infrastructure dependencies also obscured the survey engine and made ordinary SDK changes
carry unrelated application maintenance.

## Decision

The maintained repository contains:

- the five published TypeScript packages;
- the native `Kajay.Core` .NET 10+ package, its sample, benchmarks, and tests;
- committed contracts and versioned cross-runtime conformance corpora; and
- `apps/site` as the only first-party application, owning Kajay.io marketing,
  documentation, and playground behavior.

The exploratory host demo, dual-runtime HTTP demo, workflow host, promotion CLI, Compose
configuration, WorkOS integration, Elsa integration, and their application-specific tests
are removed. Cross-runtime compatibility is proven directly by both SDK adapters running
the same conformance corpus and by installed-package smoke tests.

Persistence, identity, authorization, workflow orchestration, audit, environment
promotion, and deployment remain consuming-host responsibilities. The SDKs may expose
portable data and execution seams needed by those hosts, but they do not implement host
policy or ship a reference control plane.

## Consequences

- A clean checkout has one web application and six publishable SDK projects: five npm
  packages and one NuGet package.
- Site E2E tests replace the small set of application-level acceptance proofs that remain
  product obligations: published theme CSS, keyboard operation, accessibility, and the
  marketing/docs/playground journeys.
- Package unit, browser, conformance, and pack tests remain the primary parity evidence.
- The workflow and dual-runtime demo ADRs remain as historical design records but no longer
  describe maintained applications.
- ADR-0034 remains accepted because portable Response Snapshots are part of SDK
  interoperability. ADR-0033 and ADRs 0035–0044 are superseded for maintained repository
  scope by this decision.

## Parent and related links

- [Repository organization](../../REPOSITORY_ORGANIZATION.md)
- [Project context](../../CONTEXT.md)
- [North Star](../NORTH_STAR.md)
- [Portable Response Snapshot contract](./0034-portable-response-snapshot-contract.md)

