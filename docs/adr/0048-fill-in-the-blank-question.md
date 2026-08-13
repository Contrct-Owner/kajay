# ADR-0048 — Fill-in-the-blank: prose positions the blanks, a collection declares them

- Area: Core / question types and assessment
- Status: accepted, amended
- Owner: Jarod
- Last updated: 2026-08-13

## Context

A fill-in-the-blank question is a sentence with gaps the respondent types into, inline:

```text
The capital of France is [[capital]] and its currency is the [[currency]].
```

Its home is **assessment** — language and comprehension testing, where the surrounding
sentence *is* the question and a separate label would repeat it. That is the driver here,
which makes correct answers and partial credit first-class rather than a later addition.

It is the first promotion out of [§O](../feature-parity-checklist.md#o--watch-items-surveyjs-2026-roadmap-not-acceptance),
whose rule is to promote only with evidence a real consumer needs it.

### What already exists, and why it is not enough

`multipletext` (C11) is structurally very close: several named inputs under one question,
stored as **one object keyed by item name**, with per-item validation. An `html` element
renders arbitrary prose. Between them they cover everything except the one thing that
defines this type: **interleaving**. `multipletext` puts labels beside boxes in a layout;
a fill-in-the-blank puts boxes *inside a sentence*, positioned by the author's prose.

That cannot be composed from an `html` block plus questions, because the inputs must land
within the text rather than after it.

Scoring, on the other hand, needs nothing new. `AnswerScore` is already `{correct, total}`
and `scoreSelection` already awards a mark per expected item, so N blanks scoring N marks
is the existing model applied, not extended.

## Decision

**A `fillintheblank` question whose `template` is prose carrying `[[name]]` markers, with
a `blanks` child collection declaring what each name means.**

```json
{
  "type": "fillintheblank",
  "name": "geography",
  "template": "The capital of France is [[capital]] and its currency is the [[currency]].",
  "blanks": [
    { "name": "capital", "label": "Capital city", "correctAnswer": "Paris" },
    { "name": "currency", "label": "Currency", "correctAnswer": "Euro" }
  ]
}
```

### 1. `[[name]]`, not `{name}`

The braces already carry three meanings — `{answer}`, `{@endpoint}`
([ADR-0017](./0017-choices-url-environment-portability.md)) and `{$hostValue}`
([ADR-0047](./0047-host-value-scope.md)). A blank would be a fourth, and it is the
*inverse* of the first: in `completedHtml`, `{capital}` means **substitute** the answer of
that name; in a template it would mean **collect** one. Two opposite operations behind one
syntax, told apart only by which property they sit in, is the mistake ADR-0017 refused when
it gave endpoints their own sigil rather than overloading the answer scope.

`[[name]]` also needs no tokenizer change anywhere, because a template is never parsed as
an expression.

**A literal `[[` needs no escape.** `[[` opens a blank only when it is followed by a valid
name and `]]`; anything else is text. That is forgiving by default and costs one stated
limit: prose that genuinely contains `[[capital]]` and means it literally cannot say so.
An escape character would put a backslash rule into authored prose — and into every
translator's copy of it — to serve a case no assessment has.

### 2. The template is one localizable string, never a segment array

The obvious alternative is structured: `segments: [{text}, {blank}, {text}]`. **It is
untranslatable.** Word order moves between languages — the blank falls in a different place
in German, and elsewhere again in Japanese — so a translator has to *move the blank within
the sentence*. In a string they can. In an array they would have to restructure JSON, which
is not a thing translation tooling or translators do.

So `template` is one `isLocalizable` string, and the blanks are positioned inside it.

### 3. Blank names are stable identifiers inside translatable prose

Which creates the risk the previous decision buys: a translator can rename, drop or add a
`[[name]]`, and the answer keys for that locale silently change. A response recorded in
French would then carry keys no other locale produces.

**A locale whose template declares a different set of blank names than the default is a
definition diagnostic at error severity.** Not a warning: the definition is not merely
suspicious, it produces different data depending on who is reading it, and that is
discovered — if ever — long after the responses are collected.

### 4. The collection declares; the template positions

Per-blank facts have nowhere to live in prose, so they live in `blanks`, exactly as
`multipletext` keeps `multipletextitem`. Each blank carries `name`, a localizable `label`,
`correctAnswer`, `inputType`, `isRequired`, and the matching options in §6.

Two diagnostics fall out, and both are worth having:

- a `[[name]]` the collection does not declare is an **error** — it would render an input
  whose answer nothing can score, validate or label; and
- a declared blank the template never positions is a **warning** — harmless to a
  respondent, who simply never sees it, but almost always an author's mistake.

### 5. One answer object, keyed by blank name

`{ "geography": { "capital": "Paris", "currency": "Euro" } }` — C11's shape, so per-blank
validation, `valueName`, and clearing behave as they already do for multiple-text items
rather than by new rules. Duplicate names within one template are refused; a blank that
should mirror another says so with `valueName`, which is the mechanism that already exists
for sharing an answer key.

### 6. Matching is trimmed and case-insensitive by default, per blank

An assessment marking `paris` wrong because the respondent did not capitalize it is
measuring typing, not geography. Both are **per blank**, because the same question may hold
a prose answer and a case-sensitive code:

- `trim` — default true;
- `caseSensitive` — default false.

Anything richer — accent folding, alternative accepted answers, numeric tolerance — is
deliberately **not** in this decision. `correctAnswer` is `json` today and a list of
accepted answers is the obvious next request; it is cheap to add later and impossible to
remove, so it waits for a consumer.

### 7. Each blank is named for a screen reader

The sentence labels a blank visually and not programmatically: without help, a screen
reader announces "edit text, blank". Each input takes its accessible name from the blank's
`label`, and a sweep in real Chromium proves it. The respondent who most needs the sentence
read to them is the one a naive implementation serves worst, which is why this is a
decision here and not a rendering detail.

**Amended 2026-08-13, on building the renderer.** This first said the label was *rendered
visually hidden*, and that was wrong in a way the browser suite caught immediately: hiding
it takes a stylesheet, `@kajay/themes` is an explicit opt-in that no package imports, and a
host that had declined it would see every label printed inside the prose — "The capital of
France is Capital city ...". The accessible name is an `aria-label` on the input instead,
which adds no text at all. **An accessible name must not depend on CSS anyone can decline
to load**, and the suite that loads no stylesheet is precisely the condition that proves
it.

### 8. Both runtimes, this cycle

Template parsing, the answer shape, the diagnostics and the scoring are all
language-neutral behaviour, so they belong in the conformance corpus — and a corpus case
one runtime cannot run is a one-sided specification
([ADR-0047](./0047-host-value-scope.md) learned this the expensive way). `Kajay.Core`
implements it in the same cycle, and the corpus cases land **after** both runtimes so they
arrive claimed by both.

## Alternatives considered

**Reuse `{name}`.** Rejected above: it is the inverse operation behind identical syntax.

**A segment array instead of a template string.** Rejected: untranslatable, per §2. This is
the decision most likely to look over-thought until the first non-English locale arrives.

**Blanks declared purely inline**, with properties encoded in the marker
(`[[capital:Paris]]`). Rejected. It puts correct answers into the string a translator
edits — so a translation can change the marking — and it grows a second, cramped property
syntax inside prose the moment anything needs a third attribute.

**Reuse `multipletext` with a layout hint.** Rejected: the position of a blank is *inside a
sentence*, and no layout property expresses that without becoming a template anyway.

**Defer scoring to a later row.** Rejected because assessment is the stated driver: a
fill-in-the-blank that cannot be marked is the feature's least interesting half.

## Consequences

- **The first §O promotion**, so §O loses a line and §C gains a row with named proofs, and
  the roadmap gains a Phase 4 workstream with an exit gate.
- **New contract surface**: a question type, a child collection, and three diagnostics —
  the schema, metadata and diagnostic contracts all regenerate, unlike ADR-0047 which
  touched only the diagnostics.
- **The Creator needs a blanks editor**, and K1's rule applies: a dropped
  `fillintheblank` must arrive answerable, which means starter prose *and* the blanks it
  names, or a designer drops a question nobody can complete.
- **Translation tooling (§M4) gains a case it has not had**: a string whose *content* is
  constrained. The locale-mismatch diagnostic is what makes that safe, and the translation
  editor should surface it rather than leaving it to a later parse.
- A literal `[[name]]` in prose cannot be authored, per §1.
- Accent folding, alternative answers and numeric tolerance are not available, per §6.

## Parent and related links

- [ADR-0001 — our own definition format](./0001-own-definition-format.md)
- [ADR-0017 — the host owns the origin in `choicesByUrl`](./0017-choices-url-environment-portability.md)
- [ADR-0047 — a host-value scope, `{$name}`](./0047-host-value-scope.md)
- [Feature-parity checklist](../feature-parity-checklist.md) — §C11, §E8, §M4, §O, §Q
- [Conformance v2](../../conformance/v2/README.md)
