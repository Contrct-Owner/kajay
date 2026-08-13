# @kajay/themes

## 1.4.0

### Minor Changes

- 18027b2: The Creator's blanks editor is a real editor. Its type picker offers the six types that can
  sit in a line of prose — text, dropdown, multi-select, yes/no, rating, computed — rather
  than all nineteen concrete question types, most of which the parser refuses as
  `non-inline-blank` the moment they are added.

  More importantly the sentence now moves with the collection: adding a blank positions it,
  deleting one takes its marker out, and renaming one carries the marker along. Three of the
  four ordinary editing operations used to leave the prose behind, two of them producing a
  definition that does not parse. A marker is written into every language, because it is a
  name rather than words and a translation naming a different set of blanks is its own error.

  A child collection can now declare `markerProperty` — the owner's property whose `[[name]]`
  markers position its children — which is the one registry fact all of that reads.

  Renaming a blank did not rewrite `{q1.capital}` in expressions when this landed — an older
  hole in every nested rename, fixed in the same release.

- c959cc6: A fill-in-the-blank gap can now be a computed value: "we have [[seats]] seats, which is
  [[annual]] a year". A blank's rules are registered with the logic graph like a matrix
  cell's, so a computed gap recomputes when the gap it reads changes — and a `setValueIf`,
  `resetValueIf` or `defaultValueExpression` on any blank now works for the same reason.

  A blank's expression names the whole path, `{plan.seats}` rather than `{seats}`, because
  that is where the answer lives and how a multiple-text field is already read from anywhere
  else.

  The .NET runtime did not compute `expression` questions at all when this landed, so a
  computed gap was empty there; that older gap is fixed in the same release.

- b069d9e: Register the `fillintheblank` question type and the blanks it positions. A template is
  prose carrying `[[name]]` markers, and a `blanks` collection declares what each name
  means — its label, its correct answer, and how it is matched.

  The type parses, round-trips, appears in the survey schema and the Creator toolbox with
  starter content, draws its gaps inside the sentence with each one named to a screen
  reader, and marks a mark per blank — partial credit, since a sentence with four gaps is
  four decisions wearing one question. Quiz membership is asked of the blanks rather than
  of the question, which inherits a `correctAnswer` that means nothing here.

  Three definition diagnostics come with it. A `[[name]]` the question does not declare is
  an error; a declared blank the template never positions is a warning; and a translation
  naming a different set of blanks than the default is an error — a translation may move a
  blank within the sentence, which is why the template is a translatable string, but
  renaming, dropping or inventing one would make the answer keys depend on the language the
  respondent happened to read.

  Still to come: the C# runtime and the conformance cases.

  Matching defaults live on the descriptors, so a blank trims surrounding whitespace and
  ignores case unless it says otherwise — an assessment marking `paris` wrong is measuring
  typing rather than geography.

- b7950de: A gap in a sentence is now drawn from the same parts as the control on a line of its own,
  and a theme says which way round its colours run.

  - **A theme declares its `colorScheme`**, published as `--kajay-color-scheme` and spent by
    the stylesheet as `color-scheme`. It is the only thing that reaches the parts of a
    control no stylesheet can: the list a `<select>` opens, the tick in a checkbox, the
    scrollbars. A dark survey that never said so opened a **white** list full of its own pale
    text, in every dropdown, inline or not.
  - **A yes/no gap is the switch the block renderer draws** — the host's `Checkbox`
    primitive wearing `kajay-boolean__switch` — rather than a bare `<input type="checkbox">`
    no design system had ever styled.
  - **A choice gap is the block dropdown's select**: same class, same rows, same read-only
    behaviour. Two bugs came with the old copy — a choice authored as `1` came back as
    `"1"`, because the answer was read straight off `event.target.value`, and a read-only gap
    was `disabled`, which drops it out of the tab order instead of leaving it readable.
  - **A placeholder is a prompt, not a choice.** It is hidden from the list in both
    renderers: visible, "a department" sat between Engineering and Design and read as a
    department of that name. A question that may go unanswered keeps a blank row, because a
    native select has no undo.

  `ChoiceOptions` is now shared by both renderers, which is what stops the two drifting apart
  again.

- c90e3bb: A gap in a sentence is now laid out like part of the sentence.

  - **One height** for the text field, the dropdown and the multi-select. They are three
    native controls whose default heights differ by a few pixels, and they aligned on their
    baselines, so the dropdown sat low and the line wobbled. They now share a height and
    align on their middles, and a checkbox takes its size from the words rather than staying
    a 13px square.
  - **A gap is as wide as what it is for.** `size` on a blank and `blankSize` on the sentence
    were registered properties that nothing read, so every gap was the browser's default of
    twenty characters — a two-digit seat count claimed as much of the line as a full name.
    The renderer resolves them (a blank's own `size` wins) and publishes the result as
    `--kajay-blank-size`; where the browser supports `field-sizing`, an unsized gap now grows
    with what is typed into it.
  - **`placeholder` reaches an inline gap**, in the text field and as the dropdown's empty
    option, as it always did in the block renderers. An empty gap can now say what goes in it.
  - **A computed gap keeps its place while it is empty.** It collapsed to nothing, so the
    sentence read "which is seat-months a year" — a hole a reader takes for a typo.
  - **An error is read as part of the sentence.** `.kajay-question__errors` is a flex column,
    and one dropped between two words tore the line in half and stretched the gap to the
    width of the message.

  The theme's inline rules are deliberately two classes deep so a host design system's own
  input height does not leave one control in the sentence taller than its neighbours.

- 2142db3: The multi-select gap in a sentence is no longer a native `<select multiple>`.

  It was the one control in a sentence whose _contents_ the browser drew for itself — in
  Chrome a popup whose checkbox glyphs follow neither `color-scheme` nor any rule a
  stylesheet can write, in Firefox a one-line scroller — so it was the one gap a theme could
  not reach. A dark survey showed white boxes down a dark list, two lines below a checkbox
  group that themed perfectly.

  It is now a disclosure over the host's own `Checkbox` primitive, one per choice: the same
  control the block checkbox group draws, so a design system's checkbox reaches a sentence
  too. A button says what was chosen in the author's words, `aria-expanded` says whether the
  choices are showing, and the menu is a popover in the top layer — a survey lives inside
  somebody else's layout, and an absolutely positioned menu is cut off by the first ancestor
  that hides its overflow.

  A theme also declares `accent-color` now, alongside `color-scheme`: the two together are
  what reach the parts of a native control no rule can select — the tick in a checkbox, the
  dot in a radio, the fill of a range.

- 4bc55e8: Draw fields inside a sentence. A fill-in-the-blank's blanks are questions, so a gap can be
  a dropdown, a multi-select, a yes/no, a rating or a computed value — a form authored by
  writing a sentence rather than a row of boxes under a label.

  Register how a type is drawn inline with `registerInlineQuestion(type, renderer)`. It is a
  second registration rather than a mode on the existing one: absent by default, so a type
  that cannot sit in a line of prose is refused by the definition and simply has no inline
  renderer, and no renderer a host has already written has to learn a case it never heard of.

  Inline controls are deliberately plainer than their block equivalents — a dropdown with
  search and lazy paging does not belong in the run of a clause. A host that wants the fuller
  thing registers its own.

- d282e5b: Renaming a _nested_ thing in the Creator now carries the references to it. A name is
  written in two syntaxes — `{who}` names a question outright, `{plan.seats}`,
  `{grid[0].size}` and `{row.size}` name something inside one — and only the first was ever
  followed. Renaming a blank, a matrix column or a question in a repeating panel left a
  survey that still parses, still renders and quietly stops working. Duplicating a matrix was
  worse: its columns were renamed, so `{row.size}` in the copy named a column that had just
  been renamed out from under it.

  The rewrite is qualified rather than textual: a tail moves only under the owner that holds
  the renamed child, or under the owner's record word inside the owner itself. Rewriting
  every `.size` in every expression would have corrupted `{$profile.size}` — a host value
  with a key of that name and nothing to do with the rename.

  A repeating type now publishes its record word as `recordScope` on its registration —
  `row` for a matrix, `panel` for a repeating panel — so an authoring tool can read the
  language's word instead of keeping a copy of it.

### Patch Changes

- aecec7b: The .NET runtime now computes `expression` questions, on a page and in a sentence. It never
  had: one was built as a plain scalar with no rule behind it, so it stayed empty for ever and
  any survey holding one answered differently in the two runtimes. An expression question is
  now the calculated value it always was — same graph, same ordering — and a computed gap
  writes inside its sentence's answer at `plan.annual`, exactly where TypeScript puts it.

  A calculated value with no result is also no longer carried in the .NET response. An
  untouched survey used to answer `{ "total": absent }`, an entry TypeScript has never had; the
  value is still recorded and still readable through `TryGetCalculatedValue`.

  Two conformance scenarios now hold both runtimes to it. No TypeScript behaviour changes here.

- 64bd0c2: Fill-in-the-blank is now implemented by both runtimes, and the conformance corpus carries
  the cases they have to agree on: the template round-trips with its markers, and a
  translation that renames a blank is refused in either language.

  No TypeScript behaviour changes here — the corpus and the native SDK caught up with it.

- a10593b: Show the field kinds a sentence can hold. The playground gains an examples list with a
  fill-in-the-blank whose every gap is a different question — text, dropdown, multi-select,
  rating and yes/no in one sentence.

  `expression` is no longer allowed inline. It reads well mid-clause, but a blank's rules are
  not registered with the logic graph, so a computed gap would draw an empty space for ever;
  the definition refuses the type rather than letting it silently do nothing.

  An inline multi-select is one row tall and scrolls, instead of opening into a list box that
  pushes the sentence apart.

- 4cb8d65: The playground can show the response as well as the definition. The live survey pane has an
  Answer/JSON switch, and the JSON is `survey.data` — the shape a host posts to its own
  backend — updating as the survey is answered.

  It is a view rather than a mode: the form stays mounted while hidden, so a half-typed field
  keeps its caret and its scroll position while a visitor looks at what it produced.

  No library behaviour changes here; this is the reference application showing what it
  already had.

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

## 1.2.0

### Minor Changes

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

## 1.1.1

### Patch Changes

- cb45648: A group question's title no longer wraps in Firefox.

  Seven question types draw their title as a `legend`, because a control that is a _group_
  needs a fieldset for the title to be the group's name. A legend is not laid out like its
  siblings: engines shrink it to its own content rather than giving it the box's width, and
  Firefox then rounds that a fraction under what the text measured — so `How was it?` broke
  in half with hundreds of pixels free beside it, while Chromium rendered it on one line.

  The title now takes the width of its box, in every engine.

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
