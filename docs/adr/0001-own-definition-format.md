# ADR-0001 — Own survey definition format; SurveyJS converter deferred

- Area: Survey definition format
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

The parity target is SurveyJS's documented surface, and the
[feature-parity checklist](../feature-parity-checklist.md) was derived from it — so
much so that the checklist is written almost entirely in SurveyJS's vocabulary
(`visibleIf`, `choicesByUrl`, `paneldynamic`, `matrixdropdown`,
`questionsOnPageMode`, `storeDataAsText`).

That made the definition format a Phase 0 decision rather than the Phase 4 "compat
mode" the roadmap originally filed it as. Property naming is baked into the metadata
registry's descriptors, into `contracts/survey-schema.json`, and into every fixture;
changing it after Phase 1 is a rename across the entire corpus.

Two coherent positions were available:

1. **Compatible by construction** — same property names, type names, and semantics,
   so SurveyJS definitions load as-is and their published surface becomes an
   executable oracle for parity.
2. **Our own format** — design the schema we want; offer a converter later.

## Decision

**Our own format.** `contracts/survey-schema.json` describes *our* definition format,
generated from our metadata registry. A SurveyJS import converter is Phase 4 work,
opportunity-driven, and is not an acceptance item.

## Format conventions (normative)

These exist because designing the format deliberately is now our job rather than
something inherited. They bind Phase 0.

- Property names are `camelCase`. Type names are lowercase single words.
- Every element carries `type` and `name`. `name` is the data key unless an explicit
  override property supersedes it.
- Conditions are string expressions in the language of
  [ADR-0003](./0003-hand-rolled-expression-parser.md), held in properties suffixed
  `If`.
- Localizable strings are either a bare string (meaning the default locale) or an
  object of `{ default, <locale>, ... }`. This is enforced by the metadata registry
  for every property marked localizable — never implemented per question type.
- Unknown properties are preserved verbatim and reported as diagnostics
  ([ADR-0002](./0002-round-trip-fixed-point.md)).
- No property may appear in the schema that the metadata registry does not declare.
  The registry is the single source of truth; the contract is its projection.

## Consequences

- **Parity evidence changes level.** Under the compatible option, parity would have
  been checkable by executing SurveyJS's published definitions against our engine.
  It is now verified at the *capability* level against their documentation, with each
  checklist row proven by a host-demo scenario written in our format. North Star
  principle 1 still holds — the checklist is still derived from their real documented
  surface — but the oracle is human-read rather than machine-run.
- **The checklist needs a vocabulary pass** (Phase 0). SurveyJS property names in the
  checklist are *illustrative of the capability, not normative*. Either rename them to
  capability language or add a per-section note. Until that pass lands, do not treat a
  checklist property name as a naming requirement.
- Phase 0 gains format-design work — the conventions above — that the compatible
  option would have supplied for free.
- No trademark or positioning entanglement with SurveyJS; the committed contract
  documents our design and nobody else's.
- **Accepted risk:** parity gaps are found by reading their docs, not by running their
  fixtures, so the failure mode is a missed capability nobody noticed. Mitigation: if
  the Phase 4 converter is built, it retroactively unlocks their corpus as a test
  source — that is the converter's strongest argument, over and above user demand.
- Do not copy SurveyJS's published demo JSON into our fixtures. Authoring our own
  fixtures is required regardless, and this keeps the corpus clean of their content.

## Checklist vocabulary migration (decided 2026-08-02)

The consequence above left open *how* the checklist gets restated. Decision: **no
big-bang rename.**

A rename pass done now would invent format property names in a checklist document,
ahead of the format-design work this ADR mandates — naming properties in a table
instead of in the metadata registry, which is backwards. Instead:

- The caveat banner at the top of the checklist stands, and every SurveyJS identifier
  in it reads as "the capability SurveyJS calls X".
- **When a PR declares a property in the registry, the same PR restates the checklist
  rows that referenced the old name.** This rides the existing rule that a contract
  diff is reviewed in the PR that causes it — same trigger, same review moment.
- The banner is removed when §A–§N are clean. Its presence is the outstanding-work
  marker; no separate tracking item is needed.

## Alternatives considered

- **Compatible by construction.** Considered and not taken. Would have made parity
  mechanically checkable and dissolved the roadmap's Phase-2-vs-Phase-4 question, at
  the cost of permanently inheriting their naming and having our contract document
  their format.
- **Compatible core plus an explicit extension namespace.** Considered and not taken:
  carries most of the naming constraint of full compatibility without delivering the
  clean load-their-JSON property that justifies it.

## Parent and related links

- [North Star §4.4](../NORTH_STAR.md), [Feature-parity checklist §A](../feature-parity-checklist.md)
