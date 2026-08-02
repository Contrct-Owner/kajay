# ADR-0007 — Private repo, unlicensed, decision deferred to Phase 2 exit

- Area: Licensing and distribution posture
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

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
