# ADR-0035 — The workflow host owns durable orchestration

- Area: SDK and host application architecture
- Status: superseded by 0045
- Owner: Jarod
- Last updated: 2026-08-08

## Context

Kajay's survey semantics must be portable across embedded runtimes, while a complete
workflow product also needs persistence, tenancy, authorization, scheduling, effects,
and operational policy. Publishing those host concerns as `Kajay.Core` behavior would
make one application's infrastructure part of every SDK consumer's compatibility
contract.

## Decision

Keep the SDK seam portable. `Kajay.Core` owns definitions, execution, validation,
Kajay values, Definition Digests, and Response Snapshots. A modular-monolith workflow
host owns PostgreSQL/EF Core persistence, workflow definitions and instances, tenancy,
authorization, optimistic concurrency, idempotency, audit events, transactional
outbox/inbox delivery, durable deadlines, environment bindings, HTTP, and workers.

The host begins with a deep application module whose command interface hides loading,
rehydration, concurrency, transition, audit, and outbox commit. It stores a current
snapshot plus an append-only audit event log; it does not begin as a fully event-sourced
system. External effects are delivered at least once after commit under stable effect
identities. Workflow Instances remain pinned to immutable workflow and survey
Definition Releases.

The workflow implementation is not published as an SDK package until a second genuine
host proves a reusable seam. PostgreSQL and an EF Core/Npgsql adapter are host choices;
`Kajay.Core` remains BCL-only and references no hosting or persistence framework.

## Consequences

- The SDK can evolve and conform without acquiring environment or database policy.
- The initial deployment stays solo-operable as an API, worker, PostgreSQL, and
  optional object/artifact storage rather than a microservice fleet.
- Extracting a reusable workflow package remains possible, but only after real reuse
  supplies its interface.

## Parent and related links

- [ADR-0034 — portable response snapshot contract](./0034-portable-response-snapshot-contract.md)
- [ADR-0036 — definition release promotion](./0036-definition-release-promotion.md)
- [North Star](../NORTH_STAR.md)

