# @kajay/creator-react

## 1.1.1

### Patch Changes

- @kajay/core@1.1.1
- @kajay/react@1.1.1
- @kajay/creator-core@1.1.1

## 1.1.0

### Minor Changes

- b8ccfb9: The Creator shows a drop where it would land, instead of pointing at it.

  Dragging a question, a panel or a page now opens the space the drop would take: a
  placeholder the size of what is being carried appears in the target position, the
  elements around it move out of its way, and the item being moved leaves the place it is
  going to vacate. What is on screen mid-drag is the page the drop is about to produce.
  The question itself follows the pointer, drawn by its own renderer at the width it
  had and hanging from the point it was grabbed by, so a drag is no longer an invisible
  thing being held. A keyboard drag summons none, having no pointer to follow, and a
  toolbox drag carries the type's name — nothing has been created yet to draw.

  The indicator it replaces was a rule drawn between two elements, which a single column
  makes unambiguous and a `colCount: 2` page does not — the geometry has always decided
  left-or-right as readily as above-or-below, and a horizontal line could not draw that
  answer. The placeholder takes a cell of the container's own layout, so the container
  decides which one.

  - `@kajay/react` gains `IdScopeProvider`: the per-`<Survey>` id scoping P7 introduced,
    with nothing else attached, so anything drawing a **second copy** of an element already
    on the page can keep its ids off the original's. Without it both copies emit one set of
    ids and every `label for` in the second resolves to the first.
  - `@kajay/react` gains `PageElementSlotDecoratorProvider`, the sibling of
    `PageElementDecoratorProvider`: it wraps an element's whole layout slot rather than its
    contents, which is the only way to add something a container lays out as one of its own
    children. A panel's children get it with no change to any renderer.
  - `@kajay/creator-core`'s placement snapshot gains `withdrawn` — which element gives up
    its place while a preview stands. Nothing is withdrawn without an active slot, so a drag
    aimed somewhere forbidden, or at the position an element already occupies, leaves it
    exactly where it is.
  - The rearrangement is animated rather than cut to, and the stylesheet decides whether:
    `--kajay-settle-duration` and `--kajay-settle-easing`, with an unset or zero duration
    meaning no motion and no measuring. `prefers-reduced-motion` is honoured regardless.
  - Aiming is fixed in the case it was most used: which axis decides a drop is now a fact
    about the container — whether it puts elements side by side — rather than whichever axis
    the pointer happened to be further out on. Elements are as wide as the canvas, so the old
    rule read a single column as a _row_ almost everywhere, and reaching the end of a list
    meant dragging far below the last question.
  - A drag can always end. Pointer capture is meant to guarantee the release arrives and
    cannot when the handle stops existing mid-gesture — a host re-rendering its tree, or a
    question hidden by logic somebody just edited. A move with no button down,
    `lostpointercapture`, and a window listener held for the length of one drag each end it,
    and all three abandon rather than commit. Without them the element being moved stays
    invisible and the drag never finishes.
  - The design surface now honours the page's `colCount`. The canvas _is_ the page's grid
    and the stylesheet had always read the column count from it, but nothing ever wrote one,
    so a two-column page was drawn in a single column.

- e144a1c: Property explanations are shown on demand instead of always.

  Every property row carried its description permanently, so a question with thirty
  properties gave a panel that was mostly prose. The descriptions are still there — the
  field still points at them with `aria-describedby`, so a screen reader reads them exactly
  as before — and the stylesheet now reveals them when they are wanted: hovering the marker
  beside a property's name, or working in its field, which is how a keyboard and a touch
  reach it.

  The marker is deliberately not a control and takes no tab stop of its own, and the
  explanation appears in place rather than over the row below.

  The expression editor's suggestion popup is no longer rendered when it holds nothing:
  every expression property used to contribute an empty `role="listbox"` to the document.

### Patch Changes

- 7398432: The expression editor's suggestion list closes when you leave the field.

  It opened on a keystroke and shut only on Escape or on accepting a suggestion, so typing
  in `visibleIf` (or any expression property) and then clicking elsewhere left the list
  standing over the property grid indefinitely — attached to a field no longer being edited,
  offering completions for a token nobody was writing.

  Choosing an option with the pointer is unaffected: the options cancel their own
  `mousedown`, so picking one never moves focus out of the field.

- Updated dependencies [b8ccfb9]
  - @kajay/creator-core@1.1.0
  - @kajay/react@1.1.0
  - @kajay/core@1.1.0

## 1.0.0

### Major Changes

- 854a1cd: Kajay 1.0.0 — a survey engine and designer that draw with your components.

  **Surveys that look like your application.** Pass your own `Button`, `Input`, `Select`,
  `Checkbox`, `Radio` and `Textarea` and the renderer draws every control through them. Supply
  as many or as few as you like; the rest fall back to ours, styled by CSS custom properties.
  The Creator takes the same treatment, so the tool your customers build in looks like the
  product it lives in.

  **Every question type you would expect.** Text in a dozen input types, long text, choices in
  five shapes, ratings, ranking, image picker, multiple text, three matrix families, repeating
  panels, file upload, signatures, and computed display values — with logic, validation and
  theming that work the same way across all of them.

  **Logic with a real engine behind it.** A hand-written tokenizer, Pratt parser and printer
  over an explicit dependency graph: conditional visibility, enabling, requirement, computed
  values, triggers and validation all run on one evaluator, and an expression round-trips
  through the printer unchanged.

  **A definition you own.** Plain JSON that round-trips losslessly — parse, serialize, parse,
  unchanged — with a committed JSON Schema generated from the metadata registry, and a
  versioned cross-language contract with an executable conformance corpus so another runtime
  can implement the same behaviour rather than approximate it.

  **Accessible and translatable by default.** Keyboard-operable throughout, labelled and
  announced, swept with axe in real Chromium on every commit; every user-facing string
  localizable, the library's own words replaceable, and right-to-left handled as layout rather
  than as a stylesheet.

  **Licensing.** `@kajay/core`, `@kajay/react` and `@kajay/themes` are MIT.
  `@kajay/creator-core` and `@kajay/creator-react` are under the Functional Source License
  (`FSL-1.1-ALv2`): use them, modify them, self-host them — do not resell them as a competing
  product. Both convert to Apache-2.0 two years after release.

  All five packages share one version and release together, so the version you install for one
  is the version that goes with the rest.

### Patch Changes

- Updated dependencies [854a1cd]
  - @kajay/core@1.0.0
  - @kajay/react@1.0.0
  - @kajay/creator-core@1.0.0
