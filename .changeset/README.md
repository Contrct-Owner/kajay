# Changesets

Release tooling for the five-package TypeScript version train
([ADR-0005](../docs/adr/0005-single-version-train.md)).

Kajay 1.0.0 is published. All five `@kajay/*` packages version and release together;
`@kajay/site` is private and ignored because it is deployed as Kajay.io rather than
installed by consumers.

## Adding a changeset

```bash
pnpm changeset
```

Describe the change in consumer terms: what adopters can now do or what they must change.
Choose the semver impact against the published public interface and compatibility policy.

## Preparing a release

```bash
pnpm changeset:version
pnpm run verify
```

Commit the generated package versions and changelogs. The manual release workflow verifies
the requested version, requires a typed confirmation, runs the complete gate chain, and
publishes through npm trusted publishing with provenance.

## Configuration

- `fixed` keeps all five packages on one version.
- `access: public` matches the published npm scope.
- `ignore: ["@kajay/site"]` keeps the private application out of the train.
- `commit: false` leaves the reviewed release commit to a maintainer.
