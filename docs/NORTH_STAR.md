# Survey Engine — North Star

- Area: Product vision, architecture, and guiding principles
- Status: active
- Owner: Jarod
- Last updated: 2026-08-06

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
6. **Boring, durable, solo-operable.** pnpm workspaces, tsc for emit, Vite for apps,
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

The same generator emits language-neutral registry metadata and diagnostic catalogs.
Observable runtime behavior that JSON Schema cannot express — canonicalization,
expressions, value semantics, lifecycle states, and event order — is versioned as an
executable JSON corpus under `conformance/`
([ADR-0020](./adr/0020-versioned-cross-language-runtime-contract.md)).

---

## 5. Tech stack

- **Consumer compatibility:** published packages compile for consumers on
  **TypeScript ≥ 5.5** and **Node ≥ 22.12**, both tested rather than asserted
  ([ADR-0014](./adr/0014-supported-typescript-range.md),
  [ADR-0010](./adr/0010-package-manifest-and-distribution.md)). This is a separate
  contract from the compiler this repo builds with.
- **Language:** TypeScript ~6.0 (strict), ESM-only. Compiler settings chosen to be
  **TypeScript 7-clean**: `verbatimModuleSyntax`, `erasableSyntaxOnly`,
  `isolatedDeclarations` on published packages, no `namespace`/`enum`/parameter
  properties, no deprecated compiler options. CI runs the stable TypeScript 7 compiler
  first and TypeScript 6 `tsc` last for emit, so both must accept identical source.
- **Monorepo:** pnpm workspaces + TypeScript project references (`tsc -b`), with a
  pnpm **catalog** pinning shared versions once for the whole workspace
  ([ADR-0015](./adr/0015-pnpm-workspace.md)). pnpm is pinned via `packageManager` and
  supplied by corepack. Still no build orchestrator until the build provably needs one.
  Consumers are unaffected: packages are published for npm and the pack test installs
  them with it.
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
  browser integration, host-app E2E, contract drift, cross-language conformance, pack test) funneled into a
  single `survey-checks` gate job for branch protection — adding a job never means
  editing the protected-checks list.

---

## 6. Multi-framework and multi-runtime strategy

React first; the core packages are the product, the renderer is an adapter. The rule
that keeps other frameworks possible is mechanical, not aspirational: **core and
creator-core must never import from a UI package or touch the DOM**, and the
architecture checks fail the build if they do. A Vue or Angular adapter (horizon)
would be a new `packages/vue` peer of `react`, not a refactor.

The same definition format may be implemented natively in another language. Shape is
shared through the generated JSON Schema and runtime metadata; behavior is shared
through the versioned corpus under `conformance/`. TypeScript is the first runtime
adapter, not the specification by accident. A C# implementation would reproduce the
headless core behind that seam and prove compatibility by running the same cases
([ADR-0020](./adr/0020-versioned-cross-language-runtime-contract.md)). This does not
turn the core into a network service; an HTTP/RPC deployment remains a separate design.
Today only the TypeScript adapter exists, so the corpus is an executable portability
contract, not yet evidence that two runtimes are compatible.

The second maintained runtime is now decided: one native NuGet package,
`Kajay.Core`, targeting `net10.0` and implementing the headless runtime rather than a
transport or JavaScript host. Its package versions independently and declares the
schema and conformance versions it supports. Conformance v2 replaces host-language
coercion, dates, rounding, and regex behavior with Kajay-owned value and pattern
semantics before either v2 adapter implements them
([ADR-0030](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md)).

---

## 7. Extensibility model

Mirrors SurveyJS's proven seams, all flowing from the metadata registry:

- **Custom question types:** register a model class + metadata; the serializer,
  schema contract, property grid, and toolbox pick it up automatically; register a
  renderer component per adapter.
- **Custom properties** on existing types (the `addProperty` pattern).
- **Published values are intentional.** Consumer operations, extension seams, and
  maintained adapter requirements are recorded in the
  [public package interface ledger](./public-package-interfaces.md); package-local
  algorithms are not promoted merely to make their tests convenient.
- **Custom expression functions** (sync and async).
- **Custom validators.**
- **Theming:** theme JSON (CSS variable sets + a few structural options) applied at
  runtime; hosts may also just override CSS variables.

---

## 8. The proof application (`apps/host-demo`)

The host app exists to make embeddability falsifiable:

- It consumes packages **only** through their public `exports` — deep imports are
  build errors.
- CI additionally runs a **pack test**: `pnpm pack` each package, install the
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
- [x] **Working package scope is `@kajay/*`**, conditional on claiming the org —
      [ADR-0006](./adr/0006-npm-scope.md). The ADR remains proposed and publication
      remains blocked until the claim succeeds.
      `@survey/*` was abandoned: the `survey` org is already taken on npm.
- [x] **Private repo, unlicensed**, continued after the Phase 2 review as an interim
      posture — [ADR-0007](./adr/0007-license-and-repo-posture.md).
- [x] **Publication is on hold pending an explicit release walkthrough.** Working
      package names stay private at `0.0.0`/`UNLICENSED`; that state does not select a
      final brand, license, version, or release module —
      [ADR-0024](./adr/0024-publication-hold.md).
- [x] **No SurveyJS theme-JSON import**; own token namespace —
      [ADR-0008](./adr/0008-no-surveyjs-theme-import.md).
- [x] **Creator drag-and-drop deferred** to Phase 3 with three binding constraints —
      [ADR-0009](./adr/0009-creator-drag-and-drop.md).
- [x] **The Creator is pieces with a default assembly on top**, not one component —
      [ADR-0021](./adr/0021-creator-composition.md). The assembly is built from nothing
      but the public exports, which is what keeps the pieces genuinely usable alone.
- [x] **The host's design system draws the chrome.** Both React packages draw through a
      small, closed, partial map of primitives a host may replace with their own
      shadcn/ui, ReUI or Tailwind components; working defaults ship, and the library
      depends on none of them — [ADR-0022](./adr/0022-design-system-primitives.md).
      `creator-react` is built on it from the start; `@kajay/react` adopts it as its own
      scheduled row rather than as a side effect.

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

- [x] **All five release decisions walked through and recorded** — brand and scope,
      licensing, first version and compatibility promise, version train and release
      module, and the workflow with its provenance, access control and rollback policy
      ([ADR-0029](./adr/0029-release-walkthrough.md), superseding ADR-0024).
- [x] **The `kajay` npm organization is claimed**, so ADR-0006's conditional acceptance
      is now unconditional.
- [x] **Kajay is the product, not an umbrella.** The survey engine *is* Kajay, so the
      packages keep the names they have rather than becoming `@kajay/survey-*`. Decided
      before the first publish, when the rename was still nearly free
      ([ADR-0029](./adr/0029-release-walkthrough.md)).

---

## 12. Decision log

| Date | Decision |
| --- | --- |
| 2026-08-06 | **Managed release history and provenance are a host-owned derived read model.** The host relates authored Revisions to content-addressed releases explicitly, derives active/ready/blocked state from Activation and Environment Bindings, and treats rollback as a version-checked Activation to a previously active release. The SDK and a separate control plane stay out of this concern. [ADR-0041](./adr/0041-managed-release-history-and-provenance.md). |
| 2026-08-06 | **Managed authoring is Draft → immutable Revision → Definition Release.** Creator auto-saves a canonical, ETag-protected host Draft; checkpointing one Draft version is idempotent; and the host assembles the `.kajay` bundle from the selected Revision. Draft and revision lifecycle remain host concerns, not SDK behavior. [ADR-0039](./adr/0039-managed-definition-authoring-lifecycle.md). |
| 2026-08-06 | **The SDK demo can run both maintained runtimes together as symmetric HTTP peers.** A `compare` Compose profile fans each operation out to C# and TypeScript, compares stable contract facts, displays divergence, and fails closed. Individual profiles remain available. This supersedes ADR-0032's mutually exclusive deployment and browser-local TypeScript adapter. [ADR-0033](./adr/0033-dual-runtime-compatibility-demo.md). |
| 2026-08-06 | **Durable response state is a portable, definition-bound SDK contract.** Response Snapshot v1 uses recursively tagged Kajay values, absolute UTC timer anchors, definition digests, and side-effect-free restore; host persistence metadata stays outside it. [ADR-0034](./adr/0034-portable-response-snapshot-contract.md). |
| 2026-08-06 | **Workflow persistence and orchestration belong to a modular-monolith host, not the SDK.** The host owns PostgreSQL, concurrency, tenancy, audit, outbox/inbox delivery, deadlines, HTTP, and workers while SDKs remain portable. [ADR-0035](./adr/0035-workflow-host-owns-durable-orchestration.md). |
| 2026-08-06 | **Promotion moves immutable Definition Releases by digest.** The target host preflights, installs, and atomically activates a `.kajay` artifact; automation coordinates environments, and no standalone promotion server is introduced initially. [ADR-0036](./adr/0036-definition-release-promotion.md). |
| 2026-08-06 | **WorkOS AuthKit owns workflow-host identity.** WorkOS organization-scoped access tokens supply tenant, actor, and permissions; production approval is an authenticated permission, never request data. [ADR-0037](./adr/0037-workos-authenticated-workflow-host.md). |
| 2026-08-06 | **WorkOS Emulate provides local workflow-host identity without a bypass.** A pinned Compose overlay seeds author, operator, approver, and administrator identities; an opt-in host PKCE session supplies its protected access token to the same bearer validator used in production. [ADR-0038](./adr/0038-workos-emulate-local-authentication.md). |
| 2026-08-06 | **Promotion automation is an ephemeral CLI authenticated by scoped WorkOS machine identity.** It exports, verifies, preflights, installs, and optionally activates immutable releases; production approval uses a separate protected credential, and no new persistent control plane or SDK responsibility is introduced. [ADR-0040](./adr/0040-promotion-cli-and-workos-machine-identity.md). |
| 2026-08-06 | **SDK demonstrations share one renderer and Creator frontend while Docker Compose profiles select runtime authority.** The `dotnet` profile uses a C# 14 API through a same-origin proxy; the `typescript` profile runs locally in the browser. Both use the same authored definition and application contract, while conformance remains the semantic authority. [ADR-0032](./adr/0032-compose-sdk-demo-profiles.md). |
| 2026-08-05 | **`Kajay.Core` remains one deep package while its source and specialized public interface are organized by capability.** The everyday runtime stays in `Kajay`; expressions, extensibility, hosting, snapshots, and validation have focused namespaces. Conformance uses public interfaces, calibrated measurements move to a benchmark project, and C# structural limits become enforced. This replaces the unpublished 1.0 API baseline before NuGet publication. [ADR-0031](./adr/0031-csharp-sdk-source-and-namespace-architecture.md). |
| 2026-08-05 | **The second maintained runtime is the native `Kajay.Core` NuGet package for `net10.0` and later.** It is one deep headless package, versions independently, and earns compatibility through the same versioned corpus. Conformance v2 owns strict values, dates, midpoint rounding, a bounded linear-time Kajay Pattern Profile, scoring, and the general survey-scenario operation; changing TypeScript to those rules requires 2.0.0. [ADR-0030](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md), [conformance v2](../conformance/v2/README.md). |
| 2026-08-05 | **`Kajay.Core` 1.0.0 has met its implementation and release-readiness gates.** All C# parity rows, conformance v1/v2, supported-scale budgets, installed-package smoke, public API baseline, and release documentation are green. NuGet publication remains an explicit maintainer action. [Checklist §Q](./feature-parity-checklist.md#q--c-headless-sdk), [ADR-0030](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md). |
| 2026-08-05 | **The five TypeScript packages are published at 1.0.0 under `@kajay/*`.** The release uses the reviewed single train, licenses, public-interface ledger, and trusted-publishing workflow from ADR-0029. [ADR-0029](./adr/0029-release-walkthrough.md). |
| 2026-08-04 | **Publication is on hold until the release choices are walked through explicitly.** Packages remain private at `0.0.0` with `UNLICENSED` metadata; `@kajay/*` remains a working source scope; and no Changesets configuration, release workflow, scope claim, or registry publication is authorized. Brand/scope, licensing, first version, version train, and tooling remain deliberately undecided. Lifting the hold does not itself authorize publication. [ADR-0024](./adr/0024-publication-hold.md). |
| 2026-08-04 | **Creator placement and lifetime are headless modules, not React state.** `DesignSurface.placement` owns the complete preview/commit/abandon lifecycle and structured narration facts. `CreatorWorkspace` owns coherent registry/configuration, session construction, and disposal for both the default assembly and host-owned layouts; pieces still take only the narrow model they draw. [ADR-0009](./adr/0009-creator-drag-and-drop.md), [ADR-0021](./adr/0021-creator-composition.md). |
| 2026-08-04 | **`parseSurvey` retains its options-only and registry-plus-options modes.** Both have concrete production, Creator, test, pack, and conformance callers; replacing them with a bag now would add a transitional third interface without deepening the parser. A single options bag has explicit caller and release triggers. [ADR-0027](./adr/0027-retain-parse-survey-calling-modes.md). |
| 2026-08-04 | **Published runtime values require evidence.** Every package-root value is classified as a consumer operation, intentional extension seam, or maintained-adapter requirement. Package-local algorithms are private, model constructors that need no runtime identity are type-only, and the installed consumer proves the retained extension seams. [Public interface ledger](./public-package-interfaces.md). |
| 2026-08-04 | **Functional Phase 3 acceptance is proven; release readiness is separate.** Checklist §A–§N and the N5 host proof are green. Package publication is now subject to an explicit hold, while npm scope, licensing, version, and release-module choices remain deliberately deferred. All non-release architecture remediation is implemented and verified; that work does not manufacture owner decisions. [Context](../CONTEXT.md), [remediation plan](./architecture-remediation-plan.md). |
| 2026-08-03 | **Runtime compatibility is a versioned, executable interface rather than a source-code promise.** Generated metadata and diagnostic catalogs join the JSON Schema, while adapter-neutral definition, expression, value, and lifecycle cases live under `conformance/v1`. TypeScript is the first adapter; a future .NET runtime must pass the same corpus. [ADR-0020](./adr/0020-versioned-cross-language-runtime-contract.md). |
| 2026-08-02 | **Runtime seams represent independent policy, not one-use wiring.** Page-element traversal and host propagation now follow the registered content tree; validation/status/logic depend on concrete runtime modules; all dynamic-choice acquisition is owned together; and React dispatches every page element through one registry. Package entries were narrowed to consumer operations and intentional extension seams. [ADR-0019](./adr/0019-deep-runtime-modules-and-rendering-seam.md). |
| 2026-08-02 | Corpus created. Framework-agnostic core + React-first adapters; parity scope = Form Library + Creator; proof = in-repo host app consuming public interfaces + CI pack test; TS 6 strict with a second TypeScript 7 check. |
| 2026-08-02 | **Workspace moved from npm to pnpm** ([ADR-0015](./adr/0015-pnpm-workspace.md)), reversing the npm-workspaces choice in §5 and superseding ADR-0010's rejection of corepack. Deciding feature: catalogs, which pin a shared version once across the workspace and are what the single version train wants. Consumers are unaffected — packages still publish for npm, and the pack test now packs with pnpm and installs with npm precisely so the `workspace:*` rewrite is verified rather than assumed. |
| 2026-08-02 | **Phase 0 complete.** Monorepo, metadata kernel, serializer, React renderer, host-demo, enforcement scripts and CI all landed; `pnpm run verify` runs the repository gates green. Two toolchain amendments were forced by reality: TypeScript 7 shipped, so `@typescript/native-preview` was superseded by stable `typescript@7` (ADR-0012), and the oxlint baseline disabled `unicorn/prefer-event-target` because it recommends a DOM global into a DOM-free package (ADR-0013). |
| 2026-08-02 | Second pass: the `survey` npm org proved taken, so the scope became **`@kajay/*`** and the corpus was renamed (ADR-0006). Remaining Phase-0 decisions closed as ADR-0010 (Node ≥22.12, single-entry `exports`, host-imported CSS) and ADR-0011 (URN `$id`, `schemaVersion` on the definition, refuse-don't-guess on version mismatch). Checklist vocabulary migrates per-PR rather than in one pass. The org claim still gates publication. |
| 2026-08-02 | **A broken authored rule fails open; an unanswerable check fails closed.** Validation drew the same question twice with opposite answers, and both are deliberate. An unparseable `regex` or `expression` validator is treated as *no rule*: the respondent did not write it and cannot fix it, so blocking them turns an author's typo into a dead end. A **rejected** server-validation promise blocks the move instead: the server is the authority, nothing has confirmed the answers, and there is a real reason to stop. Neither is silent — `RegexValidator.hasInvalidPattern` and `ExpressionOutcome.failed` expose the first, and `validation.serverError` carries the second as a *survey*-level message rather than an objection attached to an answer that is not at fault. |
| 2026-08-02 | **`nextPageOrComplete` reports three outcomes, not a boolean** — `advanced`, `blocked`, `pending`. Once a check can leave the process, "the move did not happen" stops being one thing: `blocked` means put the respondent in front of the error, `pending` means there is no error yet, only a wait. A renderer that could not tell them apart would move focus to a field with nothing wrong with it. A survey with nothing async never sees `pending` and never awaits anything. |
| 2026-08-02 | **`choicesByUrl` origin belongs to the host** ([ADR-0017](./adr/0017-choices-url-environment-portability.md)): definitions carry origin-relative URLs so the artifact promoted to production is the one that was tested. The obvious alternative — parameterising the URL with an answer — was refuted by running it: every placeholder is percent-encoded, so `{baseUrl}/users` produces `https%3A%2F%2Fuat.acme.com/users`. Behind that sit three worse problems, the sharpest being that it would let a respondent choose where the survey fetches from. **Amended the same day**, reversing the ADR's own trigger-gating: the `{@name}` deployment scope is a stated requirement rather than a maybe, so it becomes checklist **B11** in Phase 1 §B rather than waiting for a second origin to appear. |
| 2026-08-02 | **Phase 1 complete.** §B, §C, §D and §E closed; §A closed but for the three rows naming Creator and Phase-2 surface. Eight gates green: 674 unit, 59 browser, 63 E2E, plus contract drift and the pack test across TypeScript 5.5/6.0/7.0. The last open question was **input masking, now dropped from parity scope** ([ADR-0018](./adr/0018-input-masking-out-of-scope.md)) rather than deferred — the first named gap against the SurveyJS Form Library, stated on C1's face rather than implied by a row that looks complete. Two design decisions from the phase are worth naming here because later work stands on them: a survey's **state is one value** (loading, empty, running, preview, completed) rather than a handful of flags, which is what made E4's preview read-only by construction; and the **reorder interaction was built as a primitive** (ADR-0009 constraint 3), so Phase 3's drag-and-drop extends something already proven accessible. |
| 2026-08-02 | **Quiz mode (§E8) moves to Phase 2**, with §E3's correct-answer progress bar, resolving a contradiction the roadmap held on its own face: Phase 1 named quiz mode as *out of scope* while its exit gate demanded §E green. Phase 2 already owned quiz mode in its scope list, and no other §E row waits on E8, so the gate moved rather than the work. The same edit made the Phase 1 gate honest in general: it now names the rows that cannot close there — A4/A5 (Creator property grid), A7 (events for features that do not exist yet), D1's matrix half — because reading it literally made the milestone unreachable rather than demanding. Recorded as a scope decision rather than an ADR: nothing about the architecture changed, only when the work happens. |
| 2026-08-02 | All nine §11 open decisions worked through; ADRs 0001–0009 recorded. Headline: the definition format is **our own** rather than SurveyJS-compatible, which moves parity evidence from executable (running their JSON) to capability-level (against their documentation) and makes deliberate format design Phase 0 work. Round-trip bar set at fixed-point equivalence. Expression parser and reactivity both hand-rolled and zero-dep. Single version train. Repo stays private and unlicensed until Phase 2 exit. |

## Parent and related links

- [Project context](../CONTEXT.md)
- [Delivery roadmap](./delivery-roadmap.md)
- [Feature-parity checklist](./feature-parity-checklist.md)
- [Architecture decision records](./adr/README.md)
