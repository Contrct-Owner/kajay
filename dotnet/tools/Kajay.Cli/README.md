# Kajay CLI

`Kajay.Cli` promotes an immutable `.kajay` definition release between workflow hosts
using short-lived WorkOS machine-to-machine access tokens.

```bash
dotnet tool install --global Kajay.Cli
kajay promote --help
```

Client secrets are read only from environment variables. Promotion exports the named
digest from the source, preflights and installs it on the target, and activates it only
when `--activate` and `--expected-version` are both supplied.

See the repository's `docs/workflow-host.md` for complete configuration and deployment
examples.
