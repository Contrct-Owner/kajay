# ADR-0006 — npm scope `@kajay/*`

- Area: Packaging and naming
- Status: proposed
- Owner: Jarod
- Last updated: 2026-08-04

> **Condition met (2026-08-05).** The owner has claimed the `kajay` organization, so the
> conditional acceptance below is now unconditional. [ADR-0029](./0029-release-walkthrough.md)
> also settles the second question this ADR raised: Kajay is the product rather than an
> umbrella, so the packages keep the names they have.

## Context

`@survey/*` entered the corpus as an explicit placeholder. The scope is load-bearing
for Phase 0: it appears in every `package.json`, every `exports` map, every import
statement across packages and `apps/host-demo`, every fixture, and in the pack test's
scratch project. Renaming later is a mechanical find-and-replace, but a noisy one that
invalidates any external consumer that has already installed.

Registry findings on 2026-08-02:

- `@survey/core` returned 404 (nothing published), but the owner checked npm directly
  and found the **`survey` organization is already taken**. This is exactly the case
  the registry probe could not detect — npm rejects unauthenticated organization
  lookups (403), so "nothing published under a scope" never established that the scope
  was claimable.
- `kajay` is clean: no packages under `@kajay/*`, no unscoped `kajay` package, and a
  registry search for "kajay" returns zero results.

`Kajay` is also already the name of the corpus these guidelines were adapted from, so
the scope carries existing meaning rather than introducing a second brand.

## Decision

Adopt **`@kajay/*`**, conditional on successfully claiming the `kajay` organization on
npm. Scaffold Phase 0 against it.

Package names: `@kajay/core`, `@kajay/react`, `@kajay/creator-core`,
`@kajay/creator-react`, `@kajay/themes`.

## Open action

[ADR-0024](./0024-publication-hold.md) places publication on hold. Do not claim an npm
organization during the hold: `@kajay/*` is the working source-code scope, not a final
brand decision or a claim of ownership. The explicit release walkthrough decides
whether to retain this scope before the action below becomes eligible.

Claim the org at **https://www.npmjs.com/org/create** (Free tier). This is web-only —
there is no CLI path. `npm org` manages members of an org that already exists; it
cannot create one. The creation form is also the authoritative availability check,
which no unauthenticated registry probe can substitute for.

Free covers unlimited public packages. Private packages need the paid tier, but
[ADR-0007](./0007-license-and-repo-posture.md) means nothing publishes yet, so this
claim is purely name reservation.

Until it succeeds this ADR stays `proposed`; promote it to `accepted` and record the
date once `npm org ls kajay` resolves.

Zero search hits makes a conflict unlikely, but the `survey` result is the standing
proof that an empty scope can still be owned — verify and claim the selected scope
before publication rather than after.

**Fallback if `kajay` is taken:** an npm username is automatically a scope its owner
controls, so `@<username>/*` is available without any claim. It is a weaker brand but
a zero-risk one, and it would not change any decision in ADR-0010 or elsewhere.

## Consequences

- Phase 0 can scaffold without a naming blocker.
- The scope ties this project to the Kajay name. If Kajay is a distinct product,
  `@kajay/*` housing a survey engine is a deliberate umbrella-brand choice, not an
  accident — worth confirming it is the intent before publishing anything.
- Unlike `@survey/*`, the name says nothing about what the packages do, which costs
  discoverability and gains distinctiveness. Package names carry the meaning instead
  (`@kajay/core` is opaque; the README is doing the work).
- If the claim fails, decide the replacement **before** scaffolding — the cost of a
  placeholder is only low while no code exists.

## History

| Date | Change |
| --- | --- |
| 2026-08-02 | Drafted with `@survey/*` pending an org claim. |
| 2026-08-02 | Superseded within the day: `survey` org confirmed taken on npm; scope changed to `@kajay/*` and the corpus renamed. |

## Parent and related links

- [North Star §3, §11](../NORTH_STAR.md)
