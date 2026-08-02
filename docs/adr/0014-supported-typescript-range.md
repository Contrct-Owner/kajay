# ADR-0014 — Supported consumer TypeScript range

- Area: Consumer compatibility
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

The repo pins its own compiler (`~6.0` primary, `7.x` as second checker — ADR-0012),
but that says nothing about what a **consumer** needs. A host application still on
TypeScript 6 must be able to install these packages and compile against the shipped
declarations. Nothing declared or tested that.

Node has an explicit floor (ADR-0010). TypeScript deserves the same treatment: a
declared range, mechanically tested, that cannot drift without failing the build.

## Evidence gathered before deciding

**Declaration emit does not depend on which compiler emits it.** Building the whole
workspace with TypeScript 6 and then with TypeScript 7 produced **byte-identical**
`.d.ts` output across all 29 declaration files. This is largely what
`isolatedDeclarations` buys: declaration emit becomes a mechanical transform of
explicit annotations rather than a product of inference, so there is little room for
compilers to differ.

**The real floor is 5.5, and it is not set by our declarations.** Compiling a packed
consumer against successive compilers:

| Consumer TypeScript | Result |
| --- | --- |
| 4.7, 4.9 | fails — `lib: es2023` does not exist |
| 5.0, 5.2, 5.4 | fails — `target: es2023` not accepted until 5.5 |
| **5.5 – 5.9** | **passes** |
| **6.0** | **passes** |
| **7.0** | **passes** |

Every failure below 5.5 is the *consumer's* tsconfig being unable to name `es2023`,
not anything about our published types. A consumer on 5.0–5.4 targeting `es2022` might
well work; we do not test that and therefore do not claim it.

## Decision

- **Declared floor: TypeScript 5.5.** Published packages compile for any consumer on
  5.5 or later, including the whole 6.x line and 7.x.
- The floor is **tested, not asserted**. `npm run test:pack` installs each matrix
  version *into the scratch consumer project* — not borrowed from this repo's
  `node_modules`, because that is what a real consumer has — and type-checks against
  the packed tarballs with **`skipLibCheck: false`**, so the shipped declarations are
  deep-checked rather than skipped.
- **Per-PR matrix: `5.5`, `~6.0.3`, `^7.0.2`** — floor, the 6.x line, and current.
  Three installs, covering both ends plus the version most consumers are on.
- **Full sweep** (`5.5, 5.6, 5.7, 5.8, 5.9, 6.0, 7.0`) runs weekly in CI via
  `KAJAY_TS_MATRIX`, so an intermediate regression surfaces without paying for seven
  installs on every pull request.
- **`@arethetypeswrong/cli` runs on every packed tarball** with `--profile esm-only`,
  which verifies the `exports` wiring resolves types for node16-ESM and bundler
  consumers. The `esm-only` profile is correct here rather than lenient: node10
  resolution failing, and `require()` needing a dynamic import, are intended
  consequences of the ESM-only decision in ADR-0010. What the check catches is the
  node16-ESM or bundler path regressing, which would break every consumer silently.

## Consequences

- Raising the floor is a **breaking change** for consumers and needs a major version
  under the single version train (ADR-0005), plus an amendment here.
- The floor constrains language features in *public API surface*. Anything requiring a
  newer compiler to express — in a type that reaches the `.d.ts` — is off limits while
  5.5 is the floor.
- **This resolves the open question in [ADR-0012](./0012-typescript-dual-check.md).**
  Flipping the primary compiler to TypeScript 7 is now safe *because the matrix guards
  it*: if TS 7's emit ever produced declarations a 5.5 consumer could not read, the
  pack test fails. The choice of emitting compiler is no longer load-bearing for
  consumer compatibility — the test is.
- `es2023` in the consumer tsconfig is the practical floor driver. If a lower floor is
  ever wanted, the cheapest route is testing an `es2022`-targeted consumer variant
  rather than changing anything we ship.

## Parent and related links

- [ADR-0010](./0010-package-manifest-and-distribution.md) (Node floor, ESM-only,
  exports shape), [ADR-0012](./0012-typescript-dual-check.md)
- [North Star §5](../NORTH_STAR.md)
