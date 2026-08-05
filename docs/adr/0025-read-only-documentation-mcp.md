# ADR-0025 — Expose Kajay documentation through a read-only MCP server

- Area: Documentation delivery and external integrations
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

## Context

The consumer documentation on `kajay.io` is useful to people in a browser, but coding
agents and other MCP clients should be able to discover the same reference facts
without scraping rendered HTML. The documentation system already has two different
source shapes:

- authored React pages for explanations and guides; and
- a committed, generated reference manifest derived from contracts, conformance data,
  package exports, and the public-interface ledger.

MCP can expose resources, tools, and prompts. That breadth creates a risk of turning a
documentation integration into a second survey API or an unaudited authoring surface.
It also creates a package-boundary risk if protocol code leaks into the headless
runtime packages.

## Decision

Kajay will expose a preview MCP endpoint at `/mcp`, owned entirely by `apps/site`.
The endpoint uses stateless Streamable HTTP and the official TypeScript MCP SDK's Web
Standard transport so it remains compatible with the site's deployment runtime.

The first contract is deliberately read-only:

- `kajay://docs/index` is a Markdown resource that explains the catalog and links to
  the browser documentation.
- `kajay://docs/reference-manifest` is a JSON resource containing the same committed,
  generated reference facts that drive the website.
- `search_kajay_docs` is a read-only tool that searches authored page metadata and
  generated reference records. Results include a stable result kind, title,
  description, and canonical `kajay.io` documentation URL.
- The server exposes no prompts and no tools that create, edit, validate, execute, or
  persist surveys.

Authored prose remains browser-first in this slice. Search can discover authored
guides and return their canonical URLs, while the generated reference is available as
machine-readable content. Full authored-page content will not be duplicated into a
second hand-maintained MCP corpus. It may be added after the authored source becomes
serializable without losing the React presentation layer.

The protocol adapter is a feature module under `apps/site/src/features/docs-mcp`.
The `/mcp` route only delegates Requests to that feature. The MCP SDK and its schema
validator are site dependencies; no published `@kajay/*` package depends on either.

## Public behavior

- The endpoint accepts MCP JSON-RPC requests over `POST /mcp`.
- It is stateless and returns JSON responses; clients do not need to retain an MCP
  session identifier.
- `GET` and `DELETE` return `405 Method Not Allowed` because this server does not
  provide a standalone event stream or server-managed sessions.
- Search input is schema-validated, limited to a non-empty 200-character query, and
  returns at most 20 results.
- An `Origin` header, when present, must identify the same origin as the endpoint.
  Non-browser MCP clients may omit it.
- The endpoint is public because all exposed data is already public documentation.
  Authentication, personalized resources, and mutation would require a new decision.

## Consequences

- MCP clients get deterministic, searchable documentation without HTML scraping.
- Browser pages and MCP reference output share one generated source of truth.
- The initial integration is useful but intentionally does not return the full prose
  of authored guides.
- Stateless request handling avoids shared session storage and makes horizontal
  deployment straightforward.
- The official SDK is isolated behind one feature boundary, reducing the cost of
  adapting to future MCP transport revisions.
- Any future survey authoring, validation, execution, or persistence tool must define
  its security, resource limits, compatibility contract, and ownership in a separate
  ADR before implementation.

## Alternatives considered

- **Expose every survey operation as an MCP tool.** Rejected for this slice: it mixes
  documentation discovery with runtime authority and needs a separate security and
  compatibility design.
- **Return rendered documentation HTML as resources.** Rejected: presentation markup
  is a poor agent contract and would make DOM output an accidental API.
- **Maintain separate Markdown copies for MCP.** Rejected: duplicated prose would
  drift from the website.
- **Put MCP support in `@kajay/core`.** Rejected: transport integration is not survey
  domain logic and would violate the zero-runtime-dependency core boundary.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [ADR-0020](./0020-versioned-cross-language-runtime-contract.md)
- [Consumer MCP guide](../../apps/site/src/features/consumer-guides/content/integrationGuides.tsx)
- [Documentation reference generator](../../scripts/docs/generate-reference-manifest.mjs)
