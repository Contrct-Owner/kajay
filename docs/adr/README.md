# Architecture Decision Records

- Area: Decision record index
- Status: established
- Owner: Jarod
- Last updated: 2026-08-12

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
| [0005](./0005-single-version-train.md) | Single version train released with changesets | superseded by 0029 | 2026-08-02; resolved 2026-08-05 |
| [0006](./0006-npm-scope.md) | npm scope `@kajay/*` | accepted | 2026-08-02; condition met 2026-08-05 |
| [0007](./0007-license-and-repo-posture.md) | Private repo, unlicensed, decision deferred to Phase 2 exit | superseded by 0028 | 2026-08-02; resolved 2026-08-04 |
| [0008](./0008-no-surveyjs-theme-import.md) | No SurveyJS theme-JSON import; own token namespace | accepted | 2026-08-02 |
| [0009](./0009-creator-drag-and-drop.md) | Creator drag-and-drop implementation | accepted | 2026-08-03 |
| [0010](./0010-package-manifest-and-distribution.md) | Package manifest shape, Node floor, and CSS distribution | accepted | 2026-08-02 |
| [0011](./0011-contract-identity-and-format-version.md) | Contract identity and definition-format versioning | accepted | 2026-08-02 |
| [0012](./0012-typescript-dual-check.md) | TypeScript 6 primary, TypeScript 7 as the second checker | accepted | 2026-08-02 |
| [0013](./0013-lint-baseline.md) | oxlint baseline; `prefer-event-target` disabled as DOM-hostile | accepted | 2026-08-02 |
| [0014](./0014-supported-typescript-range.md) | Supported consumer TypeScript range: floor 5.5, tested matrix | accepted | 2026-08-02 |
| [0015](./0015-pnpm-workspace.md) | pnpm for the workspace; npm stays the consumer's business | accepted | 2026-08-02 |
| [0016](./0016-metadata-owns-property-defaults.md) | Metadata descriptors own property defaults; unset ≠ empty | accepted | 2026-08-02 |
| [0017](./0017-choices-url-environment-portability.md) | `choicesByUrl` origin belongs to the host, not the definition | accepted | 2026-08-02 |
| [0018](./0018-input-masking-out-of-scope.md) | Input masking is out of parity scope | accepted | 2026-08-02 |
| [0019](./0019-deep-runtime-modules-and-rendering-seam.md) | Deep runtime modules and one page-element rendering seam | accepted | 2026-08-02 |
| [0020](./0020-versioned-cross-language-runtime-contract.md) | Versioned cross-language runtime contract | accepted | 2026-08-03 |
| [0021](./0021-creator-composition.md) | Creator composition: pieces, with a default assembly on top | accepted | 2026-08-03 |
| [0022](./0022-design-system-primitives.md) | The host's design system draws the chrome | accepted | 2026-08-03 |
| [0023](./0023-the-creator-says-what-happened.md) | The Creator says what happened | accepted | 2026-08-04 |
| [0024](./0024-publication-hold.md) | Publication hold pending an explicit release walkthrough | superseded by 0029 | 2026-08-04 |
| [0025](./0025-read-only-documentation-mcp.md) | Expose Kajay documentation through a read-only MCP server | accepted | 2026-08-04 |
| [0026](./0026-canvas-affordances.md) | What the canvas edits, and what the grid does | accepted | 2026-08-04 |
| [0027](./0027-retain-parse-survey-calling-modes.md) | Retain both `parseSurvey` calling modes | accepted | 2026-08-04 |
| [0028](./0028-mit-runtime-source-available-creator.md) | MIT runtime, source-available Creator | accepted | 2026-08-04 |
| [0029](./0029-release-walkthrough.md) | The release walkthrough | accepted | 2026-08-05 |
| [0030](./0030-native-csharp-sdk-and-v2-runtime-semantics.md) | Native C# SDK and v2 runtime semantics | accepted | 2026-08-05 |
| [0031](./0031-csharp-sdk-source-and-namespace-architecture.md) | C# SDK source and namespace architecture | accepted | 2026-08-05 |
| [0032](./0032-compose-sdk-demo-profiles.md) | One SDK demo frontend with Compose runtime profiles | superseded by 0033 | 2026-08-06 |
| [0033](./0033-dual-runtime-compatibility-demo.md) | Compare C# and TypeScript through symmetric HTTP peers | superseded by 0045 | 2026-08-06 |
| [0034](./0034-portable-response-snapshot-contract.md) | Portable, definition-bound response snapshots | accepted | 2026-08-06 |
| [0035](./0035-workflow-host-owns-durable-orchestration.md) | The workflow host owns durable orchestration | superseded by 0045 | 2026-08-06 |
| [0036](./0036-definition-release-promotion.md) | Promote immutable definition releases by digest | superseded by 0045 | 2026-08-06 |
| [0037](./0037-workos-authenticated-workflow-host.md) | WorkOS AuthKit owns workflow-host identity | superseded by 0045 | 2026-08-06 |
| [0038](./0038-workos-emulate-local-authentication.md) | WorkOS Emulate provides local workflow-host identity | superseded by 0045 | 2026-08-06 |
| [0039](./0039-managed-definition-authoring-lifecycle.md) | Draft, checkpoint, then assemble a Definition Release | superseded by 0045 | 2026-08-06 |
| [0040](./0040-promotion-cli-and-workos-machine-identity.md) | Promotion automation uses a CLI and scoped WorkOS machine identity | superseded by 0045 | 2026-08-06 |
| [0041](./0041-managed-release-history-and-provenance.md) | Managed release history is a host-owned derived read model | superseded by 0045 | 2026-08-06 |
| [0042](./0042-first-class-environment-catalog.md) | Environments are versioned host-owned promotion targets | superseded by 0045 | 2026-08-07 |
| [0043](./0043-elsa-host-workflow-engine.md) | Elsa executes host-owned durable workflows | superseded by 0045 | 2026-08-07 |
| [0044](./0044-versioned-human-review-workflow-graph.md) | Version the portable human-review graph | superseded by 0045 | 2026-08-07 |
| [0045](./0045-focus-repository-on-sdks-and-site.md) | Focus the repository on the SDKs and Kajay.io | accepted | 2026-08-08 |
| [0046](./0046-nuget-release-walkthrough.md) | The NuGet release walkthrough | accepted | 2026-08-08 |
| [0047](./0047-host-value-scope.md) | A host-value scope, `{$name}` | accepted, amended | 2026-08-12 |

## Parent and related links

- [Project context](../../CONTEXT.md)
- [North Star](../NORTH_STAR.md)
- [Delivery roadmap](../delivery-roadmap.md)
- [Feature-parity checklist](../feature-parity-checklist.md)
