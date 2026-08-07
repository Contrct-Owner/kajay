# ADR-0043 — Elsa executes host-owned durable workflows

- Area: Workflow-host execution and response persistence
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-07

## Context

The first workflow-host tracer implemented survey, delay, effect, and terminal steps
with a small custom state machine, scheduled-action worker, and effect outbox. That
proved the SDK/host ownership seam, but extending the implementation into human work,
review cycles, branching, escalation, and long-running operations would make Kajay
responsible for a general-purpose workflow engine. The portable SDK must still own
survey semantics, while Definition Releases and host interfaces must remain stable
across workflow-engine upgrades.

The existing instance record also stores only the active Response Snapshot and clears
it when execution enters another step. A completed response therefore has no
first-class immutable identity for later review, audit, or workflow correlation.

## Decision

`Kajay.Workflow.Host` embeds Elsa Workflows 3.7.1 as its internal durable execution
engine with EF Core PostgreSQL persistence and clustered Quartz scheduling backed by
the same PostgreSQL service. The host compiles the portable workflow
graph from each immutable Definition Release into Elsa activities. Elsa definition,
instance, activity, and bookmark models do not enter `.kajay` artifacts, Kajay SDKs,
or the host's external HTTP contracts.

Starting a Kajay Workflow Instance, accepting a Survey Submission, and acknowledging
an Effect each commit a durable resume command before invoking Elsa. A survey step
compiles to a Kajay-owned blocking Elsa activity. Entering it opens a
Survey Attempt and suspends on a bookmark correlated to the Kajay Workflow Instance,
step, and attempt. Autosave changes only the attempt's Response Snapshot. Accepting a
completed attempt creates an immutable Survey Submission and a durable resume command;
the resume is idempotent and may complete asynchronously after the submission
transaction. Downstream work refers to the Survey Submission rather than mutable
instance state.

Elsa is authoritative for orchestration position, suspension, delay, and completion.
Kajay retains a host-owned projection for authenticated queries, optimistic
concurrency, audit, and operational state. Effects continue through stable,
at-least-once Kajay outbox identities so an engine retry cannot duplicate an
unidentified external action. WorkOS remains the identity provider; it does not own
workflow tasks or decisions.

The migration replaces the custom traversal rather than maintaining two independently
authoritative state machines. Existing authenticated HTTP tracers are the replacement
test surface.

## Consequences

- Workflow-engine persistence and migrations become host infrastructure, not SDK
  dependencies or cross-language conformance behavior.
- A committed Survey Submission survives later steps and response revisions.
- Kajay commands and Elsa execution are deliberately eventually consistent;
  the durable outbox closes the failure window without a cross-context transaction.
- PostgreSQL advisory locking serializes compilation registration across replicas;
  Quartz clustering transfers persisted delays during rolling restarts.
- Elsa Studio is not initially a product authoring surface. Kajay Definition Releases
  remain the promoted authority and the Managed UI remains the operator surface.
- Engine upgrades require workflow-host compatibility and restart tests but do not
  change SDK or `.kajay` consumers.

## Verification

`Kajay.Workflow.Host.Tests` proves immutable submission history, idempotent acceptance
and resumption, release pinning, concurrent definition registration, Quartz delay
failover between host replicas, stable effect delivery, dead-letter behavior, and the
absence of Elsa implementation details from host contracts through authenticated HTTP
and PostgreSQL.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [Workflow host guide](../workflow-host.md)
- [Host ownership decision](./0035-workflow-host-owns-durable-orchestration.md)
- [Portable Response Snapshot](./0034-portable-response-snapshot-contract.md)
