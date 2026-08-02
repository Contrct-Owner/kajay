# Feature-Parity Checklist

- Area: Acceptance ledger for SurveyJS feature parity
- Status: proposed
- Owner: Jarod
- Last updated: 2026-08-02

This is the authoritative acceptance document for the project's overall AC. A row is
**green only when the named proof passes in CI** — a host-demo scenario, rendering
integration test, or unit suite exercised through public APIs (see the
[guidelines](./library-development-guidelines-details.md)). Never flip a row by
assertion.

Parity target is the SurveyJS **Form Library** and **Survey Creator** as documented
in 2026 (v2/v3 era). Items on SurveyJS's own 2026 roadmap that have not shipped as
core parity surface are tracked in §O as *watch* items, not acceptance items.

Proof naming convention: `parity/<row-id>-<slug>` (e.g. `parity/B3-visible-if`).

**Demo coverage rule.** A closed row carries a host-demo scenario whenever the
capability is observable in the running application. Where it is not, the row says so
and why. Unit coverage alone is the exception, not the norm — the demo is what proves
the capability through the same boundary a consumer uses, and it has repeatedly caught
what unit tests could not: a numeric answer that rendered blank, an API wart, a
placeholder that never cleared.

> **Vocabulary caveat (added 2026-08-02).** This checklist was derived from SurveyJS's
> documented surface and therefore uses their property and type names throughout —
> `visibleIf`, `choicesByUrl`, `paneldynamic`, `matrixdropdown`, `questionsOnPageMode`,
> `storeDataAsText`, and so on. Since
> [ADR-0001](./adr/0001-own-definition-format.md) established that our definition
> format is **our own**, those names describe the **capability a row demands, not the
> name our format must use**. Do not treat a name in this document as a naming
> requirement — read every identifier here as "the capability SurveyJS calls X".
>
> These rows are restated **incrementally**: when a PR declares the corresponding
> property in the metadata registry, that same PR rewrites the row in our own
> vocabulary. There is no separate rename pass, because naming properties in this
> table ahead of the registry would invert the design order ADR-0001 sets. This banner
> is removed once §A–§N are clean, and its presence is the outstanding-work marker.

## §A — Schema, serialization & extensibility

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| A1 | JSON survey definition parses into a typed model; unknown properties surfaced, not dropped | ☑ | `parity/A1-unknown-properties-surfaced` (unit + host E2E) |
| A2 | Lossless round-trip: parse → serialize → parse is stable for every fixture | ☑ | `parity/A2-round-trip` (unit, every fixture) + `parity/A2-round-trip-fixed-point` (host E2E) |
| A3 | Metadata registry: register question class with typed property descriptors, defaults, inheritance | ☑ | `parity/A3-metadata-registry` (unit). The descriptor is the only place a default is written, and the model resolves through it ([ADR-0016](./adr/0016-metadata-owns-property-defaults.md)) — so "unset" and "explicitly empty" are now different states, and a directly constructed `new TextQuestion()` resolves the same defaults `parseSurvey` would give it. Not demo-testable: the registry is machinery with no user-visible surface of its own |
| A4 | Custom question type registers end-to-end (serializer, schema, toolbox, property grid, renderer) | ☐ | Partial: serializer, schema and toolbox proven; property grid and renderer registration are Phase 3 |
| A5 | Custom property on an existing type (`addProperty` pattern), serialized and editable | ☐ | Partial: `addProperty` serializes and reaches the contract; "editable" needs the Phase 3 property grid |
| A6 | Committed JSON Schema contract generated from the registry; CI drift check | ☑ | `parity/A6-contract-generated-from-registry` (unit) + `check:contract` CI job. Not demo-testable: the contract is a build artefact, not application behaviour |
| A7 | Typed event surface: onValueChanged, onComplete, onCurrentPageChanged, onValidate*, onUploadFiles, onDynamicPanelAdded, matrix row events | ☐ | Partial: onValueChanged/onComplete/onCurrentPageChanged proven by `parity/A7-value-changed-event`; onValidateQuestion and onValidatingChanged by `parity/D4-validate-question-event` and `parity/D3-async-validators`; upload, dynamic-panel and matrix events await their features |

## §B — Expressions & conditional logic

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| B1 | Expression language: literals, `{question}` refs incl. composite paths (`{matrix.row.col}`, `{panel[0].q}`), arithmetic, comparison, and/or/not, contains/anyof/allof, empty/notempty | ☑ | `parity/B1-expression-grammar` (precedence/associativity via print round-trip) + `parity/B1-operators` (evaluation), unit, through public API. Not demo-testable: precedence, associativity and error recovery have no user-visible surface — the demo exercises the language's *use* in every other scenario |
| B2 | Built-in function library (iif, sum, avg, min, max, count, age, today, currentDate, getDate, diffDays, ...) + custom sync and async function registration | ☐ | Partial: library and **sync** custom registration proven by `built-in function library`; async registration not built |
| B3 | `visibleIf` on questions, panels, pages, and individual choices | ☑ | `parity/B3-visible-if`, `parity/B3-visible-if-choice` (questions, pages, choices) and `parity/E1-panel-visibility` (panels, unit + browser + host E2E). A hidden panel takes its subtree out of reach without marking each child invisible — reachability and visibility are different questions, and only the first one is the container's to answer |
| B4 | `enableIf` / `requiredIf` | ☑ | `parity/B4-enable-if`, `parity/B4-required-if` (unit, browser, host E2E). Scope of `requiredIf`: questions, the only element that holds an answer. `enableIf` now also applies to panels, proven by `parity/E1-panel-enable` — the renderer uses a `fieldset`, so a disabled group freezes its subtree natively rather than by walking children |
| B5 | `setValueIf` + `setValueExpression`, `resetValueIf`, `defaultValueExpression` | ☑ | `parity/B5-default-value-expression` (unit + host E2E), `parity/B5-set-value-if` and `parity/B5-reset-value-if` (unit + host E2E). Precedence reset > set > default is defined in `createValueRule`, not left to graph ordering |
| B6 | Calculated values (survey-level `calculatedValues`, usable in expressions and completed HTML) | ☐ | Partial: `parity/B6-calculated-values` (unit + host E2E) covers computation, chaining, use from question expressions, and `includeIntoResult`. "Completed HTML" cannot be proven — `completedHtml` is §E5 and does not exist yet |
| B7 | Triggers: complete, setvalue, copyvalue, runexpression, skip | ☑ | `parity/B7-trigger-complete`, `-setvalue`, `-copyvalue`, `-runexpression`, `-skip` (unit); host E2E for all five. Triggers fire on the transition into true, not while it holds. `skip` became demo-testable once the renderer paginated (§E2): `parity/B7-trigger-skip` moves the respondent back a page and the renderer follows |
| B8 | Dependency graph: value change re-evaluates only dependents; cycles detected and reported | ☑ | `parity/B8-dependency-graph` (selective re-evaluation, ordering), `parity/B8-cycle-reporting` (participating nodes named), `parity/B8-pattern-edges` (dynamic collections), unit, through public API. Not demo-testable: "only dependents re-evaluated" is by definition invisible, and proving cycle reporting would mean authoring a broken survey into the demo |
| B9 | Carry-forward choices (`choicesFromQuestion`, selected/unselected modes) | ☑ | `parity/B9-carry-forward-choices` (unit + host E2E). The carried list is a live view, not a snapshot, so a source choice hidden by its own `visibleIf` disappears here too. Shares `ChoiceSourceController` with B10, so both dynamic sources resolve through one object |
| B10 | REST choices (`choicesByUrl`: url/path/valueName/titleName, caching, url with `{question}` placeholders) | ☑ | `parity/B10-rest-choices` (unit + host E2E). Placeholders become real graph dependencies, so an answer change re-fetches. The fetcher is injected — core is I/O-free and cannot reference `fetch`. The demo calls a live public API; the E2E intercepts it so CI never depends on a third party. A superseded response cannot install itself over a newer one (request generations, proven by mutation), the cache is keyed on the conversion settings and not the URL alone, and one in-flight request is shared by every source awaiting it. The original typed value survives the renderer, so a numeric `id` records as a number. Definitions carry origin-relative URLs and the host resolves the origin in `fetchJson`, so one definition promotes across environments unedited ([ADR-0017](./adr/0017-choices-url-environment-portability.md)); the demo's absolute URL demonstrates a public third-party API, not deployment portability. **Gaps noted:** the model carries no loading flag, so a renderer cannot show a loading state; multi-origin definitions are B11 |
| B11 | Deployment variable scope: `{@name}` placeholders resolved from host-supplied endpoints, distinct from the answer scope | ☐ | Not built. Specified in [ADR-0017](./adr/0017-choices-url-environment-portability.md): substituted verbatim rather than percent-encoded, never a graph dependency, undeclared name is a parse diagnostic rather than the empty string, template round-trips while the resolved value never does. Closes the multi-origin gap B10 leaves open. Demo-testable via a second intercepted origin |

## §C — Question types: core

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| C1 | text — all inputTypes (text, number, email, date, datetime-local, time, tel, url, color, range, password), min/max, step, maskSettings (numeric, currency, datetime, pattern) | ☐ | Partial: `parity/C1-input-types`, `parity/C1-text-bounds`, `parity/C1-numeric-answers-are-numbers` (unit + demo) cover every input type, `min`/`max`/`step`, and the rule that a numeric input stores a number rather than the string the DOM reported. **`maskSettings` is not built** — input masking is a caret-management problem, not a formatting one, and a half-mask that mangles mid-string editing is worse than none |
| C2 | comment (multi-line, autoGrow, character counter) | ☑ | `parity/C2-comment` (unit + demo), `parity/C2-comment-auto-grow` (demo, measuring real height in Chromium). The budget is enforced by the model, not just displayed: a trigger or a restored `data` payload can exceed a `maxlength` attribute |
| C3 | radiogroup (choices, otherItem, noneItem, showClearButton, colCount, choicesOrder) | ☑ | `parity/C3-radiogroup` (unit), `parity/C3-C4-select-questions` (host E2E), browser proof for selection. `choicesOrder` supports none/asc/desc; random is deferred as it would make the suite non-deterministic |
| C4 | checkbox (selectAll, none, other, maxSelectedChoices, colCount) | ☑ | `parity/C4-checkbox` (unit), `parity/C3-C4-select-questions` (host E2E), browser proof for multi-select |
| C5 | dropdown (search/filter, lazy loading, placeholder, showOtherItem) | ☐ | Partial: `parity/C5-dropdown` (unit + browser) covers single-select, placeholder, showOtherItem, and model-level search (`filterChoices`). **Lazy loading** (paging a long list as the respondent scrolls) is still open. B10 added asynchronous *loading*, but not paging. The searchable combobox *UI* is deferred to Phase 2's a11y pass — the renderer uses a native `<select>` |
| C6 | tagbox (multi-select dropdown with search + lazy load) | ☐ | Partial: `parity/C6-tagbox` (unit + browser, including `parity/C6-tagbox` in real Chromium proving the native adapter preserves the model's invariants). The adapter reports its whole selection and the model decides what that means, so none-exclusivity and `maxSelectedChoices` hold however the selection was made. Lazy load (paging) and the combobox UI are deferred with C5 |
| C7 | boolean (switch + radio render modes, labelTrue/False, valueTrue/False) | ☑ | `parity/C7-boolean` (unit), `parity/C7-boolean-switch` and `parity/C7-boolean-radio-with-custom-values` (demo). Unanswered is a third state, not `false`: "was never asked" and "did not agree" are different facts and only the model can keep them apart |
| C8 | rating (numeric, stars, smileys, rateValues, min/max descriptions, display mode auto-switch) | ☑ | `parity/C8-rating` (unit), `parity/C8-rating-stars` and `parity/C8-rating-auto-collapses-a-long-scale` (demo). Stars and smileys are `aria-hidden` decoration over real radios, so the scale announces "4" rather than "star star star star"; `auto` collapses at eleven steps, and the collapsed form is a labelled control rather than a group so the select has a name of its own |
| C9 | ranking (drag reorder, selectToRankEnabled, keyboard support) | ☐ | |
| C10 | imagepicker (single/multi, imageFit, contentMode image/video) | ☐ | |
| C11 | multipletext (items, itemSize, per-item validation) | ☐ | |
| C12 | html (display), image (display), expression (read-only computed with displayStyle/format) | ☐ | |

## §D — Validation

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| D1 | Required with custom `requiredErrorText`; `isRequired` on any type incl. matrix rows | ☐ | Partial: `parity/D1-required` (demo + browser + unit) covers every question type that exists today, and `requiredIf` reaches the same gate as `isRequired`. Matrix rows do not exist yet — that half closes with §F |
| D2 | Built-in validators: numeric (min/max), text (min/max length, allowDigits), regex, email, expression, answercount | ☑ | `parity/D2-built-in-validators`, `parity/D2-expression-validator` (unit); `parity/D2-email-validator` (demo); `parity/D2-validators` (browser) |
| D3 | Custom validators + async validators | ☑ | `parity/D3-async-validators` (unit + browser + demo). The demo registers its own `AsyncValidator` subclass exactly as a host would — nothing about it ships in the library |
| D4 | Server-side seam: `onValidateQuestion` / a host server validator, with async completion | ☑ | `parity/D4-server-validation`, `parity/D4-validate-question-event` (unit); `parity/D4-server-validation` (browser + demo). The server hook is a promise, not SurveyJS's `complete()` callback — a callback the host must remember to invoke is a hung survey waiting to happen |
| D5 | Error placement (top/bottom), page-level vs question-level validation, validate on value change vs on next page | ☑ | `parity/D5-validation-scope`, `parity/D5-check-errors-mode`, `parity/D5-error-location` (demo + unit + browser); `parity/D5-errors-announced` (unit) |
| D6 | `validationEnabled` toggle; focus first invalid question | ☑ | `parity/D6-validation-enabled`, `parity/D6-focus-first-error` (demo + browser); `parity/D6-first-error-question` (unit) |

## §E — Navigation, flow & state

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| E1 | Pages, panels (nested, collapsible, visibleIf), elements ordering | ☑ | `parity/E1-panels`, `parity/E1-panel-visibility`, `parity/E1-panel-enable`, `parity/E1-panel-collapse` (unit, browser, host E2E). Panels nest arbitrarily and round-trip. A page is deliberately **not** a page element — parenting it under the same base would have made a page a legal child of a page, which the contract caught. Collapsing lives on the model, not in React: the definition declares the starting state and the Creator has to edit it. Only a panel that authored `state` is collapsible; one left at the default is a grouping device, and a toggle would invite hiding content the author never meant to hide |
| E2 | Prev/next/complete flow; page visibility recalculation; questionsOnPageMode (standard, singlePage, questionPerPage) | ☑ | `parity/E2-navigation`, `parity/E2-page-visibility`, `parity/E2-questions-on-page-mode` (unit, browser, host E2E). Every index counts **visible** pages, so a hidden page is not somewhere a respondent can stand. Hiding the page underneath a respondent clamps to the last visible one and announces the move, rather than leaving the renderer drawing nothing. `questionsOnPageMode` reshapes what navigation and the renderer see while leaving the authored `pages` untouched, and the reshaped list is memoised on its structure so React does not remount every question per render |
| E3 | Progress bar (pages, questions, correct-answer variants) + TOC navigation | ☐ | |
| E4 | Preview mode before complete (showPreviewBeforeComplete, edit-from-preview) | ☐ | |
| E5 | Completed page (completedHtml, completedHtmlOnCondition), loading/empty states | ☐ | Partial: completion itself is proven by `parity/E5-completion-flow` (host E2E) and the primary button completes on the last page rather than a separate control appearing. **`completedHtml`, `completedHtmlOnCondition` and loading/empty states are not built**, which is also what keeps B6 open |
| E6 | Partial save/resume: serialize `data` + currentPageNo; onValueChanged/onCurrentPageChanged seams; sendResultOnPageNext pattern | ☐ | |
| E7 | Read-only / display mode for the whole survey and per question | ☐ | |
| E8 | Quiz mode: maxTimeToFinish, per-page timers, correctAnswer, quiz scoring, showTimerPanel | ☐ | |
| E9 | Clear invisible values policies (onHidden, onComplete, none) | ☐ | |
| E10 | First-question autofocus, checkErrorsMode, goNextPageAutomatic | ☐ | |

## §F — Matrix family

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| F1 | matrix (single-choice rows): columns/rows, isAllRowRequired, eachRowUnique, alternate rows | ☐ | |
| F2 | matrixdropdown: per-column cellType (dropdown, checkbox, radiogroup, text, comment, boolean, expression, rating), column totals, cell visibleIf/enableIf with row context | ☐ | |
| F3 | matrixdynamic: add/remove rows, min/max rows, confirmDelete, defaultRowValue, copy default from last row | ☐ | |
| F4 | Detail panels (expandable row detail with its own elements) | ☐ | |
| F5 | Row/column expressions: `{row.col}` references, totals row with expressions | ☐ | |
| F6 | Responsive/mobile rendering mode for matrices | ☐ | |

## §G — Dynamic panels

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| G1 | paneldynamic: template panel, add/remove, min/max panels, panelCount binding | ☐ | |
| G2 | Render modes: list, tab-per-panel/progress navigation modes | ☐ | |
| G3 | Template expressions with `{panel.q}` scoping; valueName data binding/shared data | ☐ | |
| G4 | Nested composites: panels in dynamic panels, matrices in panels | ☐ | |

## §H — Media & upload

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| H1 | file: single/multiple, drag-drop, accepted types, max size, previews, storeDataAsText vs onUploadFiles seam, camera capture option | ☐ | |
| H2 | signaturepad: draw, clear, penColor, background, output format | ☐ | |
| H3 | Download/clear seams for stored files (onDownloadFile, onClearFiles) | ☐ | |

## §I — Theming & appearance

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| I1 | CSS-variable design tokens covering all components; documented | ☐ | |
| I2 | Theme JSON format (palette, panelless/panel modes, sizes, corner radius, background image/opacity) applied at runtime | ☐ | |
| I3 | Preset themes incl. light/dark in `@kajay/themes` | ☐ | |
| I4 | Per-instance css class overrides (survey-level css merge) | ☐ | |
| I5 | Responsive layout: startWithNewLine, colCount, question width/minWidth, title alignment options | ☐ | |
| I6 | Custom rendering seams: register custom renderer per question type; markdown/HTML in titles via onTextMarkdown | ☐ | |

## §J — Localization & accessibility

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| J1 | Localizable strings: every user-facing property accepts `{ default, <locale> }`; survey.locale switch re-renders | ☐ | |
| J2 | UI string dictionaries with runtime registration; `en` complete; ≥3 seed locales proving the mechanism | ☐ | |
| J3 | RTL support | ☐ | |
| J4 | Keyboard operability for every question type incl. ranking and matrices | ☐ | |
| J5 | ARIA roles/labels/error associations; axe checks pass on every demo page | ☐ | |

## §K — Creator: design surface & toolbox

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| K1 | Toolbox listing all registered types (auto-populated from registry), search, categories, custom toolbox items | ☐ | |
| K2 | Drag-drop from toolbox onto surface; reorder questions/panels/pages by drag; drop indicators | ☐ | |
| K3 | Live design surface rendering real questions (WYSIWYG via @kajay/react), selection, inline title editing | ☐ | |
| K4 | Page management: add/remove/reorder pages, page adorners | ☐ | |
| K5 | Copy/paste/duplicate questions and panels; convert question type in place | ☐ | |
| K6 | Undo/redo across all designer operations | ☐ | |

## §L — Creator: property grid

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| L1 | Property grid generated from the metadata registry: categories, ordering, editor type per property type | ☐ | |
| L2 | Specialized editors: choices editor (with fast entry), validators editor, expression editor with autocomplete, localizable-string editor | ☐ | |
| L3 | Property visibility/dependency rules (visibleIf on properties), read-only properties | ☐ | |
| L4 | Custom properties appear automatically; property grid customization API (hide/reorder/custom editors) | ☐ | |
| L5 | Survey-level and page-level settings surfaces | ☐ | |

## §M — Creator: editors

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| M1 | Visual logic editor: list rules, build conditions via dropdown UI, actions (show/hide, enable, require, skip, setValue, complete), round-trips to expressions | ☐ | |
| M2 | JSON editor tab: two-way sync with designer, syntax + schema error surfacing | ☐ | |
| M3 | Preview tab: run the in-progress survey with device/orientation presets, test data | ☐ | |
| M4 | Translation editor: locale columns, machine-translation seam, import/export strings (CSV/XLSX seam) | ☐ | |
| M5 | Theme editor: edit theme JSON visually, live preview, import/export theme | ☐ | |

## §N — Creator: embedding & integration

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| N1 | Embeddable component with controlled JSON (value in / onChange out), save seam (onSurveySaving/auto-save) | ☐ | |
| N2 | Configuration: hide tabs, restrict question types, read-only mode, isAutoSave, showJSONEditorTab etc. | ☐ | |
| N3 | White-labeling: creator theming, localized creator UI strings | ☐ | |
| N4 | Works under the pack test: creator consumed from tarball in scratch project | ☐ | |
| N5 | **Overall AC scenario:** build survey covering every §C/§F/§G/§H type in Creator → render → submit → lossless round-trip back into Creator | ☐ | |

## §O — Watch items (SurveyJS 2026 roadmap; not acceptance)

Image Map question; Fill-in-the-Blanks question; CSS-grid matrix overhaul; grid
layout engine; data-grid question with server-side processing; Tailwind/Bootstrap
style adapters; AI theme generation; rich-text authoring in Creator; refreshed
Dashboard/PDF (separate products). Revisit at each phase boundary; promote to a
lettered section only with evidence a real consumer needs it.

## Parent and related links

- [North Star](./NORTH_STAR.md)
- [Delivery roadmap](./delivery-roadmap.md)
- [Library development guidelines](./library-development-guidelines-details.md)
- [Architecture decision records](./adr/README.md)
