# ADR-0041 — Managed release history is a host-owned derived read model

- Area: Managed Definition release operations and provenance
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

The Managed Creator can produce Drafts, Revisions, and Definition Releases, and the
promotion routes can install and activate releases. Operators still need one coherent
view that explains which authored state produced an artifact, whether that artifact
can activate in an Environment, what is active now, who changed it, and which prior
release can be restored safely.

Those facts cross authoring, promotion, Environment Bindings, Activation, identity,
and audit. They are host policy and persistence concerns. Adding them to `Kajay.Core`
would make the portable SDK aware of tenants, environments, deployment state, and
operators. A separate control-plane application would duplicate the host's authority
before fleet-wide scheduling or policy has earned another deployable.

## Decision

`DefinitionProvenanceApplication` is a query module inside `Kajay.Workflow.Host`. One
tenant-scoped management route returns a Managed Definition's revision history,
release history, selected Environment Activation, known environments, promotion
readiness, and latest 100 relevant management audit events:

```text
GET /api/management/definitions/{name}/provenance?environmentName={environment}
```

The route requires `kajay:definition:manage`. It assembles a read model from
authoritative normalized state; it does not create another mutable projection table.
Release status is derived at read time:

- `active` means the release is the selected Environment Activation;
- `blocked` means one or more required Environment Bindings are absent; and
- `ready` means the installed release is compatible with the selected Environment.

Rollback eligibility is narrower than readiness. A release must be inactive, have no
missing binding, and appear in that Environment's Activation history. Rollback uses
the existing Activation command with the current Activation ETag. It is another
audited pointer update, not a destructive release mutation or a separate rollback
resource. Production continues to require `kajay:definition:approve`.

Authored release provenance is stored as an explicit many-to-many relation between a
release digest and immutable Revision. Identical authored content can legitimately
connect more than one Revision to the same content-addressed release; imported
`.kajay` releases can have no local Revision. The migration backfills existing links
from release-creation audit facts. New relation writes use a transaction-scoped lock
and are idempotent.

Management audit remains append-only evidence, not the source of current Activation,
binding, release, or revision state. The read model uses Activation events only for
historical questions: actor attribution and whether a release was previously active.
The displayed audit timeline is bounded independently from a compact query that keeps
the latest Activation fact per release, so an old rollback candidate does not
disappear after 100 newer management events. The reader accepts legacy PascalCase
audit payload fields as well as the canonical camelCase fields; all new activation and
release-creation events use camelCase.

The Managed UI owns the operator experience. It composes separate activation,
release, revision, and audit views, shows missing bindings, and requires an inline
confirmation before rollback. The browser sends `If-Match`; a concurrent promotion
therefore produces `412 Precondition Failed` and refreshes the view.

## Consequences

- SDKs remain unaware of persistence, environments, audit identities, and rollback.
- Operators can explain an active artifact from authored Revision through Activation
  without reconstructing relationships from opaque JSON audit payloads.
- Promotion status cannot drift because it is derived from Activation and bindings.
- Imported releases remain visible and promotable while honestly reporting their
  source as imported rather than inventing a local Revision.
- The current API returns a bounded audit window. Cursor pagination can be added when
  real event volume requires it without changing the source-of-truth model.
- A separate promotion control plane remains deferred to fleet-wide ownership,
  scheduling, or policy requirements.

## Verification

`DefinitionProvenanceFlowTests` uses PostgreSQL and authenticated HTTP to prove
tenant isolation, revision-to-release lineage, active/ready/blocked derivation,
activation actor attribution, audit visibility, rollback eligibility, and the
version-checked rollback transition. The TypeScript schema proof rejects malformed
external payloads. The real-Chromium Managed UI proof covers missing-binding display,
inline rollback confirmation, the `If-Match` header, and refreshed Activation state.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [Workflow host guide](../workflow-host.md)
- [Workflow host ownership](./0035-workflow-host-owns-durable-orchestration.md)
- [Definition promotion](./0036-definition-release-promotion.md)
- [Managed authoring](./0039-managed-definition-authoring-lifecycle.md)
- [Promotion automation](./0040-promotion-cli-and-workos-machine-identity.md)
