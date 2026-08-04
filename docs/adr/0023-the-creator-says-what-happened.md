# ADR-0023 — The Creator says what happened

- Area: `creator-core`, `creator-react`
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04 (amended)

## Context

Renaming a question to a name another question already has is correctly refused — names
must be unique — and the field puts the old name back. Nothing says why. From the
designer's side that is indistinguishable from a text box that ate their typing, and the
second thing they try is typing it again.

The rename is not the defect. It is one instance of a shape that runs through the whole
Creator: **fourteen edit methods on `DesignSurface` return a bare `boolean`** —
`setProperty`, `setLocalized`, `rename`, `addChild`, `removeChild`, `moveChild`,
`setFastEntry`, `removePage`, `place`, `removeElement`, `duplicate`, `copy`, `convert`,
and the collection edits behind them. Each collapses every reason it might refuse into
`false`, and most callers discard even that. A `false` cannot be rendered, cannot be
translated, and cannot be told apart from "nothing needed doing".

The same silence covers things the Creator does *without* being asked. A read-only
configuration (N2) refuses edits at the chokepoint and says nothing. A dropped question
arrives with starter choices (N5) that the designer did not type. Applying JSON (M2)
replaces the document. Undo moves the selection. Each is correct, and each is the tool
doing something on its own that the designer has to reverse-engineer from the result.

[PropertyFields.tsx](../../packages/creator-react/src/PropertyFields.tsx) documents the
gap without closing it — a comment explaining that a refused rename re-seeds the field so
the screen does not lie, and no line anywhere that tells the designer it happened. The
display half was thought about; the telling half was never built.

## Decision

**Every refusal carries a reason, and every action the Creator takes on its own is
announced. Silence is a defect, not a default.**

Three classes, with a rule each.

### A refusal returns why, not whether

An edit that can refuse returns a discriminated reason rather than a boolean — the shape
[`JsonEditorSession.problem`](../../packages/creator-core/src/JsonEditorSession.ts) already
uses (`{kind: 'syntax' | 'rejected'}`). `undefined` means it happened.

**One predicate, two callers.** The rule that decides a refusal is a pure exported
function; the edit guards with it and the view asks it before committing. A view that
re-implemented "is this name taken" would drift from the model that enforces it, and the
drift shows up as a field that promises an edit the document then refuses.

### An automatic action is announced where it happened

Anything the Creator does that the designer did not ask for — starter defaults on a drop,
a selection moved by undo, a document replaced by applying JSON, an edit dropped because
the deployment is read-only — says so. **Where it happened**, not in a corner: D5 settled
this for the runtime's validation errors and the argument is the same one.

> **Amendment (P6).** Building this half showed the rule needs a second clause, because
> "where it happened" has no answer for most of these. A paste that renumbered two names, a
> conversion that dropped a setting, a delete that took five questions — none has a control
> a message can hang from, which is the case the *Alternatives* section below already
> allowed a notification surface for. So: **a refusal lands on the control; a notice goes to
> one polite live region.** `role="status"`, not `alert` — these announce things that
> worked, and cutting across a screen reader to confirm a success is how announcements get
> turned off.
>
> **Not every automatic act qualifies.** The test is whether a designer would be confused or
> lose work if it happened quietly. Undo moving the selection fails it — undo is *expected*
> to change things, and a message on every press is one people learn to skip. Renaming their
> `who` to `who1` passes: they will go looking for `who`. Five acts passed; announcing an
> edit that was *refused* is excluded outright, because it would describe a survey the
> designer does not have.

### The words are the Creator's own

Every message is a key in the N3 string catalogue, so it translates and white-labels like
the rest of the chrome. A message assembled from string literals at the call site is
outside both mechanisms and cannot be found by either.

## Consequences

- **The boolean-returning surface is an inventory, not a design.** Fourteen methods are
  the work list; each is a decision about what its refusals actually are. Some will turn
  out to have exactly one reason and stay as they are, which is a finding rather than a
  failure.
- **This is a breaking change to `creator-core`'s public surface**, and it is much cheaper
  before 1.0.0 (ADR-0005) than after. That timing is the reason this is accepted now
  rather than filed as a nice-to-have.
- **Accessibility comes with it.** A reason rendered on the control with `aria-invalid`
  and `aria-describedby` is heard by a screen reader without a live region; a toast is
  not. J5's axe sweep covers the result.
- **Two things need testing where there was one**: that the edit refuses, and that the
  refusal is legible. A test asserting only `expect(result).toBe(false)` is now the
  incomplete half of a pair.
- **It does not extend to the runtime.** A respondent's survey already has D5's error
  model and E5's states; this is about the *tool*, whose user is a designer making
  decisions rather than answering questions.

## Alternatives considered

- **Fix the rename and move on.** Rejected: it is the instance that was noticed, not the
  class, and thirteen others would be found one complaint at a time.
- **Throw instead of returning a reason.** Rejected: a designer typing a duplicate name is
  ordinary use, not an exceptional condition, and an exception makes every call site a
  `try`. It would also cross the seam badly — `applyEdit` is called from event handlers.
- **A global toast or notification centre.** Rejected as the primary mechanism for the
  reason D5 rejected it for validation: a message about a field belongs at the field, and
  a notification stream is where messages go to be dismissed unread. Useful later for
  actions with no home on screen; not a substitute for one.
- **Log to the console.** Rejected: it tells a developer, and the audience is a designer.

## Parent and related links

- [ADR-0005](./0005-single-version-train.md) — why this lands before 1.0.0
- [ADR-0021](./0021-creator-composition.md)
- [ADR-0022](./0022-design-system-primitives.md)
- [Feature-parity checklist](../feature-parity-checklist.md) §P
