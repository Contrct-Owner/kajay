# ADR-0015 — pnpm for the workspace; npm stays the consumer's business

- Area: Toolchain
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

[North Star §5](../NORTH_STAR.md) chose npm workspaces, and
[ADR-0010](./0010-package-manifest-and-distribution.md) explicitly rejected corepack,
both on the "boring, durable, solo-operable" principle. The question was reopened
directly: is pnpm simply a better npm?

Investigating produced a concrete finding rather than a preference. `@kajay/core`
could `import 'react'` without declaring it: npm hoists into a flat `node_modules`, so
it compiled, passed every architecture rule, and **would have passed the pack test**,
because the scratch consumer has React installed. A phantom dependency had silently
broken core's zero-runtime-dependency invariant with nothing to catch it.

That gap was closed in `check:arch` before this decision was taken, so the swap is
*not* justified by it. Two things justify it.

## Decision

**pnpm runs the workspace.** npm remains what consumers use, and is what the pack test
installs with.

- `packageManager: "pnpm@11.18.0"` pins the version in-repo. Corepack (bundled with
  Node 24) provides the binary; `pnpm/action-setup` reads the same field in CI.
- `pnpm-workspace.yaml` replaces the `workspaces` field, which pnpm does not read.
- Cross-package dependencies use `workspace:*`. pnpm 10+ does not link bare version
  ranges to local packages, and pnpm rewrites the protocol to a real version at pack
  time — verified: `@kajay/creator-react`'s tarball ships `"@kajay/core": "0.0.0"`.
- A **catalog** pins `react`/`react-dom` once for the whole workspace.

### Why, concretely

1. **Catalogs.** One place to pin a version across every package is the feature npm
   has no equivalent for, and it is exactly what the single version train
   ([ADR-0005](./0005-single-version-train.md)) wants. This is the load-bearing reason.
2. **Strict `node_modules`** makes phantom dependencies unresolvable rather than merely
   detected — defence in depth behind the `check:arch` rule.

### Library peer ranges stay literal

`@kajay/react` keeps `"react": "^19"` rather than `catalog:`. A peer range is a
consumer-facing statement about *breadth*; the catalog states which version this
workspace develops against. Collapsing the two would silently narrow what consumers
may install.

## Consequences

- **This supersedes ADR-0010's rejection of corepack.** That rejection was reasoned
  from needing only the npm that ships with Node; once pnpm is required, some
  mechanism must supply it, and corepack is the one that pins the version in-repo.
  ADR-0010's *published manifest* decisions — Node floor, ESM-only, single-entry
  exports, host-imported CSS — are untouched.
- **The pack test now packs with pnpm and installs with npm.** That split is
  deliberate: only the workspace's own package manager rewrites `workspace:*` and
  `catalog:`, while consumers overwhelmingly use npm. If rewriting ever broke, the npm
  install would reject the unrewritten specifier — the two-tool split is the check.
- The root manifest declares `engines.pnpm`; **published packages still declare
  `engines.npm`**, because that constrains consumers, who are unaffected by our choice.
- Contributors need corepack enabled. `pnpm install --frozen-lockfile` replaces
  `npm ci`, `--filter` replaces `--workspace`, and `pnpm-lock.yaml` replaces
  `package-lock.json`.
- **Strictness does not make `check:arch`'s dependency rule redundant.** Root
  `devDependencies` remain reachable from any workspace package by ordinary directory
  walking, so pnpm alone would not have caught the original phantom import from a test
  file. The rule stays, and stays package-manager-independent.

## Alternatives considered

- **Stay on npm.** The recommendation before this decision, on the grounds that the
  phantom-dependency benefit was already covered and npm added no toolchain version to
  manage. Overridden deliberately, with catalogs as the deciding feature.
- **pnpm without corepack** (global install). Rejected: unpinned, and reproducibility
  is most of the argument for pinning a package manager at all.

## Parent and related links

- [North Star §5](../NORTH_STAR.md), [ADR-0005](./0005-single-version-train.md),
  [ADR-0010](./0010-package-manifest-and-distribution.md)
