# Kajay Survey Project Context

- Area: Repository orientation and current project state
- Status: active
- Owner: Jarod
- Last updated: 2026-08-07

Kajay Survey is an embedded survey runtime and Creator whose authoritative JSON
definition and versioned behavior contract support maintained native runtimes. The
published implementation is TypeScript; C# is the second runtime in development.

## Current state

- **Functional parity: delivered.** Checklist sections A–N and the N5 assembled-Creator
  acceptance proof are green. This establishes the functional Phase 3 exit evidence.
- **TypeScript 1.0.0: published.** All five packages are published under `@kajay/*`
  through the release policy in
  [ADR-0029](./docs/adr/0029-release-walkthrough.md). Licensing is MIT for
  `core`/`react`/`themes` and `FSL-1.1-ALv2` for the two Creator packages under
  [ADR-0028](./docs/adr/0028-mit-runtime-source-available-creator.md).
- **Architecture remediation: implemented for the 1.0 posture.** Correctness,
  module-depth, enforcement, documentation, public-interface, and integration slices
  are complete. The [architecture remediation plan](./docs/architecture-remediation-plan.md)
  supplied the release evidence behind 1.0.
- **C# SDK: release-ready; workflow host foundation active.** `Kajay.Core` targets
  `net10.0` and has met the §Q release gates. The host-owned workflow foundation now
  adds PostgreSQL persistence, concurrency, idempotency, audit, durable work, and
  `.kajay` promotion without expanding the SDK seam. WorkOS AuthKit access tokens now
  supply its organization boundary, actor attribution, permissions, and production
  approval authority; a Compose overlay provides seeded WorkOS Emulate login locally.
  Managed Definition Drafts now auto-save with optimistic concurrency, checkpoint to
  immutable Revisions, and assemble deterministic Definition Releases in the host.
  The separately packaged `kajay` .NET tool promotes those immutable releases using
  short-lived, organization-scoped WorkOS M2M tokens and a distinct production
  approval credential. The Managed UI now exposes revision and release history,
  explicit authored provenance, Environment Activation and readiness, management
  audit, and concurrency-checked rollback without expanding the SDK seam. Those
  histories use independently filterable, opaque cursor pages so operational volume
  does not make the composite view unbounded. Before activation or rollback, operators
  can review a bounded semantic artifact comparison against the Environment's active
  release without either SDK learning deployment policy.
  Environments are now first-class, versioned host resources with configurable
  approval policy and write-only, concurrency-checked bindings; the Managed UI owns
  their administration and installed-release preflight.

## Topic index

| Topic | Status | Owner | Authoritative detail |
| --- | --- | --- | --- |
| Product vision and package graph | active | Jarod | [North Star](./docs/NORTH_STAR.md) |
| Delivery phases and exit gates | active | Jarod | [Delivery roadmap](./docs/delivery-roadmap.md) |
| Functional acceptance evidence | active | Jarod | [Feature-parity checklist](./docs/feature-parity-checklist.md) |
| Development and test policy | active | Jarod | [Library development guidelines](./docs/library-development-guidelines-details.md) |
| Architecture decisions | active | Jarod | [ADR index](./docs/adr/README.md) |
| Current remediation work | complete for 1.0 posture | Jarod | [Architecture remediation plan](./docs/architecture-remediation-plan.md) |
| Published package interfaces | active | Jarod | [Public interface ledger](./docs/public-package-interfaces.md) |
| Definition shape | active | Jarod | [Generated survey schema](./contracts/survey-schema.json) |
| Runtime compatibility | v1: TypeScript 1.x; v2: two candidate adapters passing | Jarod | [Conformance v1](./conformance/v1/README.md), [v2](./conformance/v2/README.md) |
| Native C# SDK | implementation underway | Jarod | [ADR-0030](./docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md), [parity §Q](./docs/feature-parity-checklist.md#q--c-headless-sdk) |
| SDK demos | dual-runtime comparison active | Jarod | [Demo guide](./docs/sdk-demos.md), [ADR-0033](./docs/adr/0033-dual-runtime-compatibility-demo.md) |
| Workflow host | durable authenticated foundation active | Jarod | [Workflow host guide](./docs/workflow-host.md), [ADR-0035](./docs/adr/0035-workflow-host-owns-durable-orchestration.md), [ADR-0036](./docs/adr/0036-definition-release-promotion.md), [ADR-0037](./docs/adr/0037-workos-authenticated-workflow-host.md), [ADR-0038](./docs/adr/0038-workos-emulate-local-authentication.md), [ADR-0039](./docs/adr/0039-managed-definition-authoring-lifecycle.md), [ADR-0040](./docs/adr/0040-promotion-cli-and-workos-machine-identity.md), [ADR-0041](./docs/adr/0041-managed-release-history-and-provenance.md), [ADR-0042](./docs/adr/0042-first-class-environment-catalog.md) |
| Publishing and licensing | 1.0.0 published | Jarod | [ADR-0029](./docs/adr/0029-release-walkthrough.md) |
| Machine-readable documentation | preview | Jarod | [ADR-0025](./docs/adr/0025-read-only-documentation-mcp.md) |

## Package graph

```text
@kajay/core ← @kajay/react
      ↑
@kajay/creator-core ← @kajay/creator-react → @kajay/react

@kajay/themes is dependency-free and consumed by hosts.
apps/host-demo consumes public package exports only.
```

`@kajay/core` and `@kajay/creator-core` are DOM-free headless packages. React packages
are adapters. No package imports `@kajay/themes`; hosts import its CSS and theme data
explicitly. The exact dependency and export rules are build-failing checks.

## Domain glossary

- **Survey** — the live headless runtime model: definition, answers, navigation,
  validation, expressions, events, and lifecycle.
- **Definition** — authoritative JSON describing the authored survey. It is input to
  parsing and output from serialization and Creator editing.
- **Registry** — metadata module that owns registered types, properties, defaults,
  inheritance, factories, and schema-facing facts.
- **Question** — a page element that owns an answer or computed value.
- **Page** — an authored navigation step containing page elements.
- **Response** — respondent data and resumable runtime state; it is not a definition
  edit.
- **Response Snapshot** — a versioned, definition-bound, portable representation of a
  Response at one instant. It contains survey runtime state but no host persistence,
  tenancy, authorization, or workflow metadata.
- **Definition Digest** — the `sha256:` identity of one canonical Definition. A
  Response Snapshot names it so state cannot be restored against different survey
  semantics.
- **Managed Definition** — the logical authoring document whose revisions and releases
  are governed by a host.
- **Definition Draft** — the one mutable, canonical, concurrency-checked working state
  of a Managed Definition; it is not promotable.
- **Definition Revision** — an immutable checkpoint of one Definition Draft version and
  the only authoring state from which the host assembles a release.
- **Definition Release** — an immutable, content-addressed artifact assembled from an
  authored Revision or imported from another host, with its complete dependency
  closure. Identical authored Revisions may link to the same release digest.
- **Release Provenance** — the explicit host-owned relation from an authored immutable
  Revision to a content-addressed Definition Release. An imported release may have no
  local Revision provenance.
- **Workflow Definition** — the immutable graph inside a Definition Release that
  names steps and their transitions; it contains no live execution state.
- **Workflow Step** — one named node in a Workflow Definition. The initial host
  supports survey, delay, effect, and terminal steps.
- **Deployment** — a Definition Release installed and verified in one environment; it
  does not by itself select the release for new work.
- **Activation** — the atomic selection of an installed Definition Release for new
  instances of a Managed Definition.
- **Environment** — a tenant-owned, versioned host promotion target whose immutable
  name identifies mutable display, ordering, and approval policy.
- **Environment Binding** — host-owned configuration that supplies an environment's
  endpoints, secrets, and storage without changing a Definition Release. Its reference
  is write-only; only version and audit metadata are readable.
- **Creator** — the embeddable survey-authoring product formed from headless Creator
  models and framework adapters.
- **Design Surface** — Creator model and view of the authored page tree, selection,
  placement slots, and structural edits.
- **Placement** — one headless editing lifecycle that starts with a source, previews a
  valid slot, and ends in commit or abandonment.
- **Workspace** — the coherent lifetime owner for Creator configuration, registry,
  document, sessions, and disposal.
- **Session** — a focused editing model such as JSON, logic, translation, theme, or
  property editing, owned by a Creator workspace.
- **Renderer** — adapter selected by page-element type to draw runtime content.
- **Primitive** — a closed, replaceable host-design-system drawing role used by
  Creator React views.
- **Contract** — committed generated JSON artifacts defining schema, metadata, and
  stable diagnostics.
- **Conformance corpus** — versioned, adapter-neutral JSON cases for runtime behavior
  that schemas cannot express.
- **Runtime adapter** — one runtime's implementation of the conformance operations.
  A single adapter makes the contract executable; two maintained adapters passing the
  same corpus version are the minimum evidence for cross-runtime compatibility.
- **Kajay value** — one member of the closed cross-runtime expression algebra: absent,
  null, boolean, finite number, string, UTC instant, array, or object.
- **Kajay pattern** — a portable, bounded validation pattern from Pattern Profile v1;
  it is neither an ECMAScript nor a .NET regular expression.
- **Native SDK** — a language-native implementation of the embedded headless runtime,
  distributed independently while declaring the schema and conformance it supports.
- **Host** — consuming application that supplies environment policy and composes the
  packages through published interfaces.
- **Workflow Instance** — one durable execution pinned to immutable workflow and survey
  Definition Releases for its lifetime.
- **Workflow Command** — an idempotent, concurrency-checked request to change one
  Workflow Instance.
- **Workflow Audit Event** — an append-only fact recording an accepted Workflow
  Command or worker transition; it is inspectable history, not the source of truth.
- **Effect** — external work requested by a Workflow Instance and delivered at least
  once under a stable identity after the state transaction commits.
- **Scheduled Action** — a durable absolute-UTC deadline that submits an idempotent
  Workflow Command when due.
- **Outbox Message** — the durable delivery record for an Effect, committed atomically
  with Workflow Instance state and its Workflow Audit Event.
- **Authenticated Principal** — a validated WorkOS access-token identity. Its
  organization is the host tenant boundary, its subject is the audit actor, and its
  permissions authorize workflow and promotion capabilities.
- **Machine Principal** — a WorkOS M2M client-credentials identity whose `sub` is the
  audit actor, whose `org_id` is the tenant, and whose space-delimited scopes satisfy
  the same stable Kajay permissions as a human principal.
- **Promotion Runner** — the ephemeral `kajay promote` process that transfers one
  immutable release between authenticated hosts; it owns no durable state and is not
  a workflow host or control plane.
- **Publication hold** — the binding current decision to keep packages unpublished;
  it deliberately does not settle brand, scope, license, version, or release tooling.
- **Documentation MCP server** — the read-only `kajay.io/mcp` adapter that exposes
  generated reference facts and documentation search without survey runtime authority.

## Verification

Run the same complete chain as CI from the repository root:

```bash
pnpm run verify
```

The chain covers lint, TypeScript 7 and TypeScript 6 checking, architecture, test, and
parity policies, unit and real-browser tests, generated contracts, conformance, host
E2E, and installed-tarball consumer compatibility. See the
[development guidelines](./docs/library-development-guidelines-details.md) for the
meaning of each test seam.

## Related areas

- [Repository agent instructions](./AGENTS.md)
- [Architecture remediation plan](./docs/architecture-remediation-plan.md)
- [Public package interface ledger](./docs/public-package-interfaces.md)
- [North Star](./docs/NORTH_STAR.md)
- [Delivery roadmap](./docs/delivery-roadmap.md)

## Change log

- 2026-08-07: Made Environments authoritative versioned promotion targets, moved
  approval to Environment policy, and separated write-only binding administration.
- 2026-08-06: Defined the response-persistence and managed-definition promotion
  language, including the distinction between Deployment and Activation.
- 2026-08-06: Sharpened the host workflow language around immutable graphs,
  idempotent commands, durable deadlines, audit facts, effects, and outbox delivery.
- 2026-08-06: Implemented the C# 14 workflow-host foundation, PostgreSQL command
  transaction, durable workers, and immutable `.kajay` promotion path.
- 2026-08-06: Replaced trusted tenant, actor, and approver inputs with WorkOS AuthKit
  bearer authentication and permission policies.
- 2026-08-06: Added a pinned WorkOS Emulate Compose overlay, seeded separation-of-duty
  identities, and an opt-in host browser session that reuses bearer validation.
- 2026-08-06: Added concurrency-checked Managed Definition Drafts, immutable Revision
  checkpoints, server-side release assembly, and the authenticated Creator workflow.
- 2026-08-06: Added the packable `kajay` promotion CLI, scoped WorkOS M2M
  authorization, and separate routine-promotion and production-approval credentials.
- 2026-08-06: Added the Managed release-history and provenance read model, derived
  Environment readiness, audit timeline, and version-checked rollback controls.
- 2026-08-05: Completed the C# adapter's v1 definition operation: all seven cases and
  their fixed-point canonicalization rule pass through the public definition seam.
- 2026-08-05: Recorded the published TypeScript 1.0.0 posture and established the
  `Kajay.Core` native SDK, Kajay value/pattern vocabulary, and conformance v2 status.
- 2026-08-04: Created the root context index, glossary, and explicit distinction
  between functional acceptance and release readiness.
- 2026-08-04: Made the difference between an executable conformance contract and
  demonstrated cross-runtime compatibility explicit.
- 2026-08-04: Completed all non-release architecture remediation and recorded every
  runtime package value in the public-interface ledger.
- 2026-08-04: Recorded an explicit publication hold while release-policy choices await
  an owner walkthrough.
- 2026-08-04: Defined the read-only MCP contract for machine-readable consumer
  documentation.
