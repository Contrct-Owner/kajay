# ADR-0005 — Single version train released with changesets

- Area: Release policy
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

The roadmap left versioning open: independent per-package versions, or one version
across the family. The packages are tightly coupled — `creator-react` requires a
matching `creator-core`, which requires a matching `core` — and the project is
solo-operated.

Evidence from the parity target: `survey-core`, `survey-creator-core`, and
`survey-react-ui` all ship at the same version (2.5.36 as of 2026-08-02). SurveyJS
runs a lockstep train for the same structural reason.

## Decision

- **Single version train.** All published packages share one version and release
  together, including packages with no changes in a given release.
- **changesets** in *fixed* (linked) mode as the tooling — changelog generation and
  publish automation. It is a root devDependency, so the zero-runtime-dependency rule
  for core packages is untouched.
- **`0.x` through Phase 2. Cut `1.0.0` at Phase 3 exit**, which is the project's
  stated overall acceptance criterion — a 1.0 that means the parity checklist is
  green and the host-demo scenario passes.
- React is declared `peerDependencies: { "react": "^19" }` in UI packages, never a
  dependency.

## Consequences

- No version matrix to support or document: any `@kajay/*` at version X works with
  any other at version X, and cross-package `dependencies` pin the exact version.
- Releases include no-op version bumps for untouched packages. Accepted — the
  alternative costs far more in support surface than the noise costs in changelog.
- Pre-1.0 `0.x` semantics mean breaking changes are expected through Phase 2, which
  matches the reality that the format and registry are still being designed
  ([ADR-0001](./0001-own-definition-format.md)).
- The pack test installs matched tarballs, so it validates the train as a unit.

## Alternatives considered

- **Independent per-package versions.** Rejected: creates a compatibility matrix a
  solo maintainer cannot carry, for flexibility this package graph does not want.

## Parent and related links

- [Delivery roadmap](../delivery-roadmap.md), [North Star §5](../NORTH_STAR.md)
