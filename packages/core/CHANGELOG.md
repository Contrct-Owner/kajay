# @kajay/core

## 1.1.0

## 1.0.0

### Major Changes

- Add definition-bound Response Snapshot Format v1 capture, JSON parsing, and silent
  restore. Snapshot values recursively preserve absent values and UTC instants, timers
  count offline time, and a shared corpus proves equivalent TypeScript and C# storage.

- Use Kajay's invariant decimal grammar for expression numeric coercion. Hexadecimal,
  binary, octal, empty, locale-formatted, and non-finite text no longer acts as a number,
  booleans no longer coerce to zero or one, and arithmetic overflow produces an absent
  value instead of a non-finite JavaScript number. Equality now follows Kajay value kinds
  instead of converting unlike values to host-language text. Explicit expression text
  conversion uses invariant Kajay spellings rather than host defaults, and never
  implicitly stringifies arrays or objects.

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
