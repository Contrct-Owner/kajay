# @kajay/core

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

- 39b37ff: Announce a failed URL choice load, so a view can show it. A recorded `choiceErrors` entry
  changed nothing a reader could see: nothing told the renderer to look again, so a question
  whose choices could not load was indistinguishable from one still loading them. Both
  failure paths — a rejected fetch and a missing fetcher — now reach the same renderer
  channel a successful load does. Choices from an earlier successful load are kept rather
  than cleared, since a stale list is more use than an empty one and the error says which
  attempt failed.
- 4a2ebf4: Include focused package READMEs that link each published SDK surface to its consumer
  guides and generated reference.

## 1.2.0

## 1.1.1

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
