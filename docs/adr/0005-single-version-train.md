# ADR-0005 — Single version train released with changesets

- Area: Release policy
- Status: deferred
- Owner: Jarod
- Last updated: 2026-08-04

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

## Publication-hold amendment (2026-08-04)

The owner returned this release policy to **deferred** status pending the explicit
walkthrough required by [ADR-0024](./0024-publication-hold.md). The single version
train, `1.0.0` starting point, and Changesets fixed mode remain the prior proposal;
none is authorized for implementation or publication until it is explicitly
reconfirmed.

Changesets remains an inert root development dependency. There is intentionally no
configuration, release script, or publishing workflow while the hold is active.

## Scaffolding amendment (2026-08-04)

The owner asked for the configuration to be created ahead of the walkthrough, so the
paragraph above is now partly out of date and this records exactly how far it moved.

**Configuration and versioning exist. Publication does not.** `.changeset/config.json`
sets up the fixed group of five packages; `changeset` and `changeset:version` are root
scripts. There is deliberately **no `release` script, no `changeset publish`, and no CI
workflow** that runs either, and every package is still `private: true` — three
independent brakes, so lifting the hold stays a decision somebody takes rather than
something a script does.

`privatePackages: { version: true, tag: false }` is what lets the train be rehearsed at
all: changesets otherwise skips private packages entirely, so neither the bump nor the
changelog could be seen before the hold lifts. Tagging stays off, because a tag is a
release artefact rather than a rehearsal.

The `1.0.0` cut still needs an explicit **major** changeset — the packages are at
`0.0.0`, so anything less produces `0.1.0`. ADR-0024's walkthrough remains required
before anything is published.

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
