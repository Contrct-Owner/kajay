# ADR-0041 — Managed release history is a host-owned derived read model

- Area: Managed Definition release operations and provenance
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-07

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
tenant-scoped management route returns a Managed Definition's first page of revision
history, release history, relevant management audit events, selected Environment
Activation, known environments, and promotion readiness:

```text
GET /api/management/definitions/{name}/provenance?environmentName={environment}
```

Each history is a `{ items, nextCursor }` envelope. Operators page and filter one
collection independently through its dedicated route without reloading the other
provenance state:

```text
GET /api/management/definitions/{name}/provenance/revisions?limit=&cursor=&query=
GET /api/management/definitions/{name}/provenance/releases?environmentName=&limit=&cursor=&query=&status=
GET /api/management/definitions/{name}/provenance/audit?environmentName=&limit=&cursor=&query=
```

Pages default to 20 records and reject limits outside 1–100. Cursors are opaque,
versioned Base64URL keysets scoped to their collection; malformed or cross-collection
cursors fail with `400` rather than silently restarting. Revision search covers actor
and Definition Digest, release search covers version label and digest, release status
accepts `active`, `ready`, or `blocked`, and audit search covers event type, actor, and
subject. Search treats `%`, `_`, and `\\` as literal input rather than SQL patterns.

Candidate and rollback review uses another tenant-scoped read through the same host
module family:

```text
GET /api/management/definitions/{name}/provenance/releases/{digest}/comparison
    ?environmentName={environment}&baselineDigest={optional-digest}
```

Without an explicit baseline, the selected Environment's active release is the
baseline. A target with no active baseline is reported as an initial release rather
than manufacturing a diff from an empty document. Both releases must belong to the
same tenant and Managed Definition.

The host compares semantic release artifacts, not bundle bytes or content-addressed
identifiers. It embeds each survey Definition into its workflow step, removes the
resulting digest-only churn, sorts required bindings, and aligns arrays of objects by
stable `name` or `key` identity before falling back to index comparison. The result
groups added, removed, and changed values into `definition`, `workflow`, `bindings`,
and `compatibility` areas. Values are compact previews capped at 160 characters; a
response returns at most 200 changes and says when it was truncated. This is a review
read model, not a patch format or an input to Activation.

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
resource. An Environment whose configured policy requires approval also requires
`kajay:definition:approve` under [ADR-0042](./0042-first-class-environment-catalog.md).

Authored release provenance is stored as an explicit many-to-many relation between a
release digest and immutable Revision. Identical authored content can legitimately
connect more than one Revision to the same content-addressed release; imported
`.kajay` releases can have no local Revision. The migration backfills existing links
from release-creation audit facts. New relation writes use a transaction-scoped lock
and are idempotent.

Management audit remains append-only evidence, not the source of current Activation,
binding, release, or revision state. The read model uses Activation events only for
historical questions: actor attribution and whether a release was previously active.
The displayed audit timeline is paged independently from a compact query that keeps
the latest Activation fact per release, so an old rollback candidate does not
disappear after 100 newer management events. The reader accepts legacy PascalCase
audit payload fields as well as the canonical camelCase fields; all new activation and
release-creation events use camelCase.

The Managed UI owns the operator experience. It composes separate activation,
release, revision, and audit views, shows missing bindings, and requires an inline
confirmation before rollback. An inactive release exposes its semantic change review
against the active Environment artifact; Activation confirmation stays disabled until
that exact target's comparison succeeds. The browser sends `If-Match`; a concurrent
promotion therefore produces `412 Precondition Failed` and refreshes the view.

## Consequences

- SDKs remain unaware of persistence, environments, audit identities, and rollback.
- Operators can explain an active artifact from authored Revision through Activation
  without reconstructing relationships from opaque JSON audit payloads.
- Promotion status cannot drift because it is derived from Activation and bindings.
- Imported releases remain visible and promotable while honestly reporting their
  source as imported rather than inventing a local Revision.
- Collection-specific keyset pages avoid offset drift and prevent the initial
  provenance view from materializing unbounded operational history.
- Release status remains derived rather than persisted. A filtered page may therefore
  scan bounded 100-row keyset batches until it fills the requested page.
- Review paths are stable for named survey pages, elements, and workflow steps, so an
  insertion does not turn every later array member into an apparent change.
- The comparison deliberately does not claim that an artifact is safe to activate;
  Environment bindings, approval policy, and optimistic concurrency remain enforced
  by preflight and Activation.
- A separate promotion control plane remains deferred to fleet-wide ownership,
  scheduling, or policy requirements.

## Verification

`DefinitionProvenanceFlowTests` uses PostgreSQL and authenticated HTTP to prove
tenant isolation, revision-to-release lineage, active/ready/blocked derivation,
activation actor attribution, audit visibility, rollback eligibility, the
version-checked rollback transition, cursor continuity, filters, and invalid-cursor
rejection. The TypeScript schema proof rejects malformed page envelopes. The
real-Chromium Managed UI proof covers missing-binding display, inline rollback
confirmation, the `If-Match` header, refreshed Activation state, incremental loading,
filter requests that restart without an old cursor, semantic change rendering, and a
comparison failure that remains local to the review.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [Workflow host guide](../workflow-host.md)
- [Workflow host ownership](./0035-workflow-host-owns-durable-orchestration.md)
- [Definition promotion](./0036-definition-release-promotion.md)
- [Managed authoring](./0039-managed-definition-authoring-lifecycle.md)
- [Promotion automation](./0040-promotion-cli-and-workos-machine-identity.md)
- [Environment catalog](./0042-first-class-environment-catalog.md)
