# ADR-0009 — Creator drag-and-drop implementation

- Area: Creator interaction
- Status: deferred (decide in Phase 3 planning)
- Owner: Jarod
- Last updated: 2026-08-02

## Context

Checklist K2 requires drag from the toolbox onto the design surface plus drag
reordering of questions, panels, and pages, with drop indicators. Whether to hand-roll
this or adopt a library is genuinely a Phase 3 question — it depends on what
`creator-core`'s surface tree looks like by then.

Deferring is only safe if the decision stays cheap. This ADR records the constraints
that keep it so.

## Decision

**Defer the implementation choice to Phase 3 planning.** Bind three constraints now.

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

## Consequences

- Phase 1's ranking work carries a small extra design obligation (generalize the
  reorder interaction) in exchange for removing a large Phase 3 risk.
- If a library is adopted in Phase 3, it is a dependency of `creator-react` only —
  permitted, since UI packages may carry dependencies while core packages may not.
- If these constraints are violated — for example drop-target logic leaking into
  React components — the deferral stops being cheap and this ADR should be decided
  early instead.

## Parent and related links

- [Feature-parity checklist §K2, §C9, §J4](../feature-parity-checklist.md)
- [North Star §4.3, §11](../NORTH_STAR.md)
