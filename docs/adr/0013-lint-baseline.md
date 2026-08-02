# ADR-0013 — oxlint baseline, and why `prefer-event-target` is disabled

- Area: Toolchain
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

`AGENTS.md` requires oxlint with warnings as errors but does not say which rule
categories are on. Phase 0 had to pick a baseline, and one rule in it turned out to
conflict with a load-bearing architectural rule.

## Decision

Enable `correctness`, `suspicious`, `pedantic`, and `perf` as errors. Two deliberate
exceptions:

### `unicorn/prefer-event-target` is off, permanently

The rule wants `EventTarget` instead of a hand-rolled emitter, on the grounds that
`EventEmitter` is Node-only. Applied here it would be actively wrong: **`EventTarget`
is a DOM global**, and `@kajay/core` compiles with `lib: ["es2023"]` and no DOM. Taking
the rule's advice would either fail to compile or force the DOM lib into a package the
architecture check forbids it in.

Disabling it is not a suppression of a real finding. `EventEmitter` in this repo is a
20-line zero-dependency class in core, not the Node built-in.

The rule pointing at a DOM global also exposed a gap in `scripts/check-arch.mjs`, whose
DOM-globals list did not include `EventTarget`. It does now — so the architecture check
would fail the build if anyone did follow the rule's advice.

### `eslint/max-lines-per-function` is off for tests

A `describe` block is a function only incidentally; the rule measures nothing useful
there. It stays **on** for `src/`, where it did real work in Phase 0 — it caught four
functions that were doing too much, and each was split rather than exempted.

## Consequences

- A future rule that conflicts with an architectural invariant gets the same treatment:
  disabled with the reason recorded here, and the invariant moved into the
  architecture check where a linter cannot argue with it.
- Rule categories are a build-affecting decision; changing them belongs in this ADR.

## Parent and related links

- [Library development guidelines](../library-development-guidelines-details.md)
- [ADR-0012](./0012-typescript-dual-check.md)
