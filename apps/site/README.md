# Kajay.io

- Area: Public marketing, documentation, and playground application
- Status: active
- Owner: Jarod
- Last updated: 2026-08-12

Kajay.io is the repository's only product application. It consumes the TypeScript
packages through public exports and presents shared documentation for both maintained
SDK runtimes.

## Feature map

- `src/features/landing/` — product introduction and executable demonstrations.
- `src/features/playground/` — shareable Creator and live-renderer workspace.
- `src/features/docs-catalog/` — documentation page composition.
- `src/features/runtime-docs/` — TypeScript runtime guides.
- `src/features/dotnet-docs/` — C# runtime guides.
- `src/features/creator-docs/` — TypeScript Creator guides.
- `src/features/docs-reference/` — generated facts and search.
- `src/features/reference-docs/` — reference-page presentation.
- `src/features/docs-mcp/` — read-only MCP projection.

Route modules under `src/routes/` stay thin and compose those feature entries.

## Commands

Run from the repository root:

```bash
pnpm --filter @kajay/site run dev
pnpm run check:docs
pnpm run test:e2e
```

## Documentation ownership

The public information architecture, generated-source flow, and quality expectations
are defined in [the documentation-system guide](../../docs/documentation-system-details.md).
Repository-maintainer navigation lives in [the documentation catalog](../../docs/README.md).

## Related areas

- [Repository organization](../../REPOSITORY_ORGANIZATION.md)
- [SDK summary](../../docs/sdk-summary.md)
- [North Star](../../docs/NORTH_STAR.md)
