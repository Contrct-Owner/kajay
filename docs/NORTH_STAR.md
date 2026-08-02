# Survey Engine — North Star

- Area: Product vision, architecture, and guiding principles
- Status: proposed
- Owner: Jarod
- Last updated: 2026-08-02

---

## 1. Vision

A **TypeScript-native, embeddable survey engine** with feature parity with the SurveyJS
product family's two embeddable libraries: the **Form Library** (JSON-driven survey
runtime + renderer) and the **Survey Creator** (drag-and-drop designer). Both ship as
npm packages that other applications consume exactly the way applications consume
SurveyJS today: install, import, mount, and feed JSON.

The acceptance criterion for the whole effort is external: **a separate host
application, consuming the packages strictly through their published public API, can
build a survey in the Creator, render it with the renderer, collect and validate
responses, and round-trip the JSON definition — covering the full parity checklist.**

Dashboard (analytics) and PDF export are explicitly horizon scope, not part of the
parity target (see §10 and the [delivery roadmap](./delivery-roadmap.md)).

---

## 2. Guiding principles

Adapted from the Kajay corpus; the principles carry over even though the artifact is a
library, not a service.

1. **Parity against evidence, not imagination.** The feature target is the
   [feature-parity checklist](./feature-parity-checklist.md), derived from SurveyJS's
   actual documented surface — not a speculative superset. Anything SurveyJS does not
   do is out of scope until a real consumer needs it. The failure mode being avoided
   is the platform-abstraction trap: an ever-more-general engine that never proves
   itself in a host application.
2. **The schema is authoritative.** The JSON survey definition is the system of
   record. Every capability — question types, properties, logic, validation,
   localization — exists first as declarative schema, and the runtime and Creator are
   both views over it. If a feature cannot be expressed in the serialized definition,
   it is not done.
3. **The metadata registry is the load-bearing wall.** Every question type is
   registered with typed property metadata (name, type, default, serialization rules,
   category, visibility conditions). The serializer, the JSON Schema contract, the
   property grid, the localizer, and the validators all *introspect* that registry
   rather than hard-coding per-type knowledge. This is the single decision that makes
   the Creator buildable and third-party question types possible.
4. **Headless core, framework adapters.** `core` and `creator-core` are pure
   TypeScript with zero DOM and zero framework dependencies. React is the first
   adapter, not the foundation. Vue/Angular adapters are horizon scope but must stay
   *possible*, which the DOM-free core guarantees.
5. **Enforce boundaries with the compiler and the build.** Package boundaries are
   expressed as TypeScript project references and `package.json` `exports` maps, and
   verified by architecture checks that fail the build: core packages may not import
   UI packages, no package may deep-import another's internals, and the host app may
   import only public entry points.
6. **Boring, durable, solo-operable.** npm workspaces, tsc for emit, Vite for apps,
   Vitest for tests, oxlint for linting. Mature tools, low operational surface; one
   person must be able to run and reason about the whole repo.
7. **Surface conflicts; never silently weaken a rule.** If a request or a feature
   conflicts with these principles, raise the conflict explicitly rather than quietly
   bending the rule.

---

## 3. Product surface — what "parity" covers

Two embeddable products, mirroring how SurveyJS packages itself:

| Product | SurveyJS analogue | Our packages |
| --- | --- | --- |
| Form Library | `survey-core` + `survey-react-ui` | `@kajay/core` + `@kajay/react` |
| Survey Creator | `survey-creator-core` + `survey-creator-react` | `@kajay/creator-core` + `@kajay/creator-react` |

*(Scope `@kajay/*` per [ADR-0006](./adr/0006-npm-scope.md); the org claim is the one
remaining gate.)*

Feature scope per product is enumerated exhaustively in the
[feature-parity checklist](./feature-parity-checklist.md), which is the authoritative
acceptance document. Headlines:

- **Form Library:** 20+ question types including the matrix family and dynamic
  panels; the expression language powering `visibleIf` / `enableIf` / `requiredIf` /
  `setValueIf` / calculated values; triggers; validation (sync, async,
  expression-based); pages, panels, navigation, progress, preview and quiz modes;
  partial-response save/resume; localization (per-string locale objects + UI strings,
  RTL); theming via CSS variables + theme JSON; accessibility; read-only display mode.
- **Survey Creator:** toolbox with drag-and-drop onto a live design surface; property
  grid generated from the metadata registry; visual logic editor; embedded two-way
  JSON editor; translation editor; theme editor; undo/redo; copy/paste; preview.

---

## 4. Architecture — the package graph

```
packages/
  core/            @kajay/core          headless survey model + expression engine
  react/           @kajay/react         React renderer over core
  creator-core/    @kajay/creator-core  headless designer model over core
  creator-react/   @kajay/creator-react React designer UI over creator-core + react
  themes/          @kajay/themes        theme JSON presets + CSS variable stylesheets
apps/
  host-demo/       (private)             the proof application — consumes the above
                                         strictly via public package APIs
docs/                                    this corpus
```

Dependency direction is one-way and enforced:

```
core ← react
core ← creator-core ← creator-react (also ← react)
themes ← (consumed by apps; no package depends on themes)
apps/host-demo ← published surface of all packages only
```

### 4.1 `@kajay/core` internals

- **Metadata registry** (`Serializer`-equivalent): class registration, typed property
  descriptors, inheritance, custom-property injection, JSON (de)serialization driven
  entirely by metadata.
- **Survey model:** question/panel/page object model, value store, data binding,
  dynamic add/remove (matrix-dynamic rows, panel-dynamic instances).
- **Expression engine:** tokenizer → parser → AST → evaluator; operator set and
  function library matching SurveyJS's expression language; custom + async function
  registration; a **dependency graph** so a value change re-evaluates only dependent
  expressions, with cycle detection.
- **Logic:** `visibleIf` / `enableIf` / `requiredIf` / `setValueIf` /
  `resetValueIf`, calculated values, triggers, carry-forward choices,
  `choicesByUrl`-equivalent REST choice loading.
- **Validation:** built-in validators, expression validators, custom and async
  validators, error placement, `onValidate*` event seams for server-side validation.
- **Navigation/flow:** page visibility, progress, preview mode, quiz mode (timer,
  correct answers, scoring), completed/loading states, partial state
  serialization (`data` + current page) for save/resume.
- **Localization:** localizable-string type (`{ default, fr, ... }`) on every
  user-facing property (driven by the metadata registry), UI string dictionaries,
  RTL flag.
- **Events:** typed event bus (`onValueChanged`, `onComplete`, ...) mirroring the
  SurveyJS event surface the renderer and hosts program against.

### 4.2 `@kajay/react`

Thin, replaceable view layer: one component per question type mapped through a
registry (so custom question types can register custom renderers), controlled
entirely by core model state and events. No survey logic in components — the
renderer must stay portable to other frameworks by construction.

### 4.3 `@kajay/creator-core` and `@kajay/creator-react`

`creator-core` holds all designer state and behavior headlessly: toolbox model,
design-surface tree, selection, drag-drop model, property-grid view-model *generated
from the metadata registry*, logic-editor model (expression AST ↔ UI), undo/redo
(command stack over serialized patches), translation and theme editor models, and
two-way JSON sync. `creator-react` renders it. The same "thin view" rule applies.

### 4.4 The contract

`contracts/survey-schema.json` is a **committed JSON Schema** generated from the
metadata registry (analogous to Kajay's committed OpenAPI document). Any change to
the registry shows up as a reviewable contract diff in the same PR, and a CI check
fails on drift. The schema doubles as public documentation of the definition format
and as the validation target for definitions authored outside the Creator.

---

## 5. Tech stack

- **Consumer compatibility:** published packages compile for consumers on
  **TypeScript ≥ 5.5** and **Node ≥ 22.12**, both tested rather than asserted
  ([ADR-0014](./adr/0014-supported-typescript-range.md),
  [ADR-0010](./adr/0010-package-manifest-and-distribution.md)). This is a separate
  contract from the compiler this repo builds with.
- **Language:** TypeScript ~6.0 (strict), ESM-only. Compiler settings chosen to be
  **TypeScript 7 (tsgo)-clean**: `verbatimModuleSyntax`, `erasableSyntaxOnly`,
  `isolatedDeclarations` on published packages, no `namespace`/`enum`/parameter
  properties, no deprecated compiler options. CI type-checks with **both** `tsc` and
  `tsgo` so the repo rides the 6 → 7 transition without a migration event.
- **Monorepo:** npm workspaces + TypeScript project references (`tsc -b`). No extra
  orchestrator until the build provably needs one (boring & solo-operable).
- **Emit:** `tsc` emits ESM `.js` + `.d.ts` per package; `exports` maps define the
  public surface; no bundler for libraries. Apps use **Vite 8**.
- **UI:** React 19 for `@kajay/react` and `@kajay/creator-react` (peer
  dependency). Styling via plain CSS with CSS variables — published packages impose
  **no CSS framework** on hosts; Tailwind is allowed only inside `apps/host-demo`.
- **Testing:** **Vitest** for pure-logic unit tests; **Vitest browser mode
  (Playwright/Chromium)** for rendering-integration tests against a real DOM;
  Playwright E2E for the host-demo parity scenarios.
- **Lint:** oxlint. **Warnings are errors** everywhere.
- **CI:** GitHub Actions; separate jobs (lint/typecheck, architecture checks, unit,
  browser integration, host-app E2E, contract drift, pack test) funneled into a
  single `survey-checks` gate job for branch protection — adding a job never means
  editing the protected-checks list.

---

## 6. Multi-framework strategy

React first; the core packages are the product, the renderer is an adapter. The rule
that keeps other frameworks possible is mechanical, not aspirational: **core and
creator-core must never import from a UI package or touch the DOM**, and the
architecture checks fail the build if they do. A Vue or Angular adapter (horizon)
would be a new `packages/vue` peer of `react`, not a refactor.

---

## 7. Extensibility model

Mirrors SurveyJS's proven seams, all flowing from the metadata registry:

- **Custom question types:** register a model class + metadata; the serializer,
  schema contract, property grid, and toolbox pick it up automatically; register a
  renderer component per adapter.
- **Custom properties** on existing types (the `addProperty` pattern).
- **Custom expression functions** (sync and async).
- **Custom validators.**
- **Theming:** theme JSON (CSS variable sets + a few structural options) applied at
  runtime; hosts may also just override CSS variables.

---

## 8. The proof application (`apps/host-demo`)

The host app exists to make embeddability falsifiable:

- It consumes packages **only** through their public `exports` — deep imports are
  build errors.
- CI additionally runs a **pack test**: `npm pack` each package, install the
  tarballs into a scratch project outside the workspace, compile and run a smoke
  scenario. This simulates a true third-party consumer — the same artifact a real
  host would install — rather than trusting workspace symlinks.
- Every parity-checklist item maps to at least one executable scenario in the host
  app (a demo page + a Playwright test). The checklist is "green" only through
  passing scenarios, never by assertion.

---

## 9. What this project is *not*

- Not a survey **service**: no backend, no response storage, no hosting — like
  SurveyJS, backend-agnostic by design. The host app persists to localStorage/JSON
  files purely to demonstrate the save/resume seams.
- Not a no-code application builder. The Creator edits survey definitions, nothing
  more general.
- Not a component library. UI pieces exist to render surveys, not for standalone
  reuse.

---

## 10. Explicitly deferred (not building now)

- PDF generation, Dashboard/analytics (SurveyJS sells these as separate products;
  they are separate efforts here too).
- Vue/Angular adapters; SSR/Next-specific adapter work.
- SurveyJS 2026-roadmap items that are *their* horizon, not shipped parity surface
  (grid layout engine, data-grid question, AI theme generation, rich-text authoring).
  Tracked in the checklist as "watch" items, not acceptance items.
- A plugin marketplace / runtime plugin loading.

---

## 11. Decisions

### Resolved (2026-08-02)

- [x] **Definition format is our own**, not SurveyJS-compatible; a converter is
      Phase 4 and opportunity-driven — [ADR-0001](./adr/0001-own-definition-format.md).
      Consequence: checklist property names are illustrative of capability, not
      normative, and a checklist vocabulary pass is Phase 0 work.
- [x] **Round-trip bar is fixed-point equivalence**, not byte stability —
      [ADR-0002](./adr/0002-round-trip-fixed-point.md).
- [x] **Expression grammar is hand-rolled** (tokenizer + Pratt parser + printer),
      zero-dep — [ADR-0003](./adr/0003-hand-rolled-expression-parser.md).
- [x] **Core reactivity is an explicit dependency graph**, no signals library —
      [ADR-0004](./adr/0004-explicit-dependency-graph.md).
- [x] **Single version train** released with changesets; `1.0.0` at Phase 3 exit —
      [ADR-0005](./adr/0005-single-version-train.md).
- [x] **npm scope `@kajay/*`**, conditional on claiming the org —
      [ADR-0006](./adr/0006-npm-scope.md) (status: proposed until the claim succeeds).
      `@survey/*` was abandoned: the `survey` org is already taken on npm.
- [x] **Private repo, unlicensed**, revisit at Phase 2 exit —
      [ADR-0007](./adr/0007-license-and-repo-posture.md).
- [x] **No SurveyJS theme-JSON import**; own token namespace —
      [ADR-0008](./adr/0008-no-surveyjs-theme-import.md).
- [x] **Creator drag-and-drop deferred** to Phase 3 with three binding constraints —
      [ADR-0009](./adr/0009-creator-drag-and-drop.md).

### Resolved (2026-08-02, second pass)

- [x] **Node floor `>=22.12.0`**, CI on 22 and 24; single root `exports` entry per
      package; CSS imported explicitly by hosts from `@kajay/themes` subpaths, never
      injected — [ADR-0010](./adr/0010-package-manifest-and-distribution.md).
- [x] **Contract carries `$schema` 2020-12 and a stable URN `$id`**; the definition
      carries an optional `schemaVersion` and the parser refuses unknown versions
      rather than best-effort parsing —
      [ADR-0011](./adr/0011-contract-identity-and-format-version.md).
- [x] **Checklist vocabulary migrates incrementally**, not in a big-bang rename: rows
      are restated in the PR that declares the corresponding registry property —
      [ADR-0001](./adr/0001-own-definition-format.md#checklist-vocabulary-migration-decided-2026-08-02).

### Still open

- [ ] Claim the `kajay` npm organization; promote ADR-0006 to accepted or pick a
      replacement scope *before* Phase 0 scaffolding. This is the only decision
      gating Phase 0.
- [ ] Confirm that housing a survey engine under `@kajay/*` is the intended umbrella
      branding rather than an artifact of scope availability
      ([ADR-0006](./adr/0006-npm-scope.md)).

---

## 12. Decision log

| Date | Decision |
| --- | --- |
| 2026-08-02 | Corpus created. Framework-agnostic core + React-first adapters; parity scope = Form Library + Creator; proof = in-repo host app consuming public APIs + CI pack test; TS 6 strict with tsgo dual-check. |
| 2026-08-02 | **Phase 0 complete.** Monorepo, metadata kernel, serializer, React renderer, host-demo, enforcement scripts and CI all landed; `npm run verify` runs eight gates green. Two toolchain amendments were forced by reality: TypeScript 7 has shipped, so `tsgo`/`@typescript/native-preview` is superseded by real `typescript@7` (ADR-0012), and the oxlint baseline had to disable `unicorn/prefer-event-target` because it recommends a DOM global into a DOM-free package (ADR-0013). |
| 2026-08-02 | Second pass: the `survey` npm org proved taken, so the scope became **`@kajay/*`** and the corpus was renamed (ADR-0006). Remaining Phase-0 decisions closed as ADR-0010 (Node ≥22.12, single-entry `exports`, host-imported CSS) and ADR-0011 (URN `$id`, `schemaVersion` on the definition, refuse-don't-guess on version mismatch). Checklist vocabulary migrates per-PR rather than in one pass. Only the org claim still gates Phase 0. |
| 2026-08-02 | All nine §11 open decisions worked through; ADRs 0001–0009 recorded. Headline: the definition format is **our own** rather than SurveyJS-compatible, which moves parity evidence from executable (running their JSON) to capability-level (against their documentation) and makes deliberate format design Phase 0 work. Round-trip bar set at fixed-point equivalence. Expression parser and reactivity both hand-rolled and zero-dep. Single version train. Repo stays private and unlicensed until Phase 2 exit. |
