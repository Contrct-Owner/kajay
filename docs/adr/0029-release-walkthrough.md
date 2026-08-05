# ADR-0029 — The release walkthrough

- Area: Release policy
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-05

Supersedes [ADR-0024](./0024-publication-hold.md), whose exit gate this discharges. The
five decisions it required are below, in its order.

## 1. Brand and publishable scope

**`@kajay/*`, and the owner has claimed it.** That closes the condition ADR-0006 was
accepted under.

**Kajay is the product, not a house name.** The survey engine *is* Kajay, so the packages
keep the names they have: `@kajay/core` is the survey runtime rather than a generic one that
happens to live here. Nothing else is expected under the scope.

This forecloses an umbrella — `@kajay/survey-core` alongside some later `@kajay/other-*` —
and that is the point of deciding it now. The rename is nearly free before the first publish
and impossible after.

## 2. Licensing

Decided in full by [ADR-0028](./0028-mit-runtime-source-available-creator.md): MIT for
`core`, `react` and `themes`; `FSL-1.1-ALv2` for `creator-core` and `creator-react`, both
converting to Apache-2.0 two years after release. Canonical texts are in the repository and
in each `files` array.

## 3. First version and compatibility promise

**`1.0.0`**, all five together, already applied with changelogs.

**The ledger is the contract.** `docs/public-package-interfaces.md` defines the semver
surface exactly: every name in it is stable under semver, and *anything not in it is
internal and may change in a minor*. That includes DOM structure, CSS class names,
diagnostic wording, and any export that exists only so two packages can talk to each other.

Chosen because it is the promise the repository can actually keep and already checks —
`check:docs` fails when the ledger and the exports disagree, so this is machine-verified
rather than asserted. "Everything exported is stable" was rejected: this codebase exports
types freely for composition, and promising them all would make every incidental export a
compatibility obligation.

Runtime floors are stated but **not** promised as majors here: TypeScript 5.5
([ADR-0014](./0014-typescript-support-window.md)), Node `>=22.12.0`, React `^19` as a peer.
Raising one is a breaking change for the consumers it excludes; committing to that in
writing is a separate decision nobody has needed yet.

## 4. Version train and release module

**Ratified rather than assumed**, which ADR-0024 explicitly required: keeping Changesets
installed did not ratify it.

Single version train, all five packages in one `fixed` group, released together including
packages with no changes. Changesets is the release module.
[ADR-0005](./0005-single-version-train.md) returns to accepted.

## 5. Workflow, provenance, access control and rollback

**Workflow.** `.github/workflows/release.yml`, manual only — no push, tag or merge triggers
it. It takes the version and a typed `RELEASE` confirmation, refuses if any package disagrees
with that version or if changesets are still pending, and runs the full `verify` chain before
publishing.

**Provenance: on.** `publishConfig.provenance` on all five, with `id-token: write` in the
workflow. Each tarball gets a signed, verifiable link back to the commit and workflow run
that built it. It is free, and it is what makes a supply-chain claim checkable rather than
stated.

**Access control.** Publishing runs in the `release` GitHub environment, so it can be gated
on a required reviewer, and the npm token lives there rather than in repository secrets.
`publishConfig.access` is `public` on every package — including the FSL ones, since
source-available means the terms are restrictive, not that the package is hidden.

> `.changeset/config.json` said `access: "restricted"` until this walkthrough. Scoped
> packages default to restricted and restricted requires a *paid* npm organisation, so the
> first publish would have failed. Worth recording as the kind of thing only a dry run or a
> read finds.

**Rollback: deprecate and patch. Never unpublish.** A bad version is marked deprecated with
a message naming the fix, and the fix ships as a patch. npm allows unpublish for 72 hours,
and using it breaks everyone who installed inside the window while burning the version
number forever — so the policy is the one that behaves the same on day one and day ninety.

```bash
npm deprecate @kajay/core@1.0.1 "Broken export map; use 1.0.2"
```

## What this does not authorize

**Publication remains a separate, explicit decision**, exactly as ADR-0024 said it would.
Completing the walkthrough permits a release; it does not perform one.

Two things still stand between this and npm, both deliberate:

- every package is still `private: true`; and
- the artifact-level dry run ADR-0024 requires has not been run against the real scope.

## Consequences

- ADR-0024 is superseded; ADR-0005 and ADR-0006 return to accepted.
- North Star §11's two open decisions — claim the scope, confirm the branding — are both
  closed by this ADR.
- The compatibility promise gives the ledger a second job. It was a documentation aid; it is
  now the thing consumers rely on, so removing a name from it is a breaking change even when
  the export survives.
- Flipping `private` is now the single remaining mechanical step, which is a smaller and more
  visible surface than the four brakes that preceded it. That is intended: the last brake
  should be one deliberate act rather than several partial ones.

## Parent and related links

- [ADR-0024](./0024-publication-hold.md) — the hold this supersedes
- [ADR-0028](./0028-mit-runtime-source-available-creator.md) — the licensing half
- [ADR-0005](./0005-single-version-train.md), [ADR-0006](./0006-npm-scope.md)
- [Public package interfaces](../public-package-interfaces.md) — the semver surface
