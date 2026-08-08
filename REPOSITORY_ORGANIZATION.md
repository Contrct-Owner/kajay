# Repository Organization

- Area: Repository structure and ownership
- Status: active
- Owner: Jarod
- Last updated: 2026-08-08

## Purpose

Keep Kajay focused on two SDK implementations, their shared contracts, and one public
product application. A new top-level area must represent a durable product responsibility,
not a temporary integration experiment.

## Supported structure

```text
apps/
  site/                       Kajay.io: marketing, docs, playground
packages/
  core/                       headless TypeScript survey runtime
  react/                      React survey adapter
  creator-core/               headless TypeScript authoring runtime
  creator-react/              React authoring adapter
  themes/                     published CSS and theme values
dotnet/
  src/Kajay.Core/             headless C# survey runtime
  tests/                      public, internal, and conformance tests
  samples/                    minimal SDK consumer
  benchmarks/                 performance budgets
contracts/                    generated definition contracts
conformance/                  cross-runtime behavior corpus
docs/                         architecture and product documentation
scripts/                      repository-wide verification tooling
```

## Ownership rules

- `packages/` and `dotnet/src/` contain reusable SDK code only. They do not own
  persistence, HTTP, identity, authorization, workflow, or environment promotion.
- `apps/site` consumes TypeScript packages through public exports. It owns public web
  presentation and interactive examples, not alternative runtime implementations.
- Cross-language claims are proven through `contracts/` and `conformance/`, never by
  maintaining parallel demo APIs.
- Consumer examples stay minimal. A proof requiring production application policy is
  documented as host responsibility instead of becoming a maintained reference product.
- Experimental applications should live outside the main repository or on short-lived
  branches and are removed once their architectural question is answered.

## Change checklist

Before adding a project, answer all four questions:

1. Which durable product responsibility does it own?
2. Why can the responsibility not live in an existing package or `apps/site` feature?
3. Which public contract separates it from adjacent modules?
4. Which verification gate prevents it from becoming stale?

If those answers are temporary or demo-specific, do not add the project to the supported
workspace.

## Decision

The exploratory host demo, dual-runtime APIs, workflow host, promotion CLI, Compose stack,
and their tests were retired after validating their seams. See
[ADR-0045](./docs/adr/0045-focus-repository-on-sdks-and-site.md).

