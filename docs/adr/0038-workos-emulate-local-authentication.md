# ADR-0038 — WorkOS Emulate provides local workflow-host identity

- Area: Workflow-host local development
- Status: superseded by 0045
- Owner: Jarod
- Last updated: 2026-08-08

## Context

The workflow host validates production WorkOS access tokens, but a developer should
not need a shared WorkOS environment or manually manufactured JWT to run the complete
application locally. Local authentication must still prove the real authorization-code
exchange, RS256/JWKS validation, organization boundary, and Kajay permission policies.
It must not add a development identity bypass or move WorkOS concerns into `Kajay.Core`.

Docker networking creates two WorkOS addresses: the browser reaches a published host
port while the workflow container reaches a Compose service name. The token issuer is
an identity claim and must remain the browser-visible URL; JWKS and token exchange may
use the internal address.

## Decision

The workflow Compose stack has an optional `compose.workos-emulate.yaml` overlay. It
runs the version-pinned WorkOS Emulate image on loopback, with interactive AuthKit and
deterministic users, organization membership, roles, and permissions. The seed carries
separate author, operator, approver, and administrator identities so local promotion
and execution scenarios exercise separation of duties.

The host's bearer-token contract remains authoritative. An opt-in browser-session
adapter uses the official WorkOS .NET SDK to create a PKCE authorization request,
exchange the code, rotate the refresh token, and build the logout URL. Access and
refresh tokens live only in a data-protected, HTTP-only, same-site host cookie. On each
request the adapter supplies the access token to the existing JWT bearer handler;
signature, issuer, audience, lifetime, `sub`, `org_id`, and permissions therefore use
one validation path for cookies and explicit bearer headers.

The local issuer is `http://localhost:4100`, while server-to-server calls and JWKS use
`http://kajay-workos-emulate:4100`. Plain HTTP and the fixed test API key are permitted
only in the overlay. Data Protection keys use a separate named volume so local sessions
survive a workflow-host container restart.

The normal integration tests keep their ephemeral signing key. A focused Testcontainers
proof starts WorkOS Emulate on a random host port, walks the interactive PKCE flow, and
asserts the seeded permission boundaries. Emulate is integration infrastructure, not
the production-conformance oracle.

M2M `scope` claims are not treated as user `permissions`. Service-principal policy will
be designed explicitly if M2M workflow access is introduced.

## Consequences

- Local login exercises the same identity facts and authorization handlers as WorkOS.
- The emulator and browser-session adapter remain host infrastructure; the SDK seam is
  unchanged.
- Production deployments can keep the browser-session adapter disabled and accept
  bearer tokens from another browser or BFF host.
- The cookie adapter is local/demo infrastructure, not a production session contract.
  Production adoption requires a separate design for distributed refresh coordination,
  cookie size and revocation, CSRF protection, HTTPS, and durable key storage.
- Emulator endpoint gaps cannot be interpreted as WorkOS production behavior.

## Parent and related links

- [ADR-0037 — WorkOS AuthKit owns workflow-host identity](./0037-workos-authenticated-workflow-host.md)
- [WorkOS Emulate](https://github.com/workos/emulate)
