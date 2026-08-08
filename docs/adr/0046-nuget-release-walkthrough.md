# ADR-0046 — The NuGet release walkthrough

- Area: Release policy
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-08

The NuGet half of [ADR-0029](./0029-release-walkthrough.md), which is npm end to end: scope,
licensing, version train, trusted publisher and `npm deprecate` rollback all describe the five
`@kajay/*` packages. `Kajay.Core` has been built, packed and exercised as an installed package on
every CI run since [ADR-0030](./0030-native-csharp-sdk-and-v2-runtime-semantics.md), and has never
been published. This decides the same five questions for nuget.org, in ADR-0029's order, and does
not restate what carries over unchanged.

## 1. Package identity and publishable scope

**`Kajay.Core`, and it is unclaimed.** Verified 2026-08-08: the nuget.org registration index
returns 404 and a gallery search for `kajay` returns zero results.

**One deep package, as ADR-0030 decided.** Model, expressions, validation and contracts stay
inside it; nothing else is expected under a `Kajay.` prefix. This is the NuGet restatement of
ADR-0029's "Kajay is the product, not a house name" — and it has the same expiry, in that the
shape is nearly free to change before the first publish and impossible after.

Reserving the `Kajay.` ID prefix on nuget.org is worth doing and is **not** a precondition: it
stops third parties publishing `Kajay.Anything`, which matters more once the name is visible than
it does now.

## 2. Licensing

**MIT**, matching `@kajay/core` under [ADR-0028](./0028-mit-runtime-source-available-creator.md).
Already declared as `PackageLicenseExpression` in `Kajay.Core.csproj`, with the runtime `LICENSE`
packed from `packages/core/LICENSE` so the two halves cannot drift apart.

The FSL question does not arise. There is no native Creator, and ADR-0045 focused the repository
in a way that does not create one.

## 3. First version and compatibility promise

**`1.0.0`**, the version the csproj and changelog already carry.

**Package version equality with npm means nothing, and that is the promise.** ADR-0030 rejected
synchronising the two, so `Kajay.Core 1.0.0` and `@kajay/core 1.0.0` claim no relationship beyond
the name. Interoperability is selected by the schema and conformance versions exposed through
`KajayContracts` — currently survey schema v1 and conformance v1 and v2 — and those are what a
consumer pins against. The installed-package smoke in `scripts/dotnet-pack-test.mjs` asserts every
one of those numbers against the real artifact, so this is machine-verified rather than asserted.

The API compatibility baseline is the shipped `PublicAPI.Shipped.txt` enforced by
`Microsoft.CodeAnalysis.PublicApiAnalyzers`, which is the C# equivalent of what
`docs/public-package-interfaces.md` does for TypeScript. The .NET 10 floor is stated, not promised
as a major.

> The changelog carried an `Unreleased` section — Response Snapshot Format v1 — stacked on top of
> a `[1.0.0] - 2026-08-05` heading that had never been published. Folded into 1.0.0 as part of this
> ADR, because a version nobody could install cannot have had contents anyone observed. Recorded
> as the kind of thing only a pre-publish read finds.

## 4. Version train and release module

**Independent, per ADR-0030.** No changesets, no fixed group, no coupling to the five npm
packages. `<Version>` in `Kajay.Core.csproj` is the single source of truth, and the release
workflow proves it by checking the *artifact* `dotnet pack` produced rather than grepping the
manifest.

The cost accepted is that the .NET version has to be bumped by hand where the npm versions are
bumped by a tool. That is the correct trade for one package: the machinery changesets provides
exists to keep five manifests in step, and there is only one here.

## 5. Workflow, provenance, access control and rollback

**Workflow.** `.github/workflows/release-dotnet.yml`, manual only, taking the version and a typed
`RELEASE` confirmation, refusing if the packed artifact is not that version, and running the full
`verify` chain first. Separate from `release.yml` for two independent reasons: §4 above, and
because a nuget.org trusted-publishing policy names a workflow *file*, so the .NET publish needs
its own file whatever the version policy said.

The chain is the whole of `verify`, not `verify:dotnet`. The generated `contracts/*.json` ship
*inside* the nupkg as embedded assembly resources, so `check:contract` guards the artifact's
contents directly; and `check:conformance` is what proves the two runtimes still agree, which is
the actual compatibility claim from §3.

**Access control: trusted publishing, so there is no API key.** nuget.org exchanges the OIDC token
GitHub issues for this workflow for an API key valid one hour and usable once. The policy names
the repository owner, the repository, the workflow file and the `release` environment; renaming
any of the four stops publishing until nuget.org is told. Nothing long-lived is stored anywhere —
the same reasoning ADR-0029 applied to npm.

Timing made this straightforward rather than merely preferable. From **2026-08-17** nuget.org caps
new API keys at 30 days, and **every key created before that date expires 2026-11-01**. Adopting
key-based publishing nine days beforehand would have meant adopting a credential model already
being retired.

The one value stored is the repository secret `NUGET_USER`, the nuget.org profile name. It is not
a credential — it names the account, and the OIDC policy is what authorises the publish.

> The policy is **owner-scoped**, not package-scoped: it authorises publishing for every package
> that owner owns. That is a property of nuget.org, not a choice available here, and it is the
> reason the workflow file and environment in the policy carry the real specificity.

**Provenance.** Deterministic builds, Source Link and a `.snupkg` symbol package are already
configured in the csproj, and `ContinuousIntegrationBuild` turns on automatically in Actions.
`RepositoryUrl` is declared so the published package points back at the commit it was built from.

**Rollback: deprecate, unlist if it must be hidden, never expect deletion.** nuget.org does not
support permanent deletion — unlike npm's 72-hour unpublish window, there is no equivalent lever
at all. Unlisting hides a version from search and from the package page while leaving exact-version
restore working, so it does not break consumers who already took it. Deprecation is the honest
signal, since it reaches consumers in their tooling rather than only removing the version from
view. Either way the version number is burned, so the policy is the same one ADR-0029 reached for
npm by a different route: mark the bad version, ship the fix as a patch.

## What this does not authorize

**Publication remains a separate, explicit decision**, exactly as ADR-0029 held for npm.

What stands between this and nuget.org, as of 2026-08-08:

- **no trusted publishing policy is registered on nuget.org**, so the workflow has no identity to
  publish with; and
- the `NUGET_USER` repository secret does not exist.

Both are steps on nuget.org and GitHub rather than in this repository, which is the better place
for them: neither can be flipped by a commit, and both require the account owner.

## Consequences

- The .NET version is bumped by hand. Nothing enforces a relationship to the npm train, and
  nothing should.
- A bad `Kajay.Core` version is permanent in a way a bad `@kajay/core` version is not within its
  first 72 hours. The full-`verify` gate is doing more work here than its npm counterpart, and
  removing it would be a larger change than it looks.
- The trusted-publishing policy is owner-scoped, so it is a control over the account rather than
  over this package. Adding a second package under the same owner inherits it.

## Parent and related links

- [ADR-0029](./0029-release-walkthrough.md) — the npm half this parallels
- [ADR-0030](./0030-native-csharp-sdk-and-v2-runtime-semantics.md) — one package, independent versions
- [ADR-0028](./0028-mit-runtime-source-available-creator.md) — the licensing decision
- [Trusted Publishing on nuget.org](https://learn.microsoft.com/en-us/nuget/nuget-org/trusted-publishing)
- [Deleting packages from nuget.org](https://learn.microsoft.com/en-us/nuget/nuget-org/policies/deleting-packages)
