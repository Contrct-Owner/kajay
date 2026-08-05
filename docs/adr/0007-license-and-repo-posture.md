# ADR-0007 — Private repo, unlicensed, decision deferred to Phase 2 exit

> **Completed by [ADR-0028](./0028-mit-runtime-source-available-creator.md) (2026-08-04):**
> MIT for the runtime, `FSL-1.1-ALv2` for the Creator. The deferral below did its
> job — it was waiting for information that §K–§N and §P produced.

- Area: Licensing and distribution posture
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

## Context

The licensing choice is asymmetric in a way that argues for deferring it: publishing
under a permissive license is effectively irreversible — the versions released under
it stay under it forever — while staying closed costs nothing but time and can be
opened at any moment.

The parity target's own model is instructive. As of 2026-08-02: `survey-core` and
`survey-react-ui` are **MIT**; `survey-creator-core` ships under a proprietary license
(`SEE LICENSE IN LICENSE`), sold at roughly $569–$1,029 per developer, as are their
Dashboard and PDF products. The expensive, hard-to-build half is the commercial half —
which is exactly the half this project reaches in Phase 3.

## Decision

- The repository stays **private**.
- **No `LICENSE` file**, and no implied grant: all rights reserved.
- Revisit at **Phase 2 exit** — the point at which the Form Library half is complete
  and it becomes knowable whether the Creator is a product or a portfolio piece.

## Phase 2 exit review (2026-08-04)

The owner explicitly continued the private, unpublished posture through
[ADR-0024](./0024-publication-hold.md). This is an interim publication hold, not a
selection of the eventual licensing model. `UNLICENSED` continues to mean that no
license grant has been made; the long-term package and repository license choices
remain deferred until the release walkthrough.

## Repository made public (2026-08-05)

The repository is public at `github.com/Contrct-Owner/kajay`. The "stays private" decision
above is spent.

Two things forced it together. MIT source that nobody can read is a contradiction — the
licence grants rights over code the grantee cannot obtain. And **npm provenance requires a
public repository**: an attestation is only meaningful if the build it points at can be
verified, so [ADR-0029](./0029-release-walkthrough.md)'s gate-5 choice of provenance and a
private repository could not both hold. That interaction was invisible until the push was
attempted, which is the honest reason it is recorded here rather than in the walkthrough.

The Creator's source is public too. FSL is designed for exactly that — read it, run it,
self-host it, do not resell it — so this is the licence working as chosen rather than a
concession.

## Consequences

- No external contributions, and no public issue tracker, for the duration.
- The pack test installs locally built tarballs into a scratch project rather than
  pulling from a registry — which is what it does anyway, so nothing changes in CI.
- `@kajay/*` cannot be published to npm publicly while this holds. If early external
  validation becomes desirable before Phase 2 exit, that is a trigger to revisit this
  ADR rather than to quietly publish.
- Every option stays open: all-MIT, Apache-2.0, MIT core with a commercial Creator, or
  source-available. Nothing about the code as written forecloses any of them.

## Alternatives considered

- **MIT now, public repo.** Rejected for now: maximal adoption but irreversible, and
  taken before there is anything to adopt.
- **Apache-2.0 now.** Same irreversibility; the patent grant and trademark clause
  matter more once a brand exists, so this remains the leading candidate *if* the
  project goes fully open at Phase 2 exit.
- **MIT core + commercial Creator now.** The model the parity target proves works.
  Deferred rather than rejected — it is the leading candidate if the Creator becomes a
  product, and nothing in Phases 0–2 needs the decision made early.

## Parent and related links

- [North Star §11](../NORTH_STAR.md), [Delivery roadmap](../delivery-roadmap.md)
