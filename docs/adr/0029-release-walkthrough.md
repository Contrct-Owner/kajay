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

**Versioning is automated; publishing is not, and the split is the decision.** Running
`changeset version` is mechanical — bump five manifests, write five changelogs, delete the
files consumed — and nothing is served by a person typing it. `.github/workflows/version.yml`
does it on every push to `main` and opens a pull request with the result, which is a diff
somebody reads rather than a command somebody remembers. `changesets/action` would publish
from the same step and is deliberately not asked to: that would put publishing on a merge
trigger and bypass this workflow's confirmation, its version check and its OIDC identity.

**A branch says what it does to the packages, or says that it does nothing.**
`check:changeset` asks Changesets which packages a branch touched and whether a changeset
covers them, so documentation, CI and `apps/site` pass without one and `packages/*` does not.
`changeset add --empty` is the escape hatch and is meant to be used: a refactor with no
observable behaviour is a real thing, and recording that judgement is a sentence in a review
rather than a silence. It is the one check outside `verify`, because it compares a branch
against a base and only a pull request has one.

**Access control: trusted publishing, so there is no token.** npm mints a short-lived
credential from the OIDC identity GitHub issues for this workflow. Nothing long-lived is
stored in the repository, the environment, or anywhere else — the strongest version of an
access control is not having a secret to leak.

The trusted publisher registered on npm names this repository, this workflow file and the
`release` environment. Renaming any of the three stops publishing until npm is told, which
is the property that makes it an access control rather than a convenience. The environment
survives the token's removal for its other job: gating on a required reviewer.

It needs npm 11.5.1 or later, which is newer than the npm bundled with any Node, so the
workflow installs it explicitly. Node's own floor of 22.14.0 is already cleared by the
pinned 24.

**Provenance: on, and now inherent.** Trusted publishing generates attestations
automatically for a public repository, so the earlier `NPM_CONFIG_PROVENANCE` is gone.
`publishConfig.provenance` stays in each manifest, which is deliberate belt-and-braces: it
also makes a local `npm publish` fail, because a laptop has no OIDC identity to sign with.

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

What stands between this and npm, as of 2026-08-05:

- **no trusted publisher is registered on npm**, so the workflow has no identity to publish
  with. This replaced `private: true`, which has been removed from all five packages; and
- the artifact-level dry run ADR-0024 requires has not been run against the real scope.

## Consequences

- ADR-0024 is superseded; ADR-0005 and ADR-0006 return to accepted.
- North Star §11's two open decisions — claim the scope, confirm the branding — are both
  closed by this ADR.
- The compatibility promise gives the ledger a second job. It was a documentation aid; it is
  now the thing consumers rely on, so removing a name from it is a breaking change even when
  the export survives.
- The last brake is registering the trusted publisher, which happens on npm rather than in
  this repository. That is a better place for it than a flag in a manifest: it cannot be
  flipped by a commit, and it is the one step that requires the account owner.

## Parent and related links

- [ADR-0024](./0024-publication-hold.md) — the hold this supersedes
- [ADR-0028](./0028-mit-runtime-source-available-creator.md) — the licensing half
- [ADR-0005](./0005-single-version-train.md), [ADR-0006](./0006-npm-scope.md)
- [Public package interfaces](../public-package-interfaces.md) — the semver surface
