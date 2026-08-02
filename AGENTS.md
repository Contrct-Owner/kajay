# Survey Repository Agent Instructions

## Non-negotiables

Before planning, implementing, or reviewing code or tests, read
`docs/library-development-guidelines-details.md` completely.

- Use TypeScript ~6.0 strict, ESM-only. Published packages must compile under
  `isolatedDeclarations` and `erasableSyntaxOnly` and type-check identically under
  tsc and tsgo (TypeScript 7). No `namespace`, no runtime `enum`, no parameter
  properties, no deprecated compiler options.
- Preserve the package seam: dependency direction is `core ← react`,
  `core ← creator-core ← creator-react`, nothing else. Core packages
  (`@kajay/core`, `@kajay/creator-core`) never import UI packages, never touch the
  DOM, and carry zero runtime dependencies unless an ADR grants one.
- A package's public surface is exactly its `package.json` `exports` map. No deep
  imports anywhere, including tests and `apps/host-demo`.
- **Consumers are supported from TypeScript 5.5 upward** (ADR-0014). Nothing may reach
  the published `.d.ts` that a 5.5 consumer cannot compile; the pack test enforces this
  against real installed compilers. Raising the floor is a breaking change.
- The JSON survey definition is authoritative. Every feature exists first as
  metadata-registry registration + schema; `contracts/survey-schema.json` is
  committed and CI fails on drift — commit the regenerated contract in the same PR.
- Keep unit and browser/E2E tests in separate projects. Unit tests are pure logic:
  no DOM, no jsdom (banned repo-wide), no browser, no network, no mocks of our own
  packages. DOM behavior is proven in real Chromium (Vitest browser mode) or
  Playwright E2E, through public APIs only.
- Every functional change adds or updates tests that prove its observable behavior.
  A parity-checklist row (`docs/feature-parity-checklist.md`) flips green only via a
  passing named proof (`parity/<row-id>-<slug>`), never by assertion.
- Design all tests to be order-independent and safe for concurrent execution.
  Tests that touch the process-global metadata registry use unique names and clean
  up, or run isolated.
- Warnings are errors. Do not mark work complete until lint, typecheck (tsc + tsgo),
  architecture checks, unit, browser integration, E2E, contract, and pack-test
  checks pass. If a check is not implemented yet, say so explicitly instead of
  implying it passed.
- If a request conflicts with these rules, surface the conflict instead of silently
  weakening the rule.

## Commands

Run from the repo root. These are the same commands CI runs; keep the two in step.
All of them are real as of Phase 0. `pnpm run verify` runs the whole chain in order.

The workspace uses **pnpm** ([ADR-0015](docs/adr/0015-pnpm-workspace.md)), pinned by
`packageManager` and supplied by corepack — run `corepack enable pnpm` once. Consumers
are unaffected: packages publish for npm, and the pack test installs them with it.

```bash
pnpm run lint         # oxlint, warnings as errors
pnpm run typecheck    # tsc -b && tsc7 -b  (see ADR-0012; tsgo is superseded)
pnpm run check:arch   # dependency direction, DOM-free core, no deep imports
pnpm run test:unit    # Vitest, node environment, pure logic
pnpm run test:browser # Vitest browser mode, real Chromium
pnpm run test:e2e     # Playwright against apps/host-demo
pnpm run check:contract # regenerate contracts/survey-schema.json, fail on drift
pnpm run test:pack    # pnpm pack all packages, install tarballs in scratch project,
                      # compile (tsc + tsgo) and run smoke scenario
```

- The `survey-checks` CI job is the single status to require in branch protection;
  adding a job or shard never means editing the protected-checks list.

## File responsibility

- Keep files minimal and cohesive: each file defines one primary object whose name
  and purpose match the file.
- Put supporting objects — property descriptors, validators, event payloads,
  helpers — in their own appropriately named files.
- Colocate a secondary type only when it is a small implementation detail genuinely
  inseparable from the primary object.
- No grab-bag files. Optimize for discoverability: an object should be findable by
  its name, and a file understandable without unpacking a hidden subsystem.

## Docs corpus

`docs/NORTH_STAR.md` (vision/architecture), `docs/delivery-roadmap.md` (phases and
gates), `docs/library-development-guidelines-details.md` (dev/testing policy),
`docs/feature-parity-checklist.md` (acceptance ledger), `docs/adr/` (decisions).
Non-trivial decisions get an ADR; record reversals in the North Star decision log.
Doc headers carry Area / Status / Owner / Last updated.

Nested `AGENTS.md` files may add stricter or more specific instructions, but must
not relax these repository-wide requirements.
