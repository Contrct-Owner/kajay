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

> **Superseded in part by the [amendment below](#amendment-2026-08-13--a-blank-is-a-question-not-a-bespoke-item):**
> the collection still declares while the template positions, but what it declares is a
> **question**, not the bespoke `fillintheblankitem` this section introduced.

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

> **Superseded in part by the [amendment below](#amendment-2026-08-13--a-blank-is-a-question-not-a-bespoke-item):**
> marking belongs to each blank's own type, and these two options move onto the question
> base beside `correctAnswer` — they describe marking by text, not blanks.

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

## Amendment, 2026-08-13 — a blank is a question, not a bespoke item

**What shipped was too small.** A blank was `fillintheblankitem`, carrying an `inputType`
passed straight through as the HTML `type` attribute. That serves text, number and date and
nothing else, and the driver is larger than that: the prose is a *layout*, and what belongs
in it is any field that fits in a line — a dropdown, a multi-select, a yes/no. Authoring a
form by writing a sentence is the actual feature; filling in a blank is its simplest case.

A bespoke item cannot grow into that. A dropdown needs choices, `choicesByUrl`,
carry-forward, lazy paging and an "other" row, and each of those inside a private item type
would be a second, worse copy of the select family — the thing this project keeps refusing.

### 1. `blanks` holds questions

The collection's element base type becomes `question`, exactly as `matrixcells` columns and
a dynamic panel's `templateElements` already hold real elements. A dropdown blank *is* a
`dropdown`, so the registry, the schema, the property grid, validators and marking arrive
with it rather than being rebuilt inside it.

`fillintheblankitem` is deleted rather than deprecated. The type has landed on a branch and
has never been released, so this costs an edit now and a migration later — which is the
whole reason to do it before it ships.

### 2. Only what fits in a line of prose, refused at parse

Not every question means anything inside a sentence. A matrix in the middle of a clause is
not a layout decision, it is a mistake, and it should be refused where the author can see it
rather than discovered as broken markup.

**A class descriptor declares whether its type may sit inline**, so the answer comes from
the registry rather than a list kept somewhere that will be wrong the day a type is added.
A host's own type can therefore opt in. Core owns the flag — it is the only place both
runtimes and the definition diagnostics can read it, and none of them may touch a DOM.

A blank naming a type that has not opted in is an **error**: nothing can draw it, so the
respondent silently loses a field the author placed.

### 3. Marking belongs to the blank's type

Each blank scores by its own rule and the sentence sums them, which the score already
supports as a pair. A multi-select blank therefore earns partial credit **with no new
arithmetic**, through the same selection rule a checkbox uses.

`trim` and `caseSensitive` move onto the question base beside `correctAnswer`, because they
are properties of *marking by text* rather than of blanks. That fixes something older than
this ADR: an ordinary `text` question with `correctAnswer: "Paris"` has always marked
`paris` wrong, and has always been measuring typing rather than the subject.

### 4. Inline rendering is its own seam

Every renderer today draws block-level markup — a fieldset, a label above, an error list
below — and dropping one inside a sentence would produce a paragraph with a form in it.

**A second registration, not a mode flag on the first.** A renderer registry that accepted
an `inline` prop would oblige every renderer, including a host's, to handle a case most
would ignore, and the failure would be a fieldset drawn mid-sentence. A separate inline
registration is absent by default, which makes "this type cannot go inline" the same
statement in the adapter that §2 makes in the definition.

The accessible-name rule is unchanged and extends: an inline dropdown is named the way an
inline text field is, because the sentence labels it to a reader and to nobody else.

### What does not change

The `[[name]]` grammar, the template as one translatable string, the rule that a
translation may move a marker but not rename one, the answer as one object keyed by blank
name, and the three diagnostics. A multi-select blank simply stores an array under its key,
which that shape already allows.

The type keeps the name `fillintheblank`: it is what people call this, and it is still
exactly what the feature does in its simplest form.

## Alternatives considered

**Reuse `{name}`.** Rejected above: it is the inverse operation behind identical syntax.

**A segment array instead of a template string.** Rejected: untranslatable, per §2. This is
the decision most likely to look over-thought until the first non-English locale arrives.

**Blanks declared purely inline**, with properties encoded in the marker
(`[[capital:Paris]]`). Rejected. It puts correct answers into the string a translator
edits — so a translation can change the marking — and it grows a second, cramped property
syntax inside prose the moment anything needs a third attribute.

**Grow the bespoke item instead of holding questions.** Rejected by the amendment above: a
dropdown blank would need choices, remote choices, carry-forward and paging, each of which
already exists on the select family and none of which is worth a private second copy.

**Let any question type sit inline, and leave the rest to the renderer.** Rejected: the
failure arrives as broken markup at render time rather than as a diagnostic an author can
act on, and "what fits in a sentence" is a fact about the type rather than about the page.

**An `inline` prop on the existing renderer registry**, rather than a second registration.
Rejected: it obliges every renderer a host has ever written to handle a case it has never
heard of, and the default behaviour of ignoring it is a fieldset drawn inside a paragraph.

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
- **The amendment's rework**: `fillintheblankitem` is deleted, `blanks` re-typed, a class
  descriptor flag added — so the schema, metadata and diagnostic contracts all move again —
  an inline renderer registration appears in the React adapter, `Kajay.Core` follows, the
  conformance cases grow a multi-select blank, and the Creator's blanks editor becomes a
  type picker. All of it is cheap only while the type is unreleased.
- **The blanks editor needs the prose, not only the list** — found while building the type
  picker, and worse than the missing picker: adding, deleting and renaming a blank each
  left the template behind, and two of the three produced a definition the parser refuses.
  A collection declares `markerProperty` for it, so the editor asks the registry whether
  its children are positioned in prose rather than asking whether it is looking at a
  sentence — and a marker is written into every language, since it is a name rather than
  words and a translation naming a different set of blanks is an error of its own.

## Parent and related links

- [ADR-0001 — our own definition format](./0001-own-definition-format.md)
- [ADR-0017 — the host owns the origin in `choicesByUrl`](./0017-choices-url-environment-portability.md)
- [ADR-0047 — a host-value scope, `{$name}`](./0047-host-value-scope.md)
- [Feature-parity checklist](../feature-parity-checklist.md) — §C11, §E8, §M4, §O, §Q
- [Conformance v2](../../conformance/v2/README.md)
