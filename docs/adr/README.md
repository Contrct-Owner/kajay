# Architecture Decision Records

- Area: Decision record index
- Status: established
- Owner: Jarod
- Last updated: 2026-08-02

Non-trivial decisions get an ADR. An ADR states the context, the decision, and the
consequences that follow from it — including the costs accepted. Reversals are
recorded here (status `superseded`) **and** in the
[North Star decision log](../NORTH_STAR.md#12-decision-log).

## Conventions

- Filename `NNNN-kebab-title.md`, numbered in the order decisions are taken.
- Status vocabulary: **accepted** (decided and binding), **proposed** (drafted, not
  yet ratified), **deferred** (deliberately not decided yet, with the constraints
  that keep it cheap to decide later), **superseded by NNNN**.
- A `deferred` ADR is not a placeholder. It exists to record the constraints that
  must hold *now* so the eventual decision stays reversible.

## Index

| ADR | Title | Status | Decided |
| --- | --- | --- | --- |
| [0001](./0001-own-definition-format.md) | Own survey definition format; SurveyJS converter deferred | accepted | 2026-08-02 |
| [0002](./0002-round-trip-fixed-point.md) | Round-trip bar is fixed-point equivalence, not byte stability | accepted | 2026-08-02 |
| [0003](./0003-hand-rolled-expression-parser.md) | Expression language: hand-rolled tokenizer + Pratt parser | accepted | 2026-08-02 |
| [0004](./0004-explicit-dependency-graph.md) | Core reactivity: explicit dependency graph, no signals library | accepted | 2026-08-02 |
| [0005](./0005-single-version-train.md) | Single version train released with changesets | accepted | 2026-08-02 |
| [0006](./0006-npm-scope.md) | npm scope `@kajay/*` | proposed | 2026-08-02 |
| [0007](./0007-license-and-repo-posture.md) | Private repo, unlicensed, decision deferred to Phase 2 exit | accepted | 2026-08-02 |
| [0008](./0008-no-surveyjs-theme-import.md) | No SurveyJS theme-JSON import; own token namespace | accepted | 2026-08-02 |
| [0009](./0009-creator-drag-and-drop.md) | Creator drag-and-drop implementation | deferred | 2026-08-02 |
| [0010](./0010-package-manifest-and-distribution.md) | Package manifest shape, Node floor, and CSS distribution | accepted | 2026-08-02 |
| [0011](./0011-contract-identity-and-format-version.md) | Contract identity and definition-format versioning | accepted | 2026-08-02 |
| [0012](./0012-typescript-dual-check.md) | TypeScript 6 primary, TypeScript 7 as the second checker | accepted | 2026-08-02 |
| [0013](./0013-lint-baseline.md) | oxlint baseline; `prefer-event-target` disabled as DOM-hostile | accepted | 2026-08-02 |
| [0014](./0014-supported-typescript-range.md) | Supported consumer TypeScript range: floor 5.5, tested matrix | accepted | 2026-08-02 |
| [0015](./0015-pnpm-workspace.md) | pnpm for the workspace; npm stays the consumer's business | accepted | 2026-08-02 |
| [0016](./0016-metadata-owns-property-defaults.md) | Metadata descriptors own property defaults; unset ≠ empty | accepted | 2026-08-02 |
| [0017](./0017-choices-url-environment-portability.md) | `choicesByUrl` origin belongs to the host, not the definition | accepted | 2026-08-02 |

## Parent and related links

- [North Star](../NORTH_STAR.md)
- [Delivery roadmap](../delivery-roadmap.md)
- [Feature-parity checklist](../feature-parity-checklist.md)
