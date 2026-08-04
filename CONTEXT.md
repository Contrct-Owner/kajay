# Kajay Survey Project Context

- Area: Repository orientation and current project state
- Status: active
- Owner: Jarod
- Last updated: 2026-08-04

Kajay Survey is a TypeScript-native survey runtime and Creator whose headless packages
are consumed through framework adapters and proved through a separate host application.

## Current state

- **Functional parity: delivered.** Checklist sections A–N and the N5 assembled-Creator
  acceptance proof are green. This establishes the functional Phase 3 exit evidence.
- **Publication: explicitly on hold.** All packages remain private, `0.0.0`, and
  `UNLICENSED`. Brand/scope, license, first version, version train, and release tooling
  are deliberately deferred until an owner walkthrough; see
  [ADR-0024](./docs/adr/0024-publication-hold.md).
- **Architecture remediation: implemented for the unpublished posture.** Correctness,
  module-depth, enforcement, documentation, public-interface, and integration slices
  are complete. The [architecture remediation plan](./docs/architecture-remediation-plan.md)
  closes release activation through the explicit publication hold.
- **Cross-runtime compatibility: one adapter.** The versioned corpus is real and the
  TypeScript adapter passes it, but no second runtime adapter exists. Quiz scoring is
  intentionally outside conformance v1.

## Topic index

| Topic | Status | Owner | Authoritative detail |
| --- | --- | --- | --- |
| Product vision and package graph | active | Jarod | [North Star](./docs/NORTH_STAR.md) |
| Delivery phases and exit gates | active | Jarod | [Delivery roadmap](./docs/delivery-roadmap.md) |
| Functional acceptance evidence | active | Jarod | [Feature-parity checklist](./docs/feature-parity-checklist.md) |
| Development and test policy | active | Jarod | [Library development guidelines](./docs/library-development-guidelines-details.md) |
| Architecture decisions | active | Jarod | [ADR index](./docs/adr/README.md) |
| Current remediation work | complete for unpublished posture | Jarod | [Architecture remediation plan](./docs/architecture-remediation-plan.md) |
| Published package interfaces | active | Jarod | [Public interface ledger](./docs/public-package-interfaces.md) |
| Definition shape | active | Jarod | [Generated survey schema](./contracts/survey-schema.json) |
| Runtime compatibility | active, one adapter | Jarod | [Conformance v1](./conformance/v1/README.md) |
| Publishing and licensing | publication hold | Jarod | [ADR-0024](./docs/adr/0024-publication-hold.md) |

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
- **Host** — consuming application that supplies environment policy and composes the
  packages through published interfaces.
- **Publication hold** — the binding current decision to keep packages unpublished;
  it deliberately does not settle brand, scope, license, version, or release tooling.

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

- 2026-08-04: Created the root context index, glossary, and explicit distinction
  between functional acceptance and release readiness.
- 2026-08-04: Made the difference between an executable conformance contract and
  demonstrated cross-runtime compatibility explicit.
- 2026-08-04: Completed all non-release architecture remediation and recorded every
  runtime package value in the public-interface ledger.
- 2026-08-04: Recorded an explicit publication hold while release-policy choices await
  an owner walkthrough.
