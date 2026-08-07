# ADR-0040 — Promotion automation uses a CLI and scoped WorkOS machine identity

- Area: Definition promotion automation and non-human identity
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

ADR-0036 deliberately made promotion an automation workflow rather than a third
persistent application, but the host routes alone leave every pipeline to rebuild
bundle export, target preflight, idempotent install, optimistic Activation, token
acquisition, and error handling. Long-lived bearer tokens or human refresh tokens are
not an acceptable CI credential. Putting this orchestration in `Kajay.Core` would also
mix deployment policy into the embeddable survey runtime.

WorkOS Connect M2M applications implement OAuth 2.0 client credentials. Their access
tokens retain the same verified `sub` and `org_id` identity claims as the host already
requires, while their capabilities are represented by the space-delimited `scope`
claim instead of the human session's `permissions` array.

## Decision

`Kajay.Cli` is a separately packaged .NET 10 tool with the command `kajay promote`.
It is automation, not an SDK interface and not a deployed control plane. One command:

1. obtains a short-lived source token;
2. exports the exact requested digest from the source host;
3. obtains a short-lived target token;
4. preflights target compatibility and Environment Bindings;
5. verifies that preflight computed the requested digest;
6. installs idempotently; and
7. optionally activates with a required `--expected-version` ETag.

Source and target hosts never call one another. The CLI holds the bundle only in
memory for the invocation and keeps the existing 10 MiB host limit. It writes one
stable JSON result to standard output and structured errors to standard error.

The CLI accepts client IDs and token endpoints as options, but client secrets only
through named environment variables. It never persists tokens, refresh credentials,
or secrets. The source token requests `kajay:definition:manage`; the target requests
`kajay:definition:manage` and `kajay:definition:promote`. An explicit production
Activation additionally requests `kajay:definition:approve`.

The workflow host satisfies a Kajay permission from either the WorkOS human-session
`permissions` claim or the M2M `scope` claim, after the same issuer, audience, RS256,
signature, lifetime, `sub`, and `org_id` validation. Local WorkOS Emulate seeds two
M2M applications: routine promotion lacks approval, while production Activation has
a separate credential with approval. Production pipelines should expose that second
secret only after their external protected-environment approval gate.

## Consequences

- CI receives short-lived, organization-scoped identity without storing user sessions.
- Routine promotion cannot silently acquire production approval authority.
- Retrying the command is safe through digest verification, idempotent install, and
  activation ETags.
- Filesystem and OCI artifact adapters remain future additions; the first command
  transfers directly in memory between authenticated hosts.
- A persistent promotion control plane is still deferred until fleet-wide policy,
  scheduling, or ownership makes another deployable earn its cost.

## Verification

`Kajay.Cli.Tests` proves orchestration and failure ordering through the tool's deep
promotion interface. `MachinePromotionFlowTests` uses real WorkOS Emulate
client-credentials tokens, real JWT middleware, and PostgreSQL to prove scoped
promotion, production denial, and the separate approval identity. The .NET gate packs
the tool, installs its NuGet artifact into a clean tool path, and invokes its help
interface.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [Workflow host guide](../workflow-host.md)
- [Definition promotion decision](./0036-definition-release-promotion.md)
- [WorkOS identity decision](./0037-workos-authenticated-workflow-host.md)
- [WorkOS M2M applications](https://workos.com/docs/authkit/connect/m2m)
- [WorkOS Emulate](https://github.com/workos/emulate)
