# ADR-0021 — Creator composition: pieces, with a default assembly on top

- Area: Creator UI surface
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-03

## Context

Phase 3 builds the Creator. The model half is already settled: `@kajay/creator-core`
is headless and the architecture check enforces it — it may depend only on
`@kajay/core`, and it is a core package, so it stays DOM-free and dependency-free.
[North Star §4.3](../NORTH_STAR.md) puts the toolbox model, the surface tree,
selection, the drag-drop model, the property-grid view-model, undo/redo and JSON sync
there, and [ADR-0009](./0009-creator-drag-and-drop.md) already binds drop-target logic
to it.

What is not settled is what `@kajay/creator-react` *exports*. A survey is inputs and
labels; a Creator is a toolbox, a design surface, a property grid, tabs, adorners and
modals. An implementing application that adopts it will want it to look like their
application and sit inside their layout — a property grid docked in a panel they
already have, a toolbox in a sidebar they already own.

The choice has to be made before K1 and K3 are built, because those two rows *are*
the boundary the answer draws. A monolith retrofitted for composition is a rewrite,
not a refactor, and the single version train ([ADR-0005](./0005-single-version-train.md))
means whatever ships at 1.0.0 is public API.

## Decision

**`@kajay/creator-react` exports the pieces. A default assembly ships on top of them,
built from nothing but those exports.**

The pieces — the toolbox, the design surface, the property grid, and whatever §L–§N
adds — are the unit of composition. `<SurveyCreator>` arranges them the conventional
way for the hosts that want the conventional designer. All of it comes from the one
root entry the package already has ([ADR-0010](./0010-package-manifest-and-distribution.md));
these are named exports, not subpaths.

Five constraints make that more than a statement of intent.

### 1. Every piece takes the creator model as a prop

No provider, no hidden context requirement, no ordering trap. A piece is
`<Toolbox creator={creator} />`, the way a survey is `<Survey model={model} />`. Two
pieces rendering the same model agree because they read the same model, not because
they talk to each other — which is exactly what lets a host put them in different
corners of their own layout, and what keeps a second framework adapter possible.

A host with a deep tree can add a context of their own. The library does not need one
and will not require one.

### 2. Pieces hold no state

Selection, expansion, the drag in progress, the undo stack: all of it lives in
`creator-core`. A piece that remembered something would be a second source of truth
the moment a host rendered two of them, or none.

### 3. The default assembly gets no privileged access

`<SurveyCreator>` is written against the same public props a host would use. If it
ever needs something the pieces do not expose, that is a **missing export**, not a
special case for the assembly.

This is the constraint that keeps the pieces real. Without it the assembly quietly
accretes internals, the pieces rot into things nobody can actually use alone, and the
composability is a claim in a README.

### 4. Layout belongs to the host

The assembly ships a layout; a piece ships none. A piece sizes itself to its container
and never positions itself on the page — no fixed widths, no absolute positioning
against the viewport, no assumption about what is beside it.

### 5. Pieces draw through the primitive seam, not out of raw markup

A host adopting this into an application built on shadcn/ui, ReUI or Tailwind wants the
Creator's buttons, inputs and dialogs to be *their* components, not ours restyled.
[ADR-0022](./0022-design-system-primitives.md) is that seam, and every piece here is
built on it — the pieces decide *what* is on screen, the primitives decide what it is
made of.

The token contract ([design-tokens.md](../design-tokens.md)) still applies, and still
matters for the hosts who want the shipped look. It is the floor, not the ceiling.

## Consequences

- **Two things to keep honest, not one.** The assembly is the tested path for most
  hosts, and the pieces are the promise. Both need proof: an E2E scenario for the
  assembled Creator, and at least one for a host arrangement that is deliberately not
  the default. Without the second, nobody notices the day a piece stops working alone.
- **More public surface, sooner.** Each piece's props are API from 1.0.0. The
  mitigation is that pieces are thin — they take a model and draw it — so their props
  are close to `{ creator }` and stay small by construction.
- **The assembly is a real component with real value**, not a demo. Most hosts will use
  it, and it is where the conventional keyboard model, focus order and adorner
  behaviour live.
- Constraint 3 makes drift detectable in review: a pull request that adds an internal
  import to `<SurveyCreator>` is visibly doing the thing this ADR forbids.
- If constraints 1–3 are violated, this decision has been reversed in fact whatever
  the document says, and the honest response is to amend it rather than to keep the
  claim.

## Alternatives considered

- **One `<SurveyCreator>`, styled through tokens and class overrides.** The renderer's
  contract applied again — cheap, consistent, and enough for looks. Rejected because a
  Creator's problem is not only colour: a host that wants the property grid inside a
  panel their application already owns cannot get there from a class name.
- **One component with slots or render props.** Rejected: slots are a second and weaker
  composition system bolted to the first, and they still do not let a piece live
  somewhere else in the host's tree.
- **Pieces only, no assembly.** Rejected: most hosts want the conventional designer, and
  making everyone assemble it means everyone assembles it slightly differently, the
  documentation describes none of those, and the keyboard model has no single home.
- **Headless-only `creator-react` — hooks and nothing drawn.** Rejected for Phase 3: it
  hands the entire designer UI back to every host, which is the work they adopted the
  library to avoid. Hooks over the same models remain open as an addition, not a
  replacement.

## Parent and related links

- [North Star §4.3](../NORTH_STAR.md)
- [ADR-0005](./0005-single-version-train.md)
- [ADR-0009](./0009-creator-drag-and-drop.md)
- [ADR-0010](./0010-package-manifest-and-distribution.md)
- [Design tokens](../design-tokens.md)
- [Feature-parity checklist §K](../feature-parity-checklist.md)
