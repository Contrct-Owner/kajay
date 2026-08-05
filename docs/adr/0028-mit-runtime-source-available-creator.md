# ADR-0028 — MIT runtime, source-available Creator

- Area: Licensing and distribution posture
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

Completes [ADR-0007](./0007-license-and-repo-posture.md), which deferred this decision
until it was "knowable whether the Creator is a product or a portfolio piece".

## Context

The deferral did its job: §K–§N shipped, §P built a reference application on top, and the
answer is now visible rather than guessed.

**The differentiator turned out not to be the Creator.** It is
[ADR-0022](./0022-design-system-primitives.md) — surveys drawn with the host's own
components. That is what the landing page leads with, it is what the parity target does not
do, and it is a *runtime* property: `<Survey components={{ Button, Input, Select }} />`
delivers the entire thesis with no Creator involved.

That gives a cleaner split than the parity target has. Their Creator is commercial because
it is the expensive half. Kajay's can be commercial because it is a **different product** —
"let your customers build surveys" is a separate proposition from "surveys that look
native", and each stands alone.

Three things independently argue for opening the runtime:

- [ADR-0020](./0020-versioned-cross-language-runtime-contract.md)'s conformance corpus
  exists so *other* runtimes can implement the contract. That investment only returns with
  adopters.
- §P's shadcn registry distributes by copying source into an adopter's repository, which a
  restrictive licence on the copied code makes unusable.
- A marketing site was built. Nobody builds one for a portfolio piece.

## Decision

- **`@kajay/core`, `@kajay/react`, `@kajay/themes` — MIT.** Shortest and most familiar, and
  what the parity target's runtime uses. The adoption path is `npm install` and a component
  map; many legal teams have blanket MIT approval where Apache-2.0 needs per-case review,
  and for a library whose whole pitch is low friction that difference is the pitch.
- **`@kajay/creator-core`, `@kajay/creator-react` — Functional Source License,
  `FSL-1.1-Apache-2.0`.** Read it, run it, self-host it; do not resell it as a competing
  product. It converts to Apache-2.0 after two years, so the commercial reservation has an
  expiry rather than being permanent.

**The licence is not a publication decision.** [ADR-0024](./0024-publication-hold.md) still
holds and every package stays `private: true`; picking a licence says what the terms will be
when something ships, not that anything ships. The npm scope
([ADR-0006](./0006-npm-scope.md)) is still unclaimed.

### Outstanding: the Creator's licence text is not in the repository

The two Creator packages **remain `UNLICENSED`** until the canonical FSL text is added.
That is deliberate and it is the honest state: `UNLICENSED` means no grant has been made,
which is true, and it stays true until the real text is present. A `LICENSE` file containing
an approximation of a licence would be worse than none — it would look like a grant while
being unenforceable and wrong in ways only a lawyer would find.

The text must be copied verbatim from the canonical source at `fsl.software` rather than
reproduced from memory or paraphrased.

## Consequences

- The runtime tarballs carry `LICENSE`, added to each `files` array. A package whose licence
  is not in the tarball has, from the installer's point of view, no licence at all.
- **Irreversible for the runtime.** Every version released under MIT stays under it. That is
  the asymmetry ADR-0007 identified, accepted here deliberately rather than by default.
- The Creator's commercial option stays alive without needing a store, licence keys,
  entitlement checks or a support desk on day one — none of which exist. FSL keeps the
  option; it does not oblige the business.
- A source-available licence is one most people have to stop and read, which is real
  friction. It is accepted for the Creator and explicitly refused for the runtime, because
  the runtime is the thing that has to be frictionless to be adopted at all.
- Contributions to the Creator need a CLA or equivalent before they can be accepted, since
  its licence reserves rights the contributor would otherwise share. Not needed while the
  repository is private.

## Alternatives considered

- **All MIT, including the Creator.** One licence, no asterisks, maximal adoption —
  irreversibly forfeiting the one model this category is known to make money with, at a
  moment when nothing forces the choice.
- **Apache-2.0 for the runtime.** ADR-0007's leading candidate, and a real one: the patent
  grant protects adopters and the trademark clause matters once "Kajay" is worth defending.
  Rejected on friction, and revisitable *only* before the first release.
- **Keep everything closed.** Costs nothing but time, and blocks the registry, the
  conformance seam's entire purpose, and any public kajay.io.
- **Commercial licence for the Creator now.** Not a file — a store, keys, entitlements and
  support. FSL reserves the same rights and defers the business.

## Parent and related links

- [ADR-0007](./0007-license-and-repo-posture.md) — the deferral this completes
- [ADR-0024](./0024-publication-hold.md) — publication is still held, separately
- [ADR-0006](./0006-npm-scope.md) — the scope is still unclaimed
