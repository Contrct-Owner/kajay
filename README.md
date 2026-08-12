# Kajay

Kajay is an embeddable survey runtime and Creator built around an authoritative JSON
definition. TypeScript 1.x is published as five `@kajay/*` packages, and `Kajay.Core` 1.x
is published on NuGet as the native .NET 10+ headless runtime.

The repository intentionally contains one product application: `apps/site`, which is the
Kajay marketing site, documentation, and playground. Persistence, authentication,
workflow orchestration, and deployment policy belong to consuming applications and are
not part of either SDK.

## Repository map

| Path | Responsibility |
| --- | --- |
| [`packages/`](./packages/core/README.md) | Published TypeScript runtime, React adapters, Creator, and themes |
| [`dotnet/`](./dotnet/README.md) | Published C# headless runtime, sample, tests, and benchmarks |
| [`apps/site/`](./apps/site/README.md) | Kajay.io marketing, documentation, and playground |
| `contracts/` | Generated, committed definition and diagnostic contracts |
| `conformance/` | Versioned, language-neutral behavioral corpus |
| `dotnet/tests/`, `packages/*/test/` | SDK and adapter evidence |
| `docs/` | Architecture, policy, acceptance ledger, and decisions |

See [REPOSITORY_ORGANIZATION.md](./REPOSITORY_ORGANIZATION.md) for ownership rules and
[CONTEXT.md](./CONTEXT.md) for current project state.

## Development

Requirements are Node 22.12 or later, pnpm 11, and the .NET SDK pinned by `global.json`.

```bash
pnpm install
pnpm run verify
```

Run the public site locally with:

```bash
pnpm --filter @kajay/site run dev
```

The complete build and test policy is in
[docs/library-development-guidelines-details.md](./docs/library-development-guidelines-details.md).

## Documentation

- [SDK overview](./docs/sdk-summary.md)
- [Documentation system](./docs/documentation-system-details.md)
- [North Star](./docs/NORTH_STAR.md)
- [Delivery roadmap](./docs/delivery-roadmap.md)
- [Feature-parity checklist](./docs/feature-parity-checklist.md)
- [Architecture decisions](./docs/adr/README.md)
- [Documentation catalog](./docs/README.md)
