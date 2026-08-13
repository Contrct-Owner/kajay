# @kajay/creator-core

## 1.3.0

### Minor Changes

- 32a8596: Ask asynchronous expression functions again with `survey.invalidateAsyncResults(name?)`.
  Their results are cached for the life of a survey — which is what stops each
  re-evaluation restarting the call that caused it — and that is right until the world
  those answers describe moves. Naming one function discards only its results; naming none
  discards them all. Everything affected re-evaluates and the answers land as any
  asynchronous answer does.

  **This is also the only way back from a failure.** A rejected call is recorded and never
  retried, so before this a lookup that failed once stayed failed for the life of the
  survey.

  A request already in flight when you invalidate is discarded rather than installed, so a
  superseded reply cannot overwrite the fresher one it raced.

- 9c53307: Tell the Creator which `{$name}` host values a definition will be given, with the new
  `hostValueNames` option on a workspace or design surface. Without it, a definition that
  reads host context is reported as broken on a canvas — the diagnostic is right in general
  and wrong here, because a designer has no host to supply anything.

  **Names, not values.** There is no session, CRM or entitlement service behind a canvas, so
  there is nothing true to show and an invented value would be a fiction a designer could
  come to rely on. A declared name reads as unanswered, exactly as an absent host value does
  at runtime; it simply stops being reported as undeclared.

- 50f2faa: Read host-supplied values from expressions with the new `{$name}` scope. Pass them as
  `parseSurvey`'s `values` option and any expression can read them — `visibleIf`,
  `defaultValueExpression`, a calculated value — including descent into structured values
  such as `{$profile.plan.tier}`. Host values are not answers: they never appear in
  `data`, in progress, or in a response snapshot, and a respondent cannot overwrite them.

  Two new definition diagnostics come with it. An expression naming a value the host did
  not supply is reported as a **warning**, because it may legitimately be supplied later,
  and it evaluates as unanswered rather than as an empty string. An element whose `name`
  starts with `$` is reported as an **error**: the sigil is now reserved, and such an
  element cannot be reached from any expression. The authored name is kept rather than
  rewritten, so definitions and recorded responses are unaffected.

- 85e9dfc: Update host values during a session with `survey.setHostValue(name, value)`. Everything
  reading the value recomputes before the call returns — conditions, calculated values,
  and the status templates — inside one settle, so a listener woken by the change sees a
  model that has finished reacting to it.

  Writing the value already in force does nothing at all, so a host that refreshes its
  context on a timer cannot make the survey re-evaluate for a value that did not move.

  A host value change is deliberately **not** reported through `onValueChanged`: that
  event means an answer changed, and a host value is in no response for a listener to go
  and read. What the respondent can see change is announced as element state, as always.

### Patch Changes

- 988f7b0: Resolve `{$name}` host values in `completedHtml`, `loadingHtml`, `emptyHtml`, and a
  conditional ending's `html`, not only in expressions. A completed page can now say
  "Thank you, {$tier} customer" and mean the value the host supplied, where it previously
  rendered blank.

  A host reference is resolved whole, so `{$profile.plan.tier}` descends in a template
  exactly as it does in an expression. Answer placeholders are unchanged and are still
  looked up by flat name. Values are escaped on the way in, as every interpolated value
  already was.

- 4a2ebf4: Include focused package READMEs that link each published SDK surface to its consumer
  guides and generated reference.
- Updated dependencies [32a8596]
- Updated dependencies [9c53307]
- Updated dependencies [50f2faa]
- Updated dependencies [85e9dfc]
- Updated dependencies [988f7b0]
- Updated dependencies [39b37ff]
- Updated dependencies [4a2ebf4]
  - @kajay/core@1.3.0

## 1.2.0

### Minor Changes

- 068eaea: `DesignSurfacePanel` takes an optional `onEditProperties`, which adds a "Properties" item
  to every element's actions menu and reports the presses.

  For hosts whose property grid is not permanently on screen. A sidebar layout needs nothing
  here — selecting an element is already the whole gesture, because the grid is right there.
  A layout that keeps the grid behind a sheet or a route has no such affordance, so the only
  way to reach an element's properties was a control somewhere other than the element it is
  about; on a phone that means scrolling away from the question to open a panel describing
  it.

  Reported rather than performed, like a toolbox pick: the panel cannot know where a host's
  property grid is, so a menu item that opened one would be the piece deciding a layout it
  cannot see. Absent rather than disabled when no host wired it, since an item that reports
  to nobody does nothing when pressed.

  Adds the creator string `properties`. Existing menu items keep their order and their ids.

- b6a3d31: `SurveyCreator` gets a compact designer on narrow screens.

  Below 60rem the assembly used to stack its three panels, and stacking put the toolbox
  first: a designer on a phone opened their survey and found thirty question types where it
  should have been, then scrolled past all of them to reach the thing they came to edit.

  The canvas now takes the full width, and the toolbox and property grid move behind two
  buttons that open a modal `<dialog>` anchored to the bottom of the viewport. The action bar
  is sticky, so it stays in reach however long the survey grows, and lets go where the
  designer ends rather than floating over the rest of a host's page. The toolbox shuts itself
  on a pick; the property grid does not, because editing properties is a run of changes
  against one element. Selecting an element deliberately does not open a panel — adding a
  question selects it, so a panel that opened itself would cover the canvas at the moment the
  designer wanted to see what landed. Its own actions menu offers "Properties" instead, via
  the `onEditProperties` seam.

  A real `<dialog>` opened with `showModal()`, so the focus trap, Escape, the inert
  background and the backdrop come from the platform rather than from a dependency this
  package does not have.

  Which layout is measured rather than styled, because the two are different component trees
  and rendering both would put two toolboxes in one document. The threshold matches the
  stylesheet's own and is written in both places, each pointing at the other.

  Adds the creator strings `toolbox`, `addQuestion` and `closePanel`. Nothing at or above
  60rem changes.

### Patch Changes

- @kajay/core@1.2.0

## 1.1.1

### Patch Changes

- @kajay/core@1.1.1

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

### Patch Changes

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
