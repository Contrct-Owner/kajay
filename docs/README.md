# Documentation Catalog

- Area: Documentation navigation
- Status: active
- Owner: Jarod
- Last updated: 2026-08-12

## Start here

- [Project context](../CONTEXT.md) — current state and vocabulary.
- [SDK overview](./sdk-summary.md) — the TypeScript and C# consumer surfaces.
- [Documentation system](./documentation-system-details.md) — information architecture,
  source ownership, and quality gates.
- [Repository organization](../REPOSITORY_ORGANIZATION.md) — directory ownership and
  admission rules.
- [North Star](./NORTH_STAR.md) — product vision and architecture.
- [Delivery roadmap](./delivery-roadmap.md) — historical delivery record and current
  follow-on direction.

## Contracts and acceptance

- [Feature-parity checklist](./feature-parity-checklist.md) — named acceptance evidence.
- [Library development guidelines](./library-development-guidelines-details.md) — build,
  architecture, and test rules.
- [Public package interfaces](./public-package-interfaces.md) — supported TypeScript API.
- [Headless adapter contract](./headless-adapter-contract.md) — language-neutral runtime
  operations.
- [Design tokens](./design-tokens.md) — published theme contract.

The published TypeScript packages also carry package-specific consumer entry points:
[`@kajay/core`](../packages/core/README.md), [`@kajay/react`](../packages/react/README.md),
[`@kajay/creator-core`](../packages/creator-core/README.md),
[`@kajay/creator-react`](../packages/creator-react/README.md), and
[`@kajay/themes`](../packages/themes/README.md). The native package starts from
[`Kajay.Core`](../dotnet/README.md).

Generated contracts live in [`contracts/`](../contracts/) and executable compatibility
cases live in [`conformance/`](../conformance/).

## Decisions and history

- [ADR index](./adr/README.md) — accepted, deferred, and superseded decisions.
- [Architecture remediation plan](./architecture-remediation-plan.md) — the completed
  TypeScript 1.0 remediation record.

ADRs 0032–0044 preserve the exploratory demo and workflow investigation. ADR-0045
supersedes the maintained-application portions of that work; the portable response
snapshot decision in ADR-0034 remains active SDK scope.
