# ADR-0037 — WorkOS AuthKit owns workflow-host identity

- Area: Workflow-host identity and authorization
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

Tenant and actor headers are useful while proving persistence behavior but are not an
identity boundary. Any caller that can choose those values can cross tenant boundaries,
forge audit attribution, and claim an unverified production approval. The host needs
one organization-aware authentication model before real usage begins, without adding
identity concerns to `Kajay.Core`.

## Decision

The workflow host is a WorkOS AuthKit resource server. It accepts WorkOS access tokens
through the standard bearer scheme and validates their signature against the JWKS URL
built by the official WorkOS .NET SDK. Validation is fail-closed for issuer, audience,
RS256 algorithm, signature, lifetime, subject, and selected organization.
Audience defaults to the WorkOS Client ID and can be configured to an AuthKit Resource
Indicator when the API is registered as a distinct resource.

The WorkOS `org_id` claim is the host `TenantId`; `sub` is the authenticated `ActorId`.
There is no tenant or actor header fallback. AuthKit permission claims authorize stable
host capabilities rather than WorkOS role slugs:

- `kajay:workflow:read`
- `kajay:workflow:execute`
- `kajay:definition:manage`
- `kajay:definition:promote`
- `kajay:definition:approve`

Production Activation requires both promotion and approval permissions. The approver
recorded in persistence and audit is the authenticated subject; the request cannot name
an approver. Health remains anonymous. OpenAPI and all application APIs require an
appropriate permission.

The browser application owns AuthKit login, organization selection, access-token
refresh, and logout. The workflow host validates the resulting access token and does
not persist refresh tokens. A WorkOS API key is therefore not required by this resource
server; future server-side WorkOS management calls must inject a configured
`WorkOSClient` rather than use global SDK configuration.

An opt-in host browser-session adapter may own those steps when the workflow host is
also the application's authentication host. Its protected cookie feeds the WorkOS
access token back through this same bearer validator; it is not an alternate identity
scheme. The local Compose stack enables that adapter against WorkOS Emulate under
[ADR-0038](./0038-workos-emulate-local-authentication.md). Production resource-server
deployments may leave it disabled and require no WorkOS API key.

## Consequences

- Tenant isolation and audit attribution share one cryptographically verified source.
- Permission changes take effect when AuthKit issues a refreshed access token.
- Role design can evolve in WorkOS without changing host policy names.
- Local and integration tests use real JWT bearer validation with an ephemeral signing
  key; they do not bypass authorization with a test authentication handler.
- WorkOS availability is needed when a new signing key must be fetched, while cached
  keys continue to validate tokens during normal operation.
- Browser-session enablement is a host deployment choice and does not change the SDK
  or bearer-token contract.

## Parent and related links

- [ADR-0035 — workflow host owns durable orchestration](./0035-workflow-host-owns-durable-orchestration.md)
- [ADR-0036 — promote immutable definition releases](./0036-definition-release-promotion.md)
- [Workflow host guide](../workflow-host.md)
