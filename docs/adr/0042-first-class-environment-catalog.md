# ADR-0042 — Environments are versioned host-owned promotion targets

- Area: Workflow-host environment and promotion operations
- Status: superseded by 0045
- Owner: Jarod
- Last updated: 2026-08-08

## Context

Activations, bindings, and workflow instances previously carried an Environment name
without an authoritative Environment resource. The Managed UI inferred its picker
from those downstream records, and production approval was encoded as a comparison
with the literal name `production`. That made a typo capable of creating policy,
prevented custom approval targets, and left binding administration without a distinct
authorization or concurrency boundary.

Environment configuration is host policy. It must not enter `Kajay.Core`, a Definition
Release, or the portable promotion runner. A separate deployed control plane still has
no fleet-wide scheduling or ownership responsibility that would justify duplicating
the workflow host's authority.

## Decision

`Kajay.Workflow.Host` owns a tenant-scoped Environment catalog. An Environment has an
immutable lowercase slug, mutable display name, ordering position, approval-required
policy, audit metadata, and an optimistic-concurrency version. Activation, bindings,
and workflow instances reference that catalog. An unknown target fails closed.

The first Managed Definition created for a tenant seeds `development`, `test`,
`staging`, and `production`. Production is merely the default Environment whose seeded
policy requires approval; activation consults the selected Environment's policy, not
its name. Custom Environments can require the same separate
`kajay:definition:approve` authority. The migration backfills defaults plus every
legacy target before adding foreign keys.

Catalog and binding mutations require the separate `kajay:environment:manage`
permission and an `If-Match` version. Reading the catalog and binding metadata requires
`kajay:definition:manage`. Binding references are accepted on writes but are never
returned from the API, audit payload, provenance view, or Managed UI. Replacing a
reference increments its metadata version; removing one is also version checked.

Installed-release preflight evaluates one catalog Environment and its current binding
metadata without exporting or re-uploading the bundle. Promotion status remains a
derived `active`, `ready`, or `blocked` fact. First activation and rollback use the
same audited, version-checked Activation command; rollback is only a UI label for a
release known to have been active previously.

Local WorkOS Emulate includes distinct human and M2M Environment-manager identities.
Routine promotion and approval credentials do not gain Environment administration.

## Consequences

- Environment names can no longer be invented implicitly by an activation, binding,
  or workflow request.
- Approval policy can be settled before usage and applied consistently to custom
  targets without code changes.
- A binding reference cannot be recovered through the management API; operators must
  replace a lost reference.
- Imported promotion into a new tenant requires Environment provisioning first.
- The SDK remains limited to portable survey behavior, while the host owns deployment
  policy, secrets, identity, persistence, and operator UI.
- A future control plane can orchestrate these host APIs, but it does not own duplicate
  Environment state.

## Verification

`EnvironmentManagementFlowTests` proves catalog creation/update, ETags, write-only
binding metadata, stale-write rejection, and approval policy on a non-production
Environment through authenticated HTTP and PostgreSQL. `MachinePromotionFlowTests`
proves Environment provisioning uses a separate WorkOS M2M credential. The real-
Chromium Managed UI proof covers policy editing and write-only binding entry. Existing
promotion and provenance flows prove preflight, first activation, readiness, and
rollback against catalog targets.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [Definition promotion](./0036-definition-release-promotion.md)
- [WorkOS identity](./0037-workos-authenticated-workflow-host.md)
- [Managed release history](./0041-managed-release-history-and-provenance.md)
