# Documentation System

- Area: Repository and consumer documentation architecture
- Status: active
- Owner: Jarod
- Last updated: 2026-08-12

## Scope and goal

Kajay documentation serves package consumers, SDK extenders, maintainers, and coding
agents without duplicating the authoritative definition or compatibility facts. A reader
should be able to choose an SDK quickly, learn shared Kajay concepts once, then drill
into platform-specific integration and API detail.

Acceptance means:

- both TypeScript and C# have a discoverable public quickstart and integration path;
- shared schema, expression, diagnostic, and compatibility facts come from generated
  contracts or conformance data;
- each published SDK has package-local onboarding and browsable public API facts;
- browser search, sitemap, and the read-only MCP endpoint share the same generated
  catalog; and
- repository summaries state current truth while completed plans and ADRs remain
  clearly identified history.

## Documentation layers

| Layer | Audience | Authority |
| --- | --- | --- |
| Root summaries | Contributors and agents | `README.md`, `CONTEXT.md`, `docs/README.md`, `docs/sdk-summary.md` |
| Consumer guides | SDK adopters | Authored feature pages under `apps/site/src/features/` |
| Definition reference | Every SDK | `contracts/` and `conformance/` through the generated reference manifest |
| TypeScript API reference | npm consumers | Package root exports and the checked public-interface ledger |
| C# API reference | NuGet consumers | Public C# declarations checked against `PublicAPI.Shipped.txt` and `PublicAPI.Unshipped.txt` |
| Package onboarding | Package managers and source readers | `packages/*/README.md` and `dotnet/README.md` |
| Decisions and delivery history | Maintainers | `docs/adr/`, `docs/delivery-roadmap.md`, and the archived remediation plan |

## Public information architecture

The browser documentation starts with three adoption paths:

1. TypeScript + React survey rendering.
2. Native C# headless execution.
3. TypeScript + React Creator embedding.

Language-neutral pages explain definitions, expressions, diagnostics, accessibility,
and compatibility. Platform pages own installation, runtime APIs, hosting adapters,
framework rendering, and extension mechanics. This avoids false symmetry: C# has no
Kajay renderer or Creator, while TypeScript UI packages do not define cross-runtime
value semantics.

## Generation and data flow

```text
contracts + conformance + TypeScript exports + C# public declarations
                              |
                              v
                 docsReferenceManifest.ts
                       /              \
                      v                v
             kajay.io reference     search + MCP
                      |
                      v
                  sitemap.xml
```

Key implementation files:

- `scripts/docs/generate-reference-manifest.mjs` composes the committed manifests and
  sitemap.
- `scripts/docs/buildReferenceManifest.mjs` normalizes definition, expression,
  TypeScript, and C# API facts.
- `apps/site/src/features/docs-catalog/` owns page composition.
- `apps/site/src/features/docs-reference/` owns generated facts and search.
- `apps/site/src/features/docs-mcp/` exposes the read-only agent-facing projection.

## Quality gates

Run from the repository root:

```bash
pnpm run check:docs
pnpm run test:unit
pnpm run test:e2e
```

`check:docs` verifies authored-page metadata, generated artifact drift, reference
coverage, stable URLs, local Markdown links, package README presence, and both SDKs in
the public catalog. Site unit and E2E tests prove navigation, search, rendering, and MCP
behavior.

## Constraints and gotchas

- Do not hand-copy generated definition facts into platform guides.
- Do not claim a conformance version from package-number equality.
- A public C# declaration must remain in the API analyzer baseline and the generated
  reference; a TypeScript symbol must remain reachable from the package root.
- Authored React pages are presentation-rich but not serializable as full MCP prose.
  MCP search therefore returns canonical page URLs and generated reference facts.
- Completed plans stay available for rationale, but summaries must not treat their
  historical next steps as current work.

## Follow-ups

- Add source-backed TypeScript declaration signatures and descriptions without
  manufacturing prose in the generator.
- Add serializable authored-page content to MCP only after one source can serve both
  browser presentation and machine-readable prose.
- Promote individual public pages from `preview` to `stable` only with a named content
  review and consumer proof.

## Parent and related links

- Parent summary: [Documentation catalog](./README.md)
- [SDK summary](./sdk-summary.md)
- [Project context](../CONTEXT.md)
- [Read-only documentation MCP decision](./adr/0025-read-only-documentation-mcp.md)
- [Library development guidelines](./library-development-guidelines-details.md)
