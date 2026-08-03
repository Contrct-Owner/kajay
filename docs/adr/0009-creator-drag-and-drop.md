# ADR-0009 — Creator drag-and-drop implementation

- Area: Creator interaction
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-03

## Context

Checklist K2 requires drag from the toolbox onto the design surface plus drag
reordering of questions, panels, and pages, with drop indicators. Whether to hand-roll
this or adopt a library was genuinely a Phase 3 question — it depended on what
`creator-core`'s surface tree looked like by then.

This ADR was deferred with three constraints bound in advance to keep the deferral
cheap. Those constraints held, and K1 and K3 have now built the surface tree the
decision was waiting on. What follows first records the constraints as they were
written, then decides the question they left open.

## Constraints bound in advance

### Constraint 1 — the model is headless, in `creator-core`

What can drop where, valid drop targets, insertion indices, and the resulting tree
mutation are `creator-core` concerns and must be pure logic with no pointer events and
no DOM. Only the *input adapter* — translating pointer and keyboard events into model
operations — lives in `creator-react`.

This confines the library-versus-hand-rolled choice to a thin, swappable adapter, and
keeps drag-drop behavior unit-testable without a browser.

### Constraint 2 — HTML5 native drag-and-drop is excluded

K2 and J4 together require reordering to be keyboard-operable. Native HTML5 DnD has no
keyboard story and behaves poorly on touch. Whatever is chosen in Phase 3 will be
pointer-events based. This is decided now because it eliminates the option that would
otherwise look cheapest.

### Constraint 3 — build the reorder interaction once, in Phase 1

Checklist C9 (ranking) needs drag reordering with keyboard support inside
`@kajay/react`, in Phase 1 — two phases before the Creator needs the same thing.
Build it there as a reusable interaction rather than as ranking-specific code, so
Phase 3 extends a proven, accessible primitive instead of introducing a second
drag system.

## Decision

**Hand-rolled, on the terms below.** Four things are decided; the fifth records the scope
of a placement and what dropping into a panel turned out to need.

### 1 — No library

Constraint 2 already removed the option that would have been cheapest, and what remains
of the case for a library is thinner than it looks. The expensive part of drag-and-drop
is not the pointer maths, it is the keyboard grammar and the live-region vocabulary that
make it operable without sight — and Phase 1 already paid for those in `useReorder`.
Adopting a library now would mean auditing *its* keyboard story against J4 and J5, which
is most of the work over again with less control over the outcome.

There is also a composition reason. Under [ADR-0021](./0021-creator-composition.md) and
[ADR-0022](./0022-design-system-primitives.md) the Creator ships as pieces a host
arranges and styles, drawn from the host's own primitives. A drag library that owns a
portal, a drag layer and its own DOM is a second opinion about the Creator's markup,
sitting underneath a decision we have just committed to leaving to the host.

### 2 — The model is a list of insertion slots, not element indices

A **drop slot** names a position between elements: a container and an index into it.
For a page with *n* elements there are *n + 1* slots.

Slots rather than element indices, because slots make three separate problems one
problem:

- **A drop from the toolbox and a reorder become the same operation.** Both are "put
  this at that slot"; they differ only in whether the thing being placed already exists.
  Indices cannot express the first, because a new element has no index to move from.
- **The drop indicator becomes a model value.** "Which slot is active" is a number the
  model already tracks, so the indicator is rendered from state rather than computed
  from pixels, and it is assertable in a unit test.
- **The keyboard story becomes a walk.** Arrow keys step through slots. There is no
  separate gesture to learn for "insert here" versus "move here".

### 3 — Structural edits are definition-in, definition-out, re-parsed

A structural edit serializes the survey being designed, changes the resulting
definition, and parses it again. Property edits — K3's title editing, and everything
K5 will add — continue to mutate the model in place.

Adding an element correctly means more than pushing it into an array: a name that does
not collide, a value host, layout, and a place in the logic graph. That is precisely
what `parseSurvey` does, and re-implementing it incrementally against a live model is
how the Creator's tree and the runtime's tree drift apart — the Creator would be the
only place a survey could be built into a state the parser would never produce.

Three things follow, all of them wanted:

- **K6 gets a stack of definitions**, which is the whole of undo/redo for structural
  edits rather than a command per operation.
- **Every structural edit exercises [ADR-0002](./0002-round-trip-fixed-point.md)'s
  round-trip fixed point.** If serialize→parse were ever not a fixed point, the Creator
  finds out on the next drop rather than on somebody's saved survey.
- **Element identity does not survive an edit**, so the selection is re-resolved by
  name. Recorded here because it is the cost of this choice and it is real.

### 4 — A Creator drag previews and commits once

This is a deliberate divergence from C9's ranking, which applies every move to the model
as it happens and shows no preview at all — "what is on screen mid-drag is always the
answer as recorded".

The Creator does the opposite: the drag tracks an active slot, nothing changes, and the
move is applied once on drop. Two reasons, and the first is decisive:

- A structural edit is a re-parse (decision 3). Doing one per pointer-move would be both
  wasteful and *wrong* — every element on the surface would be rebuilt underneath the
  designer's pointer, and focus would be destroyed on every keystroke of a keyboard
  drag.
- K2 asks for drop indicators, and an indicator is a preview by another name. A model
  that applies live has nothing to indicate.

Escape therefore costs nothing here, and does not have to undo anything: it abandons a
pending placement rather than reversing a series of applied ones.

### 5 — Placement is within one page

K2's slots are the current page's containers: the page itself and any panel on it,
including nested ones. Reordering *pages* is K4's, which owns page management.

**Dropping into a panel shipped after the rest of K2**, and the delay is worth
recording, because it was never about placement. The model needed only to find a panel
by name; what was missing was a way for the Creator to put an adorner around elements
inside markup the respondent's own panel renderer had drawn. That turned out to be a
decorator on `PageElementSlot` — already the one wrapper every page element passes
through in every container — so the panel renderer needed no change at all.

The lesson generalises, and is the reason this ADR is worth re-reading before the next
Creator row: when a piece of the Creator looks blocked by the runtime's rendering, the
question to ask is which existing seam every element already passes through, not whether
to build a design-mode copy of the renderer.

The slot model was written so that container-plus-index already read correctly for a
panel, and deliberately did *not* produce slots nothing could reach — the surface
offered exactly the slots it drew. That is the one E7 learned the expensive way: logic
no test can reach is logic nobody has checked.

## Consequences

- Phase 1's ranking work carried a small extra design obligation (generalize the reorder
  interaction) in exchange for removing a large Phase 3 risk. That paid off in the
  keyboard grammar and the announcement vocabulary, which are reused verbatim.
- **Constraint 3's letter is not met, and its purpose is.** `useReorder` is not the
  vehicle: its contract is one index space where this has two, and it applies live where
  this previews. What the Creator reuses is the grammar — space to grab, arrows to move,
  Escape to abandon, every change spoken into a live region — and `reorderAnnouncement`
  itself, now exported for it. A designer who has used a ranking question already knows
  this interaction. That, not shared code, was what constraint 3 was protecting.
- `creator-core` gains no dependency, and `creator-react` gains none either.
- If a library is ever adopted after all, it is a dependency of `creator-react` only —
  permitted, since UI packages may carry dependencies while core packages may not — and
  it replaces the input adapter without touching the placement model.

## Parent and related links

- [Feature-parity checklist §K2, §K4, §K6, §C9, §J4](../feature-parity-checklist.md)
- [ADR-0002 — round-trip fixed point](./0002-round-trip-fixed-point.md)
- [ADR-0021 — Creator composition](./0021-creator-composition.md)
- [ADR-0022 — design-system primitives](./0022-design-system-primitives.md)
- [North Star §4.3, §11](../NORTH_STAR.md)
