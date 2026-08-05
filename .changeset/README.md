# Changesets

Release tooling for the single version train
([ADR-0005](../docs/adr/0005-single-version-train.md)).

## What this is set up to do, and what it deliberately cannot

**It can version. It cannot publish.**
[ADR-0024](../docs/adr/0024-publication-hold.md)'s hold is still in force, so there is no
`release` script, no `changeset publish`, and no CI workflow that runs either. Every package
is also still `private: true`, which npm refuses to publish independently of anything here.

Those are three separate brakes on purpose. Removing the hold should be a decision somebody
takes deliberately, in one place, not something that happens because a script existed.

## The configuration, and why

- **`fixed`, with all five packages in one group.** ADR-0005's single version train: they
  share one version and release together, including packages with no changes in a given
  release. A host who has `@kajay/core@1.2.0` should never have to work out which
  `@kajay/react` goes with it.
- **`privatePackages: { version: true, tag: false }`.** Without this, changesets skips
  private packages entirely — no bump, no changelog — so the train could not be rehearsed at
  all while the hold stands. Versioning works; tagging does not, because a tag is a release
  artefact.
- **`ignore` lists both apps.** `@kajay/host-demo` and `@kajay/site` are how the library is
  proved and shown, not things anybody installs.
- **`access: "restricted"`.** Belt and braces behind `private: true`. If both were somehow
  lifted at once, the failure mode is a publish that is refused rather than one that
  succeeds.
- **`commit: false`.** The version bump lands in the working tree and a person commits it,
  so the release commit gets the same review as everything else.

## Adding a changeset

```bash
pnpm changeset
```

Pick the packages, pick the bump, describe the change for **a consumer** — what they can now
do, or what they must now change — rather than what moved in the source. The changelog is
read by people deciding whether to upgrade.

## Cutting the version

```bash
pnpm changeset:version
```

Applies every pending changeset, writes the changelogs and bumps all five packages together.
It does not publish, tag, or push.

## The 1.0.0 cut

ADR-0005 puts `1.0.0` at Phase 3 exit. The first release therefore needs a **major**
changeset, because the packages are at `0.0.0` and a minor would produce `0.1.0`. That is
the one moment the version has to be stated rather than derived.
