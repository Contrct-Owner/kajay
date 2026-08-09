# Survey Repository Agent Instructions

## Non-negotiables

Before planning, implementing, or reviewing code or tests, read
`docs/library-development-guidelines-details.md` completely.

- Use TypeScript ~6.0 strict, ESM-only. Published packages must compile under
  `isolatedDeclarations` and `erasableSyntaxOnly` and type-check identically under
  tsc and tsgo (TypeScript 7). No `namespace`, no runtime `enum`, no parameter
  properties, no deprecated compiler options.
- The native SDK is one `Kajay.Core` NuGet package targeting `net10.0`. Keep nullable
  reference types, warnings-as-errors, package validation, trimming, Native AOT, Source
  Link, and the installed-package smoke green. It has no third-party runtime dependency
  unless an ADR grants one. See ADR-0030 and checklist §Q.
- Preserve the package seam: dependency direction is `core ← react`,
  `core ← creator-core ← creator-react`, nothing else. Core packages
  (`@kajay/core`, `@kajay/creator-core`) never import UI packages, never touch the
  DOM, and carry zero runtime dependencies unless an ADR grants one.
- A package's public surface is exactly its `package.json` `exports` map. Cross-package
  imports always use that published surface; package subpath imports are forbidden,
  including in tests and `apps/site`. A package's unit tests may use relative
  imports into its own `src` tree to prove internal modules. Browser/E2E tests and the
  host demo use public package imports only.
- **Consumers are supported from TypeScript 5.5 upward** (ADR-0014). Nothing may reach
  the published `.d.ts` that a 5.5 consumer cannot compile; the pack test enforces this
  against real installed compilers. Raising the floor is a breaking change.
- The JSON survey definition is authoritative. Every feature exists first as
  metadata-registry registration + schema. The generated files in `contracts/` are
  committed and CI fails on drift — commit regenerated contracts in the same PR.
- Cross-language behavior is versioned under `conformance/v*/`. Changes to definition
  canonicalization, expression semantics, diagnostics, or lifecycle ordering must add
  or update adapter-neutral cases and keep `check:conformance` green.
- Conformance v2 is specified but adapters are pending. Do not describe the TypeScript
  or C# runtime as v2-compatible until its public-seam adapter passes inherited v1 plus
  every v2 case.
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
pnpm run test:e2e     # Playwright against the built apps/site artifact
pnpm run check:changeset # a branch declares what it does to the published packages
pnpm run check:contract # regenerate the committed contracts, fail on drift
pnpm run check:conformance # run the TypeScript runtime against the shared corpus
pnpm run verify:dotnet # restore, format-check, build, test, pack, installed consumer
pnpm run test:pack    # pnpm pack all packages, install tarballs in scratch project,
                      # compile (tsc + tsgo) and run smoke scenario
```

- The `survey-checks` CI job is the single status to require in branch protection;
  adding a job or shard never means editing the protected-checks list.
- `check:changeset` is the one check that is **not** part of `verify`: it compares a
  branch against its base, which only a pull request has. It passes on any branch that
  touched no published package — documentation, CI and `apps/site` need no changeset —
  and `pnpm changeset -- --empty` records the judgement that a change needs no release.

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
