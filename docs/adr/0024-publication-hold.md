# ADR-0024 — Publication hold pending an explicit release walkthrough

- Area: Release policy
- Status: superseded by ADR-0029
- Owner: Jarod
- Last updated: 2026-08-04


> **Superseded by [ADR-0029](./0029-release-walkthrough.md) (2026-08-05).** The owner walked through all five gates; the decisions are recorded there. Publication itself remains a separate, explicit act, which is what this ADR asked for.

## Context

Functional Phase 3 acceptance and package publication are separate decisions. The
acceptance proofs are green, but several release choices have not been walked through
explicitly: the product brand and npm scope, the licensing model, the first published
version, the version-train policy, and the release tooling and workflow.

The repository already has a safe unpublished state. Every package is marked
`private`, uses version `0.0.0`, and carries `UNLICENSED` metadata. Changesets is
installed as a root development dependency, but there is no Changesets configuration,
release script, publishing workflow, or registry publication.

## Decision

- Keep every package private and unpublished.
- Do not claim an npm organization, publish to a registry, configure a release
  workflow, or activate Changesets while this hold is in effect.
- Treat `@kajay/*` as the working source-code scope only. It is not a final brand or
  an assertion that the npm organization is owned.
- Treat `0.0.0` and `UNLICENSED` as unpublished-state sentinels, not as the selected
  first release version or final licensing model.
- Defer the brand/scope, license, first-version, version-train, and release-tooling
  choices until an explicit release walkthrough with the owner.
- Lifting this hold and performing an external publication are separate decisions.
  Neither is implied by functional acceptance or by completing the walkthrough.

## Walkthrough exit gate

Before this ADR can be superseded, the owner must explicitly decide and record:

1. the product brand and publishable package scope, including verified ownership;
2. whether the repository and each package family are proprietary, source-available,
   or open source, with the exact license or licenses;
3. the first published version and compatibility promise;
4. whether packages use a single version train and whether Changesets is the chosen
   release module; and
5. the release workflow, provenance, access controls, and rollback process.

After those decisions, release implementation must pass the normal repository gates
and an artifact-level dry run. Actual publication still requires explicit owner
authorization.

## Consequences

- Phase 3 can be reported as functionally delivered without implying that packages
  are release-ready or public.
- The current package metadata remains coherent and cannot be published accidentally
  through the ordinary npm command path because `private` is true.
- The installed Changesets dependency is inert scaffolding. Keeping it does not
  ratify Changesets; retaining or removing it is part of the release walkthrough.
- No deadline is inferred for the deferred choices. The trigger is an explicit owner
  request to begin the release walkthrough.

## Parent and related links

- [ADR-0005](./0005-single-version-train.md)
- [ADR-0006](./0006-npm-scope.md)
- [ADR-0007](./0007-license-and-repo-posture.md)
- [Architecture remediation plan](../architecture-remediation-plan.md)
- [Project context](../../CONTEXT.md)
