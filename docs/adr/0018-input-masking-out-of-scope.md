# ADR-0018 — Input masking is out of parity scope

- Area: Question types (§C1)
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

Checklist C1 names `maskSettings` — numeric, currency, datetime and pattern masks that
rewrite a text field's contents as the respondent types. Every other part of C1 is
built: all eleven input types, `min`/`max`/`step`, and the rule that a numeric answer
reaches `data` as a number.

Masking was left unbuilt through Phase 1 as a deliberate deferral, on the grounds that a
half-mask is worse than none. That reasoning survived contact with the rest of the phase,
but "deliberately not built" is not a place on the roadmap — and Phase 1's exit gate
cannot be declared met against a row that is neither green nor owned by a later phase.
So the question had to be answered rather than restated.

## Decision

**Input masking is dropped from parity scope.** Not deferred: no phase owns it, and C1
is green without it.

Three reasons, in the order they matter.

**It is a caret-management problem wearing a formatting problem's clothes.** The visible
part — turning `1234567` into `1,234,567` — is the easy half. The real work is what
happens when someone puts the caret in the middle of a formatted value and types, or
pastes, or presses backspace over a separator, or selects across one: the mask has to
decide where the caret lands after every one of those, in every input type, in every
browser's idea of a composition event. A mask that gets it nearly right is worse than no
mask, because the field silently eats or moves characters and the respondent cannot tell
whether their answer was recorded.

**The model already owns the part that matters.** What reaches `data` is a typed value —
`12` and not `"12"` — and validators enforce the shape. Masking changes what a respondent
*sees while typing*; it changes nothing about what is submitted, checked or stored. The
capability that would be missing is presentational.

**Where it is genuinely needed, it belongs to the host.** A text question renders as an
`<input>`, and a host that needs a currency mask can wrap or replace the renderer through
the registration seam §A4 provides — with a library whose full-time job this is, rather
than with a hand-rolled one shipped here. That is the same reasoning that keeps an HTML
sanitizer out of `@kajay/react` (§C12): a nearly-right implementation of a hostile
problem is more dangerous than none, and the seam is the honest answer.

## Consequences

- **C1 is green, and its row says masking is dropped rather than pending.** A reader of
  the ledger must not have to guess which.
- **Parity with the SurveyJS Form Library is now explicitly incomplete in one named
  place.** This is the first such gap, and the checklist header's promise — a row is
  green only when its named proof passes — is kept by the row stating what it does not
  cover. Any future gap gets the same treatment or the ledger stops meaning anything.
- If a real consumer needs masking, this is reversible: the decision is about who builds
  it, and the renderer seam is where it would arrive. Reversing it means an ADR
  superseding this one, not a quiet re-addition to a row.
- §O's watch list is not the right home for it. Those are items SurveyJS has not shipped;
  this is one they have and we are choosing not to.

## Parent and related links

- [Feature-parity checklist §C1](../feature-parity-checklist.md)
- [Delivery roadmap — Phase 1 exit](../delivery-roadmap.md)
- [ADR-0010 — package manifest and distribution](./0010-package-manifest-and-distribution.md)
