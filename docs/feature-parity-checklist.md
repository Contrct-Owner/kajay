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
| A3 | Metadata registry: register question class with typed property descriptors, defaults, inheritance | ☑ | `parity/A3-metadata-registry` (unit) |
| A4 | Custom question type registers end-to-end (serializer, schema, toolbox, property grid, renderer) | ☐ | Partial: serializer, schema and toolbox proven; property grid and renderer registration are Phase 3 |
| A5 | Custom property on an existing type (`addProperty` pattern), serialized and editable | ☐ | Partial: `addProperty` serializes and reaches the contract; "editable" needs the Phase 3 property grid |
| A6 | Committed JSON Schema contract generated from the registry; CI drift check | ☑ | `parity/A6-contract-generated-from-registry` (unit) + `check:contract` CI job |
| A7 | Typed event surface: onValueChanged, onComplete, onCurrentPageChanged, onValidate*, onUploadFiles, onDynamicPanelAdded, matrix row events | ☐ | Partial: onValueChanged/onComplete/onCurrentPageChanged proven by `parity/A7-value-changed-event`; the rest await their features |

## §B — Expressions & conditional logic

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| B1 | Expression language: literals, `{question}` refs incl. composite paths (`{matrix.row.col}`, `{panel[0].q}`), arithmetic, comparison, and/or/not, contains/anyof/allof, empty/notempty | ☑ | `parity/B1-expression-grammar` (precedence/associativity via print round-trip) + `parity/B1-operators` (evaluation), unit, through public API |
| B2 | Built-in function library (iif, sum, avg, min, max, count, age, today, currentDate, getDate, diffDays, ...) + custom sync and async function registration | ☐ | Partial: library and **sync** custom registration proven by `built-in function library`; async registration not built |
| B3 | `visibleIf` on questions, panels, pages, and individual choices | ☐ | Partial: **questions, pages and individual choices** closed by `parity/B3-visible-if` and `parity/B3-visible-if-choice` (unit, browser, host E2E). Only panels remain, awaiting the panel element (§E1) |
| B4 | `enableIf` / `requiredIf` | ☑ | `parity/B4-enable-if`, `parity/B4-required-if` (unit, browser, host E2E). Scope: questions, the only element that holds an answer — `requiredIf` is meaningless elsewhere. Container-level `enableIf` arrives with panels (§E1) |
| B5 | `setValueIf` + `setValueExpression`, `resetValueIf`, `defaultValueExpression` | ☑ | `parity/B5-default-value-expression` (unit + host E2E), `parity/B5-set-value-if`, `parity/B5-reset-value-if` (unit). Precedence reset > set > default is defined in `createValueRule`, not left to graph ordering |
| B6 | Calculated values (survey-level `calculatedValues`, usable in expressions and completed HTML) | ☐ | Partial: `parity/B6-calculated-values` (unit + host E2E) covers computation, chaining, use from question expressions, and `includeIntoResult`. "Completed HTML" cannot be proven — `completedHtml` is §E5 and does not exist yet |
| B7 | Triggers: complete, setvalue, copyvalue, runexpression, skip | ☑ | `parity/B7-trigger-complete`, `-setvalue`, `-copyvalue`, `-runexpression`, `-skip` (unit) + `parity/B7-triggers` (host E2E). Triggers fire on the transition into true, not while it holds. `skip` moves `currentPageNo`; it has no *visible* effect until the renderer paginates (§E2) |
| B8 | Dependency graph: value change re-evaluates only dependents; cycles detected and reported | ☑ | `parity/B8-dependency-graph` (selective re-evaluation, ordering), `parity/B8-cycle-reporting` (participating nodes named), `parity/B8-pattern-edges` (dynamic collections), unit, through public API |
| B9 | Carry-forward choices (`choicesFromQuestion`, selected/unselected modes) | ☐ | |
| B10 | REST choices (`choicesByUrl`: url/path/valueName/titleName, caching, url with `{question}` placeholders) | ☐ | |

## §C — Question types: core

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| C1 | text — all inputTypes (text, number, email, date, datetime-local, time, tel, url, color, range, password), min/max, step, maskSettings (numeric, currency, datetime, pattern) | ☐ | |
| C2 | comment (multi-line, autoGrow, character counter) | ☐ | |
| C3 | radiogroup (choices, otherItem, noneItem, showClearButton, colCount, choicesOrder) | ☑ | `parity/C3-radiogroup` (unit), `parity/C3-C4-select-questions` (host E2E), browser proof for selection. `choicesOrder` supports none/asc/desc; random is deferred as it would make the suite non-deterministic |
| C4 | checkbox (selectAll, none, other, maxSelectedChoices, colCount) | ☑ | `parity/C4-checkbox` (unit), `parity/C3-C4-select-questions` (host E2E), browser proof for multi-select |
| C5 | dropdown (search/filter, lazy loading, placeholder, showOtherItem) | ☐ | |
| C6 | tagbox (multi-select dropdown with search + lazy load) | ☐ | |
| C7 | boolean (switch + radio render modes, labelTrue/False, valueTrue/False) | ☐ | |
| C8 | rating (numeric, stars, smileys, rateValues, min/max descriptions, display mode auto-switch) | ☐ | |
| C9 | ranking (drag reorder, selectToRankEnabled, keyboard support) | ☐ | |
| C10 | imagepicker (single/multi, imageFit, contentMode image/video) | ☐ | |
| C11 | multipletext (items, itemSize, per-item validation) | ☐ | |
| C12 | html (display), image (display), expression (read-only computed with displayStyle/format) | ☐ | |

## §D — Validation

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| D1 | Required with custom requiredErrorText; isRequired on any type incl. matrix rows | ☐ | |
| D2 | Built-in validators: numeric (min/max), text (min/max length, allowDigits), regex, email, expression, answercount | ☐ | |
| D3 | Custom validators + async validators | ☐ | |
| D4 | Server-side seam: onValidateQuestion / onServerValidateQuestions with async completion | ☐ | |
| D5 | Error placement (top/bottom), page-level vs question-level validation, validate on value change vs on next page | ☐ | |
| D6 | validationEnabled toggle; focus first invalid question | ☐ | |

## §E — Navigation, flow & state

| ID | Feature | Status | Proof |
| --- | --- | --- | --- |
| E1 | Pages, panels (nested, collapsible, visibleIf), elements ordering | ☐ | |
| E2 | Prev/next/complete flow; page visibility recalculation; questionsOnPageMode (standard, singlePage, questionPerPage) | ☐ | |
| E3 | Progress bar (pages, questions, correct-answer variants) + TOC navigation | ☐ | |
| E4 | Preview mode before complete (showPreviewBeforeComplete, edit-from-preview) | ☐ | |
| E5 | Completed page (completedHtml, completedHtmlOnCondition), loading/empty states | ☐ | |
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
