# ADR-0012 — TypeScript 6 primary, TypeScript 7 as the second checker

- Area: Toolchain
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

[North Star §5](../NORTH_STAR.md) and `AGENTS.md` both specify TypeScript ~6.0 with CI
type-checking under "both `tsc` and `tsgo`", so the repo "rides the 6 → 7 transition
without a migration event". `tsgo` is the binary shipped by
`@typescript/native-preview`, the preview distribution of the native TypeScript port.

That plan was written while TypeScript 7 was unreleased. Registry state on 2026-08-02:

| Package | Version | Note |
| --- | --- | --- |
| `typescript` | **7.0.2** (`latest`, released 2026-07-08) | native port, stable |
| `typescript` | **6.0.3** (`6.0` line) | JS-based implementation |
| `@typescript/native-preview` | 7.0.0-dev.20260707.2 | preview build, **older than stable 7.0.2** |

The preview package is now strictly worse than the thing it previewed: checking
against `tsgo` would check against a dev build of a compiler that has since shipped.

## Decision

Keep the corpus's structure — two compilers, both must pass — and replace the obsolete
half:

- **Primary: `typescript@~6.0.3`.** Provides `tsc`, used for emit. This preserves the
  `~6.0` pin that `AGENTS.md` states as a non-negotiable.
- **Second checker: `typescript@^7.0.2`**, installed under the npm alias
  `typescript7`, invoked as `node_modules/typescript7/bin/tsc -b --force`.
- **`@typescript/native-preview` is not used.**

### Why the checks run TS 7 first

Neither compiler accepts `--build --noEmit` against composite project references
(`TS6310: Referenced project may not disable emit`), so the second checker cannot be
made emit-free. `npm run typecheck` therefore runs **TS 7 first, TS 6 second**, and
both with `--force`. The order is load-bearing: whichever compiler runs last leaves its
output in `dist`, and ADR-0012 makes TS 6 the compiler that emits.

Reordering these two script lines would silently make TS 7 the emitting compiler.

`npm run typecheck` runs both. The intent of the original rule is unchanged: every
line compiles identically under the JS-based and native compilers, so the repo is
7-clean by construction. Only the mechanism changed, because the preview package it
named has been superseded.

The compiler-settings discipline that made this possible stands unchanged and is not
weakened by TS 7 shipping: `verbatimModuleSyntax`, `erasableSyntaxOnly`,
`isolatedDeclarations` on published packages, and no `namespace` / runtime `enum` /
parameter properties.

## Consequences

- `AGENTS.md`'s command list still reads `tsc -b && tsgo -b`. That line is now
  inaccurate and should read `tsc -b && tsc7 -b`. The behavior it describes —
  dual-compiler checking — is intact.
- Two copies of the compiler are installed. Accepted: it is a devDependency cost only,
  and it is the entire point of the dual check.
- Rolling the TS 7 alias forward is a routine dependency bump; rolling the **primary**
  off the `~6.0` pin is an `AGENTS.md` change and needs its own decision.

## Open question for the owner — resolved by ADR-0014

TypeScript 7 being stable makes the inverse arrangement defensible — **7 primary, 6 as
the compatibility checker**. Arguments for flipping: 7 is `latest`, materially faster
on a project-references monorepo, and the 6 line has seen only three releases. The
argument against was that `AGENTS.md` states `~6.0` as a non-negotiable.

The blocking worry — that the emitting compiler determines what consumers can read —
was measured and does not hold: TypeScript 6 and 7 produce **byte-identical**
declarations across all 29 files, which is what `isolatedDeclarations` is for.
[ADR-0014](./0014-supported-typescript-range.md) then made consumer compatibility a
*tested* contract rather than a property of the toolchain.

So flipping is now a preference, not a risk: the pack test would fail if TS 7's emit
ever became unreadable to a TypeScript 5.5 consumer. Still not flipped unilaterally,
because `~6.0` remains a stated non-negotiable in `AGENTS.md` — but the decision is now
one line in `package.json`, with a guard behind it.

## Parent and related links

- [North Star §5](../NORTH_STAR.md), `AGENTS.md`
