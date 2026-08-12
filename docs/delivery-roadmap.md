# Delivery Roadmap and Phases

- Area: Phased delivery plan from foundation to full parity
- Status: historical delivery record
- Owner: Jarod
- Last updated: 2026-08-12

This records the delivery phases that produced the published SDKs. It is retained as
history rather than used as the current work queue; current product state lives in
[project context](../CONTEXT.md), and active documentation direction lives in the
[documentation-system guide](./documentation-system-details.md).

**Overall acceptance target: Phase 3 exit** — full Form Library + Creator parity,
proven by named package, browser, and application evidence in the parity checklist.
**Met on 2026-08-04**; see the
Phase 3 exit record below for what that did and did not include. Phase 4 is horizon.

## How to read this

- A **phase** is a milestone with an entry gate (what must be true to start) and an
  exit gate (the acceptance that lets the next phase start). Phases are sequential;
  workstreams inside a phase can run in parallel.
- Each phase lists its **primary docs** and what is **explicitly out** so scope does
  not creep.
- Status vocabulary distinguishes **complete/delivered**, **published**, **active**,
  and **horizon** work.
- The [feature-parity checklist](./feature-parity-checklist.md) is the acceptance
  ledger; phases reference its sections rather than restating features.

## Phase at a glance

| Phase | Goal | Exit gate | Status |
| --- | --- | --- | --- |
| **0 — Foundation** | Monorepo + metadata kernel + one question end-to-end | A JSON definition renders in host-demo via public API only, round-trips, and all CI gates are green | **complete (2026-08-02)** |
| **1 — Runtime core** | Expression engine, core question types, logic, validation, flow | Checklist §A–§E green via host-demo scenarios, less the rows that name later-phase surface | **complete (2026-08-02)** |
| **2 — Form Library parity** | Matrix family, dynamic panels, quiz, theming, localization, a11y | Checklist §A–§J (all Form Library sections) green | **delivered 2026-08-03**, but for A4/A5 (Phase 3) |
| **3 — Creator parity** ⭐ | Drag-drop designer, property grid, logic/JSON/translation/theme editors | Checklist §K–§N green; build→render→round-trip proven in host-demo | **delivered 2026-08-04; 1.0.0 published 2026-08-05** |
| **4 — Horizon** | PDF, dashboard, and other frameworks | Opportunity-driven; each promoted workstream gets its own gate | **`Kajay.Core` 1.0.0 published 2026-08-08; remaining items horizon** |

The phase records below preserve how acceptance was originally reached, including
references to the former `apps/host-demo`. That application was retired after TypeScript
1.0; maintained evidence now lives in package tests, `apps/site` E2E, conformance, and pack
tests under [ADR-0045](./adr/0045-focus-repository-on-sdks-and-site.md).

## Phase 0 — Foundation & scaffolding

**Goal:** a running monorepo skeleton in which every architectural rule is already
mechanically enforced, with one question type flowing end-to-end — ready to grow
features without re-plumbing.

**In scope**

- pnpm workspaces + TypeScript project references per North Star §4/§5: `core`,
  `react`, `creator-core` (stub), `creator-react` (stub), `themes` (stub),
  `apps/host-demo`.
- TS ~6.0 strict configs (`verbatimModuleSyntax`, `erasableSyntaxOnly`,
  `isolatedDeclarations` on published packages); CI type-checks with stable TypeScript
  7 and TypeScript 6 `tsc`.
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

**Except the rows that name surface a later phase builds.** Those cannot go green here
however much Phase 1 work is done, and reading the gate literally would make the
milestone unreachable rather than demanding. Each such row says on its face which phase
closes it, and the exception is exhausted by this list:

| Row | Closes in | Because |
| --- | --- | --- |
| A4, A5 | Phase 3 | Both wait on the Creator's property grid and renderer registration. |
| ~~A7~~ | ~~Phase 2~~ | Closed 2026-08-03, once §F, §G and §H had given those events something to be about. |
| D1 (matrix half) | Phase 2 | `isRequired` on a matrix row needs matrix rows. |
| ~~E3 (correct-answer bar)~~ | ~~Phase 2~~ | Closed 2026-08-03 with E8. |
| ~~E8~~ | ~~Phase 2~~ | Closed 2026-08-03. The clock question is settled below. |

A row on this list is green for Phase 1's purposes when everything *not* naming later
surface is proven and the row states the remainder. Anything else is not.

Prefer a host-demo scenario wherever the feature is observable in the UI; some §B rows
are not. The expression language has no UI surface until `visibleIf` exists, so
requiring a demo scenario for it would make the row unprovable rather than rigorous.
The bar that matters is unchanged: a named test through the public API, never an
assertion in a document.

**Progress (2026-08-02).** **§B is closed** — B2 and B11 landed together, and building
B2 turned up that a host had no way to register *any* expression function through
`parseSurvey`, so both halves of that row are new. §A closed but for A4/A5/A7, which name
Phase 2–3 surface. **§C closed** but for C1's `maskSettings`, which is not built and says so: input masking is a
caret-management problem, and a half-mask that mangles mid-string editing is worse than
none. §D closed but for D1's matrix half. **§E closed but for E3's correct-answer bar and
E8**, both of which now belong to Phase 2: pages and panels, navigation and
`questionsOnPageMode`, the completed page with conditional endings, clear-invisible-value
policies, partial save and resume, read-only mode, preview before completing, the
progress bar and contents list, autofocus and automatic advance are all proven by named
tests. Preview, TOC and read-only were listed as Phase 2 work and landed here instead,
because E4 needed E7 and both were cheaper than deferring them.

**Every §A–§E row is green or on the exception list above.** C1 was the last open
question and is now answered: input masking is **dropped from parity scope**
([ADR-0018](./adr/0018-input-masking-out-of-scope.md)) rather than deferred, so C1 is
green with a named gap on its face.

**Out:** matrix family, dynamic panels, file/signature, quiz mode, theme JSON, and
input masking — which is out of *parity* scope entirely rather than out of this phase
([ADR-0018](./adr/0018-input-masking-out-of-scope.md)).

**Exit gate met on 2026-08-02.** `pnpm run verify` runs all eight gates green: lint
(oxlint, warnings as errors), typecheck under TypeScript 7 **and** 6, architecture
checks, **674 unit tests**, **59 rendering-integration tests** in real Chromium, contract
drift, **63 host E2E parity scenarios**, and the pack test (tarballs installed in a
scratch project outside the workspace, compiled under TypeScript 5.5, 6.0 and 7.0, smoke
scenario run).

Sections **§B, §C, §D and §E are closed**; §A is closed but for A4/A5/A7. Every row that
is not green names its remainder and the phase that owns it, per the table above, and the
one open question left at the end — C1's `maskSettings` — was answered by dropping it
from parity scope rather than by leaving the gate ambiguous
([ADR-0018](./adr/0018-input-masking-out-of-scope.md)).

What the phase actually produced, beyond the row list: an expression language with a
hand-rolled parser and a dependency graph that settles in one pass; sixteen question
types; validation with six built-in validators, three check modes, custom and
asynchronous validators and a server seam; navigation with preview, read-only, partial
save and resume, clear-invisible-value policies, progress and a contents list; and a
reorder interaction built once, as a primitive, for the Creator to extend in Phase 3.

Three habits are worth carrying forward, because each caught something review did not.
**Mutation testing against a checked build** found unreachable guards, a redundant
refocus, and — twice — a test that passed for the wrong reason. **The host-demo as the
proof surface** caught a numeric answer rendering blank, a select with no accessible
name, and an `enableIf` chain I had assumed was a visibility chain. **Instrumenting a
flake rather than retrying it** turned a month-old intermittent failure into a measured
fact in one run.

**Quiz mode (§E8) is Phase 2, decided 2026-08-02.** It was in both lists at once: named
under *Out* here and demanded by an exit gate that asks for §E green. Phase 2 already
owns quiz mode in its own scope list, and E8 is the least load-bearing row in §E — no
other row waits on it — so the gate moves rather than the work. It also needs a decision
Phase 1 has no reason to take: timers put *time* in the model, and core is I/O-free by
rule, so the clock has to be injected or the suite becomes flaky in exactly the way this
project keeps having to fix. That belongs beside Phase 2's other time-adjacent work.

## Phase 2 — Form Library parity

**Goal:** everything a SurveyJS Form Library consumer would miss.

**Progress (2026-08-02).** **§F is closed.** All six rows are green, and the family cost
one design decision rather than six features: **a
column is a question and a cell is an instance of it**, built by a registry-driven copy
and pointed at its slot through the same value-host seam a page question uses. Every
question type therefore works inside a table — its validators, its choices, its renderer,
a host's own replacement for its renderer — without any of them knowing a matrix exists.
Row context (`{row.price}`) is resolved by rewriting the condition into a real path when
the cell is built, so the dependency graph still sees statically what a cell reads.

F4's detail panels needed nothing new: a detail element is a cell drawn under the row
instead of in a column. F5 generalized the rewriting to *every* expression a column
carries, which the registry now declares per property (`isExpression`) rather than the
cell builder remembering a list. F6 is the one row that is genuinely about the DOM: the
library ships no stylesheet, so a responsive "mode" that only added a class name would be
unprovable and unusable, and `auto` resolves against a real media query instead.

Four things outside §F moved as a result. The metadata registry gained a **`json`
property type** (the format is JSON and `defaultRowValue` is an object, which the scalar
`value` type could not hold — §I's theme JSON would have hit the same wall) and an
**`isExpression` flag**, which §M's logic editor will want for the same reason the cell
builder does. And three renderer-wide defects surfaced that had been latent since Phase 1,
each invisible until a question could contain questions: DOM ids built from
`question.name` (which repeats across cells), question values *read* from
`survey.getValue(name)`, and question values *written* the same way.

**F1 landed first** and **D1 closed with it** — the single-select
matrix is the first §F row, and its rows and columns are `itemvalue` collections rather
than a shape of their own, which cost one generalization: conditions on a question's
items are now something each question type declares, not a list of select-question
special cases. Building it surfaced a defect in a row that was already green: a
composite question whose answer was entirely empty reported none of its required parts,
so a required multipletext field said nothing until some other field was filled in. That
is fixed here, with the demo scenario that proves it, because shipping a matrix whose
per-row requiredness works beside a multipletext whose per-field requiredness does not
would have been indefensible.

**Progress (2026-08-03).** **§G is closed.** A repeating panel turned out to be the same
thing as a dynamic matrix seen from a different angle — an answer that is a collection of
records, each holding instances of template questions bound to a local scope — so §F's
machinery was extracted to `RepeatingQuestion` first, in a commit of its own that changed
no behaviour, and §G is what was left over: the drawing, the navigation modes, and
`{panel.q}` as the scope word. G4's nesting is mostly the absence of a restriction, since
a template admits page elements rather than only questions.

`valueName` landed with G3 and is survey-wide: a question's answer key, when it should
differ from its name, so two questions can share an answer while staying two questions.

**§H is closed (2026-08-03).** The file question is the first feature whose whole subject
is a browser API, and it is where the DOM-free rule earned itself: core's idea of a file
is a name, a type, a size and where the content is, the adapter reads the real one, and
the host decides where it goes. Accepted types and size limits are model rules rather
than picker hints, because a respondent can drag a file straight past `accept`.

**§I is closed (2026-08-03).** Theming is one mechanism seen three ways: a stylesheet of
CSS custom properties, a preset that sets them, and a theme object that computes them at
runtime. `@kajay/react` never imports `@kajay/themes` — the architecture check forbids the
direction and it turns out not to need it, which is what lets two surveys on one page be
themed differently. The layout properties and the host's class overrides both land in a
single wrapper around each element, so none of the twenty-odd renderers had to learn a
layout rule.

**In scope**

- Matrix family: matrix (single-select), matrixdropdown, matrixdynamic (add/remove
  rows, per-cell question types, totals, detail panels).
- paneldynamic (repeating groups, templates, navigation modes).
- File upload, signature pad, choices-by-URL, carry-forward choices.
- ~~**Quiz mode: timers, correct answers, scoring, instant feedback (§E8), and the
  correct-answer progress bar (§E3's remaining half)**~~ — **landed 2026-08-03.** The
  clock question the move was made to settle turned out to be half-answered already:
  `LogicEngineOptions.now` existed for the expression engine, and E8 only had to make it
  installable after construction — until then a `now` handed to `parseSurvey` reached
  nothing, so `today()` in a parsed definition always read the machine's real time
  however carefully a test had injected one. The rest of the answer is that **core owns
  no interval**: the model computes what the clocks read and acts when one runs out, and
  the host says when to look. That is what makes a timed survey expressible as
  conformance data rather than as a wait.
- ~~Preview mode, TOC, single-page and question-per-page modes, read-only/display
  mode~~ — all landed in Phase 1 (§E2, §E3, §E4, §E7). E4's preview needed E7's
  read-only, and building both there was cheaper than deferring either.
- Theming: CSS variable system, theme JSON format, `@kajay/themes` presets,
  light/dark; RTL.
- Localization at breadth (locale dictionary infrastructure + seed locales; breadth
  is community-model by design, the mechanism is the parity item).
- Accessibility pass across all question types (ARIA patterns, keyboard nav —
  matrices and drag-based types get explicit attention).

**Entry gate:** Phase 1 exit. **Exit gate:** all Form Library sections of the
checklist (§A–§J) green; host-demo has a demo page per feature area; a11y checks
(axe) pass in browser-integration tests.

**Status, 2026-08-03: the exit gate is met**, with one wording correction recorded
rather than glossed.

§A–§J are green but for **A4 and A5**, which the exception table above assigns to
Phase 3 because both wait on the Creator's property grid. Every other row is closed
with named tests at unit, browser and demo level.

The a11y checks landed in the **E2E** suite rather than the browser one, which is a
deliberate departure from the gate's wording. Contrast is the half of axe most worth
having and it can only be measured against the stylesheet the library actually ships
— and the browser suite deliberately loads none, so that its claims are about
structure rather than pixels. Running axe there would have passed while proving
nothing about colour. It earned the choice immediately: the sweep found the dark
preset's primary button at 2.51:1, which a stylesheet-free check could not have
seen.

## Phase 3 — Creator parity ⭐ (overall acceptance)

**Goal:** the drag-and-drop designer, embeddable like SurveyJS Survey Creator.

**Current state:** the checklist and N5 host-demo exit proof are green. Functional
acceptance is delivered and all five packages are published at 1.0.0 under the policy
recorded in [ADR-0029](./adr/0029-release-walkthrough.md). See the
[project context](../CONTEXT.md).

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

**Exit gate met on 2026-08-04; recorded 2026-08-05.** §K–§N are green and the
end-to-end scenario passes as written: `parity/N5-round-trip` builds a survey in the
Creator covering every type the toolbox offers — derived from the registry rather than
a list, so a type added tomorrow fails the scenario until it is covered — renders it,
answers it, submits, and re-opens the definition in the Creator unchanged. The review
model's second half is `test:pack`, which since N4 installs the tarballs into a scratch
project outside the workspace and drives the Creator from them.

**The phase grew a section it did not start with.** §P — the reference application —
was added on the judgement that checklist-green proves *function* and not *fitness*,
and that a library nobody has built an application with is untested in the way that
matters. It earned its place: twelve rows, and among them a server-rendering defect no
unit test could have found, four cases where the composition story promised something
the public surface could not deliver, duplicate DOM ids across two surveys of one
definition, and the silence ADR-0023 now forbids. None of those were visible from
inside the library.

**§O reviewed at this boundary, as the checklist requires.** Nothing promoted. Every
watch item wanted evidence a real consumer needed it, and at that boundary there were
no consumers because nothing had been published. The review was therefore a formality;
future reviews use the evidence gathered after 1.0.0.

**What the phase did not include.** Publication remained a separate owner action after
the functional exit. That action is now complete under ADR-0029; it does not change the
historical Phase 3 gate or make later native runtimes part of Phase 3.

## Phase 4 — Horizon

Opportunity-driven, on evidence of need: PDF export, dashboard/analytics, Vue and
Angular adapters, SSR/Next integration polish, SurveyJS-JSON import/compat mode,
rich-text authoring, and native runtimes.

The first promoted Phase 4 workstream is the native C# SDK. It begins at the versioned
contract and conformance seam rather than translating TypeScript implementation code.
[ADR-0030](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md) fixes the
`Kajay.Core` package, `net10.0` floor, independent versioning, v2 values/dates/patterns,
performance targets, and support policy. [Checklist §Q](./feature-parity-checklist.md#q--c-headless-sdk)
is its acceptance ledger.

The C# workstream exits only when:

- the TypeScript 2.x and C# adapters pass inherited v1 plus conformance v2;
- every §Q row is green through an installed NuGet package proof;
- the supported OS/runtime matrix, trimming, Native AOT, package validation, API
  compatibility, Source Link, symbols, and benchmark gates pass; and
- C# 1.0 documentation and migration guidance are published.

**Exit gate met on 2026-08-05.** `Kajay.Core` 1.0.0 passes every §Q proof,
the inherited v1 and full v2 conformance corpora, the supported-scale budgets, and the
installed-package consumer. The warning-free build matrix enforces the package gates on
Linux, Windows, and macOS. The package ships the stable public API baseline, README,
changelog, support contract, and first-release migration guidance. The verified
`.nupkg` was published on 2026-08-08 after the separate maintainer action recorded by
[ADR-0046](./adr/0046-nuget-release-walkthrough.md).

The second promoted workstream is the **host-value scope**, fixed by
[ADR-0047](./adr/0047-host-value-scope.md) and tracked as checklist B12. It is promoted
on evidence rather than opportunity: a host supplying computed context has no route
today that does not turn that context into respondent data.

It takes a **row in §B rather than a section of its own**, which is the one place it
departs from the convention below. §Q earned a section because it is a second runtime's
entire ledger; this is one more scope in the expression language, sitting beside the
`{@name}` row it deliberately diverges from, and a one-row section would split the place
a reader looks for expression behaviour. Reopening §B is not the drift the checklist
guards against: the ledger's sections are **capability-shaped, not phase-shaped**, and it
is the phase that closed, not the capability.

The host-value workstream exits only when:

- B12 is green through its named proofs, including the settlement proof — a new kind of
  graph root is the row's actual risk;
- conformance v2 carries adapter-neutral cases for resolution, settlement ordering, and
  canonicalization of `{$name}`, and every maintained adapter passes them;
- `Kajay.Core` carries the same seam under §Q, since a scope one runtime has and the
  other does not is what the corpus exists to prevent; and
- the regenerated contracts — two new definition diagnostic codes — are committed and
  `check:contract` is green.

The remaining Phase 4 items stay horizon. Each promoted item gets its own ADR and
checklist section rather than borrowing the C# workstream's active status.

## Cross-cutting invariants (every phase)

- Every feature exists first in the schema and the metadata registry; contract diff
  reviewed in the same PR.
- Core packages stay DOM-free and UI-free; dependency direction never inverts;
  architecture checks stay required.
- Every functional change lands with the scenario/unit tests that prove it, exercised
  through public APIs; the parity checklist row flips green only via a passing test.
- Definition round-trip (load → serialize) stays lossless; round-trip tests run on
  every fixture in the corpus.
- Language-neutral behavior changes update the versioned conformance corpus, and every
  maintained runtime adapter passes the same cases.
- Tests stay order-independent and parallel-safe; CI stays a single required
  `survey-checks` gate.
- Anything out of a phase's scope stays deferred — no pulling horizon work forward.

## Review model

- **Phases 0–2** close on internal build gates (checklist + CI).
- **Phase 3** closes on the external-consumer proof: the host-demo acceptance
  scenario and the pack test standing in for a real third-party integration. Closed
  2026-08-04. In the event a *third* proof was added — §P's reference application —
  because a tarball that compiles and a scenario that passes both answer "does it
  work" and neither answers "is it any good to build with".
- **Phase 4** is opportunity-driven.

## Open questions

The roadmap-level release and format questions are resolved. Runtime-specific choices
are recorded by the ADR for the workstream that needs them.

- [x] **Round-trip bar** — fixed-point equivalence, not byte stability
      ([ADR-0002](./adr/0002-round-trip-fixed-point.md)).
- [x] **SurveyJS-JSON compatibility** — the question dissolved rather than moving
      phases. The definition format is our own by decision
      ([ADR-0001](./adr/0001-own-definition-format.md)), so there is no compatibility
      to pull forward; an import converter stays Phase 4 and opportunity-driven.
- [x] **TypeScript versioning/release policy** — the single train, 1.0.0 first release,
      Changesets workflow, licensing, and trusted publishing were ratified and used
      ([ADR-0029](./adr/0029-release-walkthrough.md)).
- [x] **C# runtime/package policy** — `Kajay.Core`, `net10.0`, independent package
      versions, conformance v2, performance, and support targets
      ([ADR-0030](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md)).

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
- **Publication remains gated on one external action**: claiming the `kajay` npm
  organization ([ADR-0006](./adr/0006-npm-scope.md)). Phase 0 scaffolding is already
  complete.
- **Phase 1 gains** a generalized, keyboard-operable reorder interaction built with
  the ranking question (C9) rather than ranking-specific drag code, so Phase 3's
  Creator drag-drop extends a proven primitive
  ([ADR-0009](./adr/0009-creator-drag-and-drop.md)).
- **The Phase 2 licensing revisit remains an owner decision**
  ([ADR-0007](./adr/0007-license-and-repo-posture.md)); Phase 2 delivery did not resolve
  it implicitly.

## Parent and related links

- [Project context](../CONTEXT.md)
- [North Star](./NORTH_STAR.md)
- [Architecture remediation plan](./architecture-remediation-plan.md)
- [Library development guidelines](./library-development-guidelines-details.md)
- [Feature-parity checklist](./feature-parity-checklist.md)
- [Architecture decision records](./adr/README.md)
