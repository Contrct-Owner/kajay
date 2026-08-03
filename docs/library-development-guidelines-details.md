# Library Development and Testing Guidelines

- Area: Package architecture, TypeScript configuration, and automated testing
- Status: proposed
- Owner: Jarod
- Last updated: 2026-08-02

These guidelines define the default shape of code and tests in this repository. A
change is acceptable only when it preserves package ownership and dependency
direction, keeps the published surface explicit, proves functional behavior primarily
through public-API tests, and keeps the test suite safe to run concurrently.

They adapt the Kajay backend guidelines to a TypeScript library monorepo: the
*module seam* becomes the *package seam*, the *committed OpenAPI contract* becomes the
*committed JSON Schema contract*, and *integration tests against real PostgreSQL*
become *rendering tests against a real browser DOM and E2E scenarios against the real
packaged artifacts*.

## Repository baseline

- **TypeScript ~6.0, strict, ESM-only.** Published packages additionally compile
  under `isolatedDeclarations` and `erasableSyntaxOnly` — no `namespace`, no runtime
  `enum`, no parameter properties — so the code is tsgo (TypeScript 7)-clean by
  construction. CI type-checks with both `tsc -b` and `tsgo`.
- **pnpm workspaces + project references.** Each package owns exactly one publishable
  API, declared in its `package.json` `exports` map. There is no other public
  surface: anything not exported is private, and deep imports
  (`@kajay/core/dist/...`) are architecture-check failures.
- **Dependency direction is law:** `core ← react`, `core ← creator-core ←
  creator-react`, and nothing else. Core packages (`core`, `creator-core`) must not
  import from UI packages, must not reference the DOM (`lib` excludes `DOM`; no
  `document`/`window`), and must have **zero runtime dependencies** unless an ADR
  grants one.
- **React is a peer dependency** of UI packages, never a dependency.
- **Warnings are errors** — tsc, oxlint, and CI all treat them so.
- **File and function size limits are 300 and 50 lines, and are not counted against
  comments** (`max-lines` and `max-lines-per-function` both run with `skipComments`).
  The limits exist to bound
  how much *code* one unit holds. This repo deliberately carries dense explanatory
  comments, and a limit that taxed prose would push people to delete the explanation
  rather than split the module — the opposite of what it is for. Going over is a
  design signal: split the unit, do not add an exemption.
- Code outside a package does not reach into that package's internals. Packages
  collaborate through their exported contracts only; the host app is the composition
  root and the standing proof of it.

## The contract

`contracts/survey-schema.json` is generated from the metadata registry and
**committed**. CI regenerates it and fails on drift, so every change to the survey
definition format appears as a reviewable diff in the same PR that causes it. Treat a
contract diff you did not expect as a design signal, not noise to regenerate away.

## Test project boundaries

Three categories with intentionally different jobs. Tests are categorized by what
they execute, not by how fast they run.

| Test type | Purpose | Allowed dependencies |
| --- | --- | --- |
| Unit | Prove deterministic model/engine logic in isolation | In-process objects and explicit values only; Node environment; no DOM |
| Rendering integration | Prove renderer + model behavior through a real browser | Vitest browser mode on real Chromium; the packages' public APIs |
| Host E2E / parity scenarios | Prove the embeddable product end-to-end, as a consumer | Playwright against the running host-demo app; public APIs only |

## Unit-test policy

Unit tests are purely logic tests, and in this codebase they carry more of the load
than they did in Kajay's backend — the expression engine, serializer, dependency
graph, validation, and navigation logic are all deterministic pure logic, which is
exactly what the headless-core architecture exists to make exhaustively testable.

- No DOM, no jsdom, no browser, no network, no filesystem, no timers left real
  (fake timers are fine — they make time an explicit input, not a dependency).
- **No mocks of our own packages.** If a test wants to mock `@kajay/core`, the test
  is at the wrong boundary — test through the real model.
- A unit test may use a relative import into its own package's `src` tree when it proves
  an internal module. That creates an internal test seam, not consumer surface. Imports
  into another package, rendering tests, and host E2E scenarios use published package
  entries only.
- jsdom is banned repo-wide, not just in unit tests: DOM behavior is proven in a real
  browser or not at all.
- Prefer table-driven cases for the expression language and validators; every
  operator, function, and precedence rule gets explicit cases including error paths.
- Serializer tests round-trip every fixture: `parse → serialize → parse` must be
  stable and lossless.

## Rendering-integration and E2E policy

These are the proof that functional requirements are met through the same boundary a
real consumer uses.

- Exercise the **public package API** — mount `<Survey model={...} />` as a host
  would — never internal component imports or implementation details.
- Run in **real Chromium** via Vitest browser mode; keyboard interaction, focus
  management, and ARIA assertions (axe) live here.
- Host E2E scenarios in `apps/host-demo` are the parity ledger's currency: a parity
  checklist item is green **only** when a named scenario proves it. Scenario names
  reference checklist IDs (e.g. `parity/B3-visible-if`).
- The **pack test** is part of this category: CI runs `pnpm pack` on every package,
  installs the tarballs into a scratch project outside the workspace, compiles it
  under tsc and tsgo, and runs a smoke scenario. This catches broken `exports` maps,
  missing files, accidental workspace-symlink reliance, and type-emit errors that
  workspace builds hide.
- Refactoring internals must not break a passing scenario unless public behavior or
  a contract changed.

## Parallel-first test design

The suite must be safe to parallelize from its first test.

- Tests must not depend on execution order or on mutable state created by another
  test. The metadata registry is process-global by design, so tests that register
  custom types/properties/functions must use unique names and unregister in
  teardown — or run in an isolated worker.
- No fixed ports, fixed temp paths, or shared fixture files mutated in place; every
  scenario builds its own survey definition.
- Browser and E2E suites shard deterministically (by file, sorted) so CI can add
  shards without changing test behavior, and results aggregate as one logical suite.

## File responsibility

- Keep files minimal and cohesive: each file defines one primary object whose name
  and purpose match the file.
- Supporting objects — property descriptors, validators, event payloads, helpers —
  live in their own appropriately named files.
- Colocate a secondary type only when it is a small implementation detail genuinely
  inseparable from the primary object.
- No grab-bag files. Optimize for discoverability: an agent or developer should
  locate an object by name and understand a file without unpacking a hidden
  subsystem inside it.

## Automated enforcement

Phase 0 implements these as build-failing checks; until then they are active policy
via `AGENTS.md`.

- **Architecture checks:** dependency direction between packages; no DOM lib or
  DOM globals in core packages; no cross-package deep imports; host-demo imports only
  public entry points; zero runtime dependencies in core packages absent an ADR;
  React only as peerDependency in UI packages.
- **Test-boundary checks:** unit-test projects declare no browser/jsdom/mocking
  packages; no test config globally disables parallelization.
- **Contract drift check** as described above.
- **CI gates:** lint/typecheck (tsc + tsgo), architecture, unit, rendering
  integration, host E2E, contract, pack test — separate jobs behind the single
  required `survey-checks` gate.

Checks must report the violated rule and the file or package responsible, so the
response is to correct the design, not suppress the failure.

## Acceptance criteria

- Packages compile under TS ~6.0 strict and tsgo with identical results.
- Every package's public surface is exactly its `exports` map; the dependency graph
  matches North Star §4 and is mechanically enforced.
- Unit tests are pure logic with no environment substitutes; DOM behavior is proven
  only in real browsers.
- Every parity-checklist item that is marked green maps to a passing public-API
  scenario; the pack test passes on every PR.
- The suite runs order-independently and in parallel, locally and sharded in CI.

## Parent and related links

- [North Star](./NORTH_STAR.md)
- [Delivery roadmap](./delivery-roadmap.md)
- [Feature-parity checklist](./feature-parity-checklist.md)
