# ADR-0009 — Creator drag-and-drop implementation

- Area: Creator interaction
- Status: accepted, amended
- Owner: Jarod
- Last updated: 2026-08-09

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

### 6 — The complete placement lifecycle belongs to the design surface

`DesignSurface.placement` owns a closed headless session with three entry points: an
immutable `snapshot`, a semantic `transition` command, and a placement-specific
`subscribe` signal. The command grammar covers atomic placement, preview start, aiming,
keyboard stepping, commit, and abandon. Source discovery, origin, valid traversal,
no-op and refusal policy, active slot, stale-preview invalidation, history/selection
coordination, and structured narration facts are model behavior.

The placement signal is deliberately separate from `DesignSurface.onChanged`. Pointer
aiming changes a preview, not the authored definition; publishing it as a document
change would make persistence and preview subscribers react to pointer motion. A
successful commit installs the final idle placement snapshot and the edited definition
atomically, then publishes one surface change followed by one placement change.
Narration positions and totals are computed from the pre-edit definition so a new or
cross-container item is counted exactly once.

The React adapter retains only browser concerns: pointer capture, DOM geometry,
key-to-command translation, focus, ARIA state, drop-indicator drawing, and formatting
the structured narration facts into localized text. `DesignSurface.place` remains a
compatibility facade over the same atomic placement command; it is not a second
implementation.

### 7 — The indicator is a reserved space, not a mark (amendment)

**A drop is drawn by putting the thing where it would go and letting the container move
around it.** A placeholder the size of what is being carried takes the active slot as a
cell of that container's own layout; the element being moved gives up its place for as
long as the preview stands.

The line this replaces was not merely plain, it was **less expressive than the model
behind it**. Decision 2 made the active slot a number, and the geometry that picks it has
decided left-or-right as readily as above-or-below since the day panels became targets —
it chooses along whichever axis the pointer is further out on. A horizontal rule cannot
draw "left of this one", and the end-of-list marker spanned every column, so in a
`colCount: 2` page it pointed at a whole row whichever half was meant. The indicator was
answering a coarser question than the drop was.

Three things follow, and each was forced rather than chosen:

- **A second decorator seam, on the slot rather than in it.** A container is a grid whose
  items are the layout slots (I5), so an indicator drawn *inside* a slot is inside a cell:
  it can push one element down and it cannot take a cell of its own. `PageElementSlot`
  therefore gained a decorator applied around itself, beside the one from decision 5 that
  wraps an element's contents. Two seams, because they wrap genuinely different things —
  an adorner belongs to an element and travels with it, a placeholder belongs to the
  container and is one of its children. Panels needed no change again, for decision 5's
  reason: the slot is still the one wrapper every page element passes through.
- **Withdrawal is model state, not a rendering trick.** `PlacementSnapshot.withdrawn` says
  which element stands aside, because a preview showing where a drop would land is showing
  the survey as it *would be*, and the thing being moved is in one place in that survey
  rather than two. Every adapter has to answer this identically or they disagree about
  what a drag looks like. Nothing withdraws without an active slot: an aim at a forbidden
  or no-op position must leave the element where it sits, since "nothing would happen" and
  "your question has vanished" are not the same answer.
- **Standing aside is never unmounting.** The obvious way to take an element out of the
  layout is to stop rendering it, and it ends the drag: the handle inside it is holding the
  pointer capture the gesture is being delivered through. The slot keeps its DOM and gives
  up its box, which is also why the geometry now skips withdrawn slots — an element with no
  visible box must not keep a hit area at whatever corner its collapsed box lands in.

**None of this applies the edit**, so decision 4 stands unchanged. A display order is not a
structural edit: it re-parses nothing, mutates nothing and pushes no history. The rule
decision 4 protects is that a drag previews and commits *once*, and it still does.

### 8 — What the pointer carries is a chip, not the element (amendment)

The placeholder says where a drop would land. A ghost beside the pointer says *what* is
being dropped, and without one a drag is still an invisible thing being held: the canvas
opens a space and nothing at all is attached to the cursor, so the gesture reads as pushing
the page around rather than carrying something across it.

**Lifting the real element under the pointer was the tempting version**, and it is worse
three times over. A full-size question follows the cursor across the very canvas it is
being aimed at, covering the thing it is being aimed *into*. The element cannot be under
the pointer and back in its place at the same time, and being back in its place is how
decision 7 says "this drop would change nothing". And cloning its markup would put a second
copy of every `id` in the document — the defect P7 removed everywhere else. What is being
carried is already drawn twice, at full size in the placeholder and in words in the live
region, so the ghost's job is to say *held*.

**It is written to the DOM, never through React state.** A ghost follows the pointer, so
its position changes on every `pointermove` — and publishing pointer motion as state is the
thing decision 6 separated the placement signal to avoid. Two custom properties on one node
re-render nothing, and the node is the input adapter's own furniture rather than anything
the model knows about.

**Still no portal.** Decision 1 objected to a drag library owning a portal and a drag layer
underneath a decision to leave markup to the host, and that objection would apply to us. The
ghost is an ordinary child of the design surface, positioned against the viewport — so it
paints over the toolbox and the page navigator without leaving the Creator's own tree. Where
those coordinates start from is **measured rather than assumed**: a `position: fixed` node is
placed against the viewport unless an ancestor carries a transform, a filter or
`will-change`, and nothing here can know whether a host's layout does. Reading the ghost's
own box at the grab answers it, which is also why the node is mounted for the whole session
rather than appearing with the drag — an element that arrives with the gesture cannot be
measured until a frame into it.

**One ghost, drawn by the canvas.** A drag can begin in the toolbox or the page navigator,
and each piece rendering its own would give the pointer two things to follow and one ref for
both to fight over. The canvas is the piece present whenever anything is being placed.

**Found by building it: the canvas had never had columns.** The design surface is the
page's grid and the stylesheet had always read `--kajay-col-count` from it, but only
`SurveyPage` ever wrote one — so every canvas was a single column and the two-column case
this decision exists to serve could not be reached at all. The test that should have
caught it asserted `startWithNewLine`, which is a property of an element rather than of the
grid it sits in. A row about *where a drop lands* is what surfaced it, because a
placeholder that takes a cell has nothing to say on a surface that only ever has one.

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
- A second framework adapter can reuse the entire placement lifecycle without copying
  React state. Its remaining work is geometry, input translation, focus/ARIA, drawing,
  and narration wording.
- **The rendering seam now has two decorators, and that is a cost worth naming.** A host
  reading `@kajay/react`'s surface meets both and has to work out which one they want. The
  alternative was widening the first until it could return the slot as well, which would
  have moved the adorner outside the layout wrapper and taken I5's `width` and
  `startWithNewLine` with it — a layout bug in design mode in exchange for one fewer name.
- If a library is ever adopted after all, it is a dependency of `creator-react` only —
  permitted, since UI packages may carry dependencies while core packages may not — and
  it replaces the input adapter without touching the placement model.

## Parent and related links

- [Feature-parity checklist §K2, §K4, §K6, §C9, §J4](../feature-parity-checklist.md)
- [ADR-0002 — round-trip fixed point](./0002-round-trip-fixed-point.md)
- [ADR-0021 — Creator composition](./0021-creator-composition.md)
- [ADR-0022 — design-system primitives](./0022-design-system-primitives.md)
- [North Star §4.3, §11](../NORTH_STAR.md)
