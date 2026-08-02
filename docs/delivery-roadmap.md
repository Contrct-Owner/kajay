# Delivery Roadmap and Phases

- Area: Phased delivery plan from foundation to full parity
- Status: proposed
- Owner: Jarod
- Last updated: 2026-08-02

This is the single index that sequences the work into **delivery phases** with explicit
entry and exit gates, so work has an order and each milestone has a definition of done.
It does not restate the designs; it points at the docs that specify each phase's work.

**Overall acceptance target: Phase 3 exit** — full Form Library + Creator parity,
proven by the host application and the parity checklist. Phase 4 is horizon.

## How to read this

- A **phase** is a milestone with an entry gate (what must be true to start) and an
  exit gate (the acceptance that lets the next phase start). Phases are sequential;
  workstreams inside a phase can run in parallel.
- Each phase lists its **primary docs** and what is **explicitly out** so scope does
  not creep.
- Status vocabulary: **Established / Proposed / Open.**
- The [feature-parity checklist](./feature-parity-checklist.md) is the acceptance
  ledger; phases reference its sections rather than restating features.

## Phase at a glance

| Phase | Goal | Exit gate | Status |
| --- | --- | --- | --- |
| **0 — Foundation** | Monorepo + metadata kernel + one question end-to-end | A JSON definition renders in host-demo via public API only, round-trips, and all CI gates are green | **complete (2026-08-02)** |
| **1 — Runtime core** | Expression engine, core question types, logic, validation, flow | Checklist §A–§E green via host-demo scenarios | proposed |
| **2 — Form Library parity** | Matrix family, dynamic panels, quiz, theming, localization, a11y | Checklist §A–§J (all Form Library sections) green | proposed |
| **3 — Creator parity** ⭐ | Drag-drop designer, property grid, logic/JSON/translation/theme editors | Checklist §K–§N green; build→render→round-trip proven in host-demo | proposed (overall AC) |
| **4 — Horizon** | PDF, dashboard, other frameworks, SSR | Opportunity-driven | horizon |

## Phase 0 — Foundation & scaffolding

**Goal:** a running monorepo skeleton in which every architectural rule is already
mechanically enforced, with one question type flowing end-to-end — ready to grow
features without re-plumbing.

**In scope**

- pnpm workspaces + TypeScript project references per North Star §4/§5: `core`,
  `react`, `creator-core` (stub), `creator-react` (stub), `themes` (stub),
  `apps/host-demo`.
- TS ~6.0 strict configs (`verbatimModuleSyntax`, `erasableSyntaxOnly`,
  `isolatedDeclarations` on published packages); CI type-checks with tsc **and** tsgo.
- **Metadata registry + serializer kernel**: class registration, property
  descriptors, JSON round-trip — proven with `text` question, page, and survey.
- **Contract pipeline**: `contracts/survey-schema.json` generated from the registry,
  committed, drift-checked in CI.
- **Architecture checks** (fail the build): dependency direction, no DOM/UI imports
  in core packages, no deep imports, public-exports-only in host-demo.
- CI jobs: lint/typecheck, architecture, unit, browser integration, host E2E,
  contract drift, **pack test** (tarball install in a scratch project) — funneled
  into the single `survey-checks` gate.
- host-demo shell (Vite + React 19) rendering a one-question survey through
  `@kajay/react`, with value change, completion, and JSON round-trip.

**Entry gate:** North Star, this roadmap, development guidelines, and parity
checklist accepted.

**Exit gate:** the one-question survey renders in host-demo through public package
APIs only; definition → model → definition round-trips byte-stably; contract file
regenerates without drift; architecture, unit, browser, E2E, and pack-test jobs all
pass in CI; warnings-as-errors everywhere.

**Primary docs:** North Star §4/§5/§8;
[library development guidelines](./library-development-guidelines-details.md).

**Out:** every additional question type; the expression engine; any Creator UI.

**Exit gate met on 2026-08-02.** `npm run verify` runs all eight gates green: lint
(oxlint, warnings as errors), typecheck under TypeScript 7 **and** 6, architecture
checks, 52 unit tests, 7 rendering-integration tests in real Chromium, contract drift,
6 host E2E parity scenarios, and the pack test (tarballs installed in a scratch project
outside the workspace, compiled under both compilers, smoke scenario run).

Checklist rows closed: **A1, A2, A3, A6**. A4, A5 and A7 are explicitly partial — the
parts they name that belong to later phases are recorded in their Proof column rather
than being quietly counted.

## Phase 1 — Runtime core

**Goal:** the engine that everything else stands on — the expression language and the
core question set with full logic, validation, and flow.

**In scope**

- **Expression engine** (tokenizer/parser/AST/evaluator, function library, custom +
  async functions, dependency graph with cycle detection) — ADR for grammar choice
  first.
- Core question types: text (all input types), comment, radiogroup, checkbox,
  dropdown (incl. lazy load + search), tagbox, boolean, rating, ranking, imagepicker,
  multipletext, html, expression, image.
- Panels, pages, visibility/enable/require logic, `setValueIf`/`resetValueIf`,
  calculated values, triggers, default values from expressions.
- **Deployment variable scope** (`{@name}`, checklist B11): a definition promotes
  across environments unedited, and a multi-origin definition resolves each origin
  from host-supplied endpoints ([ADR-0017](./adr/0017-choices-url-environment-portability.md)).
  Sequenced after §E — it is small and self-contained, and it belongs in Phase 1
  because §B going green is a Phase 1 exit gate.
- Validation: built-in validators, expression validators, custom + async, error
  placement; navigation: progress, page logic, completed pages, `data`+page
  save/resume seam.
- Localizable strings on every user-facing property; UI string dictionary mechanism
  with `en` shipped.
- Typed event surface (`onValueChanged`, `onComplete`, `onCurrentPageChanged`,
  `onValidateQuestion`, ...).

**Entry gate:** Phase 0 exit. **Exit gate:** parity checklist sections §A–§E green,
each item proven by a passing named test of the kind the
[checklist header](./feature-parity-checklist.md) permits — a host-demo scenario, a
rendering-integration test, or a unit suite exercised through public APIs.

Prefer a host-demo scenario wherever the feature is observable in the UI; some §B rows
are not. The expression language has no UI surface until `visibleIf` exists, so
requiring a demo scenario for it would make the row unprovable rather than rigorous.
The bar that matters is unchanged: a named test through the public API, never an
assertion in a document.

**Progress (2026-08-02).** §A closed but for A4/A5/A7, which name Phase 2–3 surface.
§B closed but for B2 (async function registration) and B6 (needs `completedHtml`), with
B11 newly scheduled. §C partial: C5/C6 lack lazy paging, and C7–C12 are not started.
§D closed but for D1's matrix half: six built-in validators, three `checkErrorsMode`
policies, error placement, the `validationEnabled` toggle, focus-to-first-error,
host-registered async validators and the server seam. D1 is closed for every question
type that exists; matrix rows are §F. §E1 and §E2 closed — panels nest, collapse and carry their own
`visibleIf`/`enableIf`; navigation counts visible pages and `questionsOnPageMode`
reshapes what the respondent walks through without touching the definition. That closed
B3 and made B7's `skip` observable for the first time. E3–E10 remain.

**Out:** matrix family, dynamic panels, file/signature, quiz mode, theme JSON.

## Phase 2 — Form Library parity

**Goal:** everything a SurveyJS Form Library consumer would miss.

**In scope**

- Matrix family: matrix (single-select), matrixdropdown, matrixdynamic (add/remove
  rows, per-cell question types, totals, detail panels).
- paneldynamic (repeating groups, templates, navigation modes).
- File upload, signature pad, choices-by-URL, carry-forward choices.
- Quiz mode: timers, correct answers, scoring, instant feedback.
- Preview mode, TOC, single-page and question-per-page modes, read-only/display mode.
- Theming: CSS variable system, theme JSON format, `@kajay/themes` presets,
  light/dark; RTL.
- Localization at breadth (locale dictionary infrastructure + seed locales; breadth
  is community-model by design, the mechanism is the parity item).
- Accessibility pass across all question types (ARIA patterns, keyboard nav —
  matrices and drag-based types get explicit attention).

**Entry gate:** Phase 1 exit. **Exit gate:** all Form Library sections of the
checklist (§A–§J) green; host-demo has a demo page per feature area; a11y checks
(axe) pass in browser-integration tests.

**Out:** all Creator work.

## Phase 3 — Creator parity ⭐ (overall acceptance)

**Goal:** the drag-and-drop designer, embeddable like SurveyJS Survey Creator.

**In scope**

- `creator-core`: design-surface tree + selection model, toolbox model, drag-drop
  model (ADR for implementation), **property grid generated from the metadata
  registry**, undo/redo command stack, copy/paste, page management.
- Visual logic editor (expression AST ↔ builder UI), embedded JSON editor with
  two-way sync and error surfacing, translation editor, theme editor, preview tab
  (reusing `@kajay/react`).
- `creator-react` UI over all of the above; creator theming/white-labeling seam.

**Entry gate:** Phase 2 exit. **Exit gate:** checklist §K–§N green, and the
end-to-end acceptance scenario passes: **in host-demo, build a survey in the Creator
covering every question type, render it with the renderer, submit responses, and
verify the definition round-trips and re-loads into the Creator losslessly.**

**Out:** Phase 4 items.

## Phase 4 — Horizon

Opportunity-driven, on evidence of need: PDF export, dashboard/analytics, Vue and
Angular adapters, SSR/Next integration polish, SurveyJS-JSON import/compat mode,
rich-text authoring. Each starts with its own ADR and checklist section.

## Cross-cutting invariants (every phase)

- Every feature exists first in the schema and the metadata registry; contract diff
  reviewed in the same PR.
- Core packages stay DOM-free and UI-free; dependency direction never inverts;
  architecture checks stay required.
- Every functional change lands with the scenario/unit tests that prove it, exercised
  through public APIs; the parity checklist row flips green only via a passing test.
- Definition round-trip (load → serialize) stays lossless; round-trip tests run on
  every fixture in the corpus.
- Tests stay order-independent and parallel-safe; CI stays a single required
  `survey-checks` gate.
- Anything out of a phase's scope stays deferred — no pulling horizon work forward.

## Review model

- **Phases 0–2** close on internal build gates (checklist + CI).
- **Phase 3** closes on the external-consumer proof: the host-demo acceptance
  scenario and the pack test standing in for a real third-party integration.
- **Phase 4** is opportunity-driven.

## Open questions

All three roadmap-level open questions were resolved on 2026-08-02.

- [x] **Round-trip bar** — fixed-point equivalence, not byte stability
      ([ADR-0002](./adr/0002-round-trip-fixed-point.md)).
- [x] **SurveyJS-JSON compatibility** — the question dissolved rather than moving
      phases. The definition format is our own by decision
      ([ADR-0001](./adr/0001-own-definition-format.md)), so there is no compatibility
      to pull forward; an import converter stays Phase 4 and opportunity-driven.
- [x] **Versioning/release policy** — single version train with changesets, `1.0.0`
      cut at Phase 3 exit ([ADR-0005](./adr/0005-single-version-train.md)).

Remaining open items now live in [North Star §11](./NORTH_STAR.md#11-decisions).

## Phase-scope amendments from the 2026-08-02 decisions

- **Phase 0 gains** deliberate definition-format design (ADR-0001 conventions), a
  diagnostics channel for unknown properties (ADR-0002 and ADR-0011), a
  single-entry-`exports` architecture check plus pack-test coverage of a themes CSS
  subpath ([ADR-0010](./adr/0010-package-manifest-and-distribution.md)), and
  `schemaVersion` handling in the parser
  ([ADR-0011](./adr/0011-contract-identity-and-format-version.md)).
  The parity checklist's SurveyJS property names are now illustrative rather than
  normative, and are restated per-PR as registry properties are declared — not as a
  standalone Phase 0 task.
- **Phase 0 is gated on one external action**: claiming the `kajay` npm organization
  ([ADR-0006](./adr/0006-npm-scope.md)).
- **Phase 1 gains** a generalized, keyboard-operable reorder interaction built with
  the ranking question (C9) rather than ranking-specific drag code, so Phase 3's
  Creator drag-drop extends a proven primitive
  ([ADR-0009](./adr/0009-creator-drag-and-drop.md)).
- **Phase 2 exit gains** a licensing revisit
  ([ADR-0007](./adr/0007-license-and-repo-posture.md)).

## Parent and related links

- [North Star](./NORTH_STAR.md)
- [Library development guidelines](./library-development-guidelines-details.md)
- [Feature-parity checklist](./feature-parity-checklist.md)
- [Architecture decision records](./adr/README.md)
