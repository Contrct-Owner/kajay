# @kajay/react

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
