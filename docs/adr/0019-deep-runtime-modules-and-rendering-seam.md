# ADR-0019 — Deep runtime modules and one page-element rendering seam

- Area: Core runtime and React adapter
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

The Phase 1 implementation had accumulated several shallow modules around otherwise
cohesive behavior. Survey validation, status, and logic each crossed callback bags that
had one producer and one consumer. Dynamic choices were divided between URL/carry-forward
and lazy-paging controllers even though both competed to own the same question. Tree
traversal and host propagation assumed every composite was a `Panel`. React dispatched
questions through a registry but panels and display elements through concrete-class
branches.

Those seams did not isolate independent policy or replaceable implementations. They made
one runtime decision require coordinated edits across more files, and a registered page
element was only partly extensible: metadata could create it while traversal or rendering
could silently omit it.

The package entries also exported several of those implementation mechanisms. Because the
`exports` map is the compatibility promise, helpers such as the dependency graph, async
cache, clearing policies, paging interface, and renderer internals had become consumer
surface without an intended consumer use case.

## Decision

Runtime modules are deepened around observable responsibilities:

- `PageElement` owns answer-host propagation. Tree traversal descends through the standard
  `elements` child collection, so a registered composite participates without a concrete
  class check.
- `SurveyValidation` and `SurveyStatus` depend on the concrete survey model. Their
  single-use callback bags and adapter files are removed.
- `SurveyLogicHost` owns rule refresh and its survey relationship. Rule registration talks
  to that concrete module; only the real outside-world announcement adapter remains.
- `ChoiceSourceController` owns source arbitration, URL fetching, carry-forward derivation,
  lazy paging, configuration, caches, and errors. A select question has exactly one active
  dynamic source.
- React uses `PageElementRendererRegistry` for questions, panels, HTML, images, and custom
  page elements. Registered renderers are mounted as React component types so hooks retain
  stable scope as page visibility changes.
- Package entries expose consumer operations and intentional extension seams — including
  the reusable reorder primitives reserved for Creator — not internal algorithms or
  presentational building blocks. Internal unit proofs may import package-local source
  modules directly; cross-package, browser, E2E, and host consumers use package entries.

## Consequences

- Adding a composite page element or renderer is local to its metadata/model definition and
  registry registration; survey-wide traversal and React dispatch need no new branch.
- Validation, status, logic, and choice changes have fewer translation layers and fewer
  partially configurable states.
- `@kajay/core` and `@kajay/react` have smaller compatibility surfaces. This is a breaking
  pre-1.0 cleanup; removed symbols were not documented consumer capabilities.
- The host-owned I/O seams remain injected. Core still has no DOM, network access, or runtime
  dependencies, and endpoint origins remain host-controlled under ADR-0017.
- Custom question rendering is browser-proven by
  `parity/A4-custom-question-renderer`; A4 remains partial until the Creator property grid
  is built.

## Amendment (2026-08-04) — an extension point exports what its own implementations use

**Found by auditing the public surface after three separate hosts hit the same wall.**

The seam above was public from the day it shipped. What was not public was most of what a
renderer actually needs: of the eight modules every built-in question renderer imports,
**four were private** — `questionId`, `useIdScope`, `QuestionErrors` and
`QuestionTitleContent`. A host could register a renderer and could not give its input an
id the label agreed with, could not draw the title block, and could not render the errors
D5 validates into.

The reason nothing noticed is instructive: A4's proof of this seam draws a bare
`<button>`. It proved a custom type reaches the registry, which is real, and it exercised
none of the furniture — so the gap was invisible to the one test whose job was to look at
it.

**The rule this establishes.** When a seam is declared, its public surface must include
everything the library's own implementations of that seam use. The test is mechanical and
worth running: list what the built-in implementation imports, and check each against the
entry point. Anything private is either a deliberate exclusion with a reason, or a gap.

This was the fourth finding of one shape in one week — the `Menu` primitive, the missing
panels in the reference application, `useSurfaceVersion`, and now this. All four came from
the same cause: **the public surface was drawn from what the default assembly needed**, and
the default assembly is a privileged consumer that imports whatever it likes. A host is
not. See §P9 for the audit, and ADR-0021, whose composition claim has the same exposure
and was checked at the same time — the Creator's property-editor seam passed, with two
specialised sub-editors noted as deliberate exclusions.
