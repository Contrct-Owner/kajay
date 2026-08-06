# Kajay Survey Project Context

- Area: Repository orientation and current project state
- Status: active
- Owner: Jarod
- Last updated: 2026-08-05

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
- **C# SDK: implementation underway.** `Kajay.Core` targets
  `net10.0`; [ADR-0030](./docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md)
  fixes its package posture and Kajay's v2 value, date, pattern, performance, and
  support semantics. The TypeScript 2.x candidate and C# adapters pass the inherited
  v1 corpus and all 32 new v2 cases through public runtime seams. Full C# headless
  parity and the §Q release gates remain in progress.

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
