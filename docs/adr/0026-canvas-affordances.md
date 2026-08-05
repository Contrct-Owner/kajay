# ADR-0026 — What the canvas edits, and what the grid does

- Area: `creator-react`, `themes`
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

## Context

K3 built the design surface with an adorner: a strip above each element carrying a type
chip, a drag handle, a title input, a type picker, and four action buttons. Every one of
those was individually defensible and the result was not. By §P the strip was wider than
the canvas column, the title was read in one place and typed in another, a choice label
could only be reached through the property grid, and the chip said the type until you
clicked and the name afterwards.

None of that came from a bad decision. It came from having no rule about *where an edit
belongs*, so every new capability landed in the nearest empty space, which was the adorner.

## Decision

**Authored text is edited where it is drawn. Everything else is edited in the property
grid. The adorner carries identity and gestures, and no edits at all.**

### Authored text edits in place

A title, a description, a choice label — anything a respondent reads — is edited by typing
on it. It goes through I6's text seam, which [P10](../feature-parity-checklist.md) extended
with a `TextSubject` so the Creator can tell *which* element's words it has been handed.

The seam matters more than the feature: nothing in the Creator knows the shape of any
renderer's markup, so a host's own question type gets inline editing with no code.

**`contentEditable`, not a swapped-in `<input>`.** An input is a box, and a box on a canvas
full of real boxes reads as a field the respondent will see. This is the same text, in the
same place, in the same font, that happens to take a caret.

**Deliberately not an [ADR-0022](./0022-design-system-primitives.md) primitive.** There is
no design-system component for "text that is also its own editor", and routing it through
`Input` would put back the box this exists to remove. The property grid remains where a
host's `Input` contract is proven.

**Committed on blur.** Every edit re-parses the definition
([ADR-0009](./0009-creator-drag-and-drop.md) decision 3), so writing per keystroke would
re-parse the survey per character and pull the caret out of the node being typed in. Blur
also makes a rename one undo entry rather than a dozen, which is what a designer means by
undoing a rename.

### The grid holds what has no visible representation — and the lossy

`visibleIf`, `name`, validators: things with nothing on screen to click. Also anything
**rare and destructive**, whatever its visibility. The type picker is the worked example —
converting drops every property the new type has no place for, and a lossy edit should take
a deliberate journey to reach rather than sit permanently under the cursor.

Rare and destructive is a judgement, not a test. The question to ask is whether somebody
could do it by accident and not notice.

### The adorner is identity and gestures

A drag handle, the element's **name**, and an overflow menu. Nothing that changes a value.

The chip says the name *always* — not the type when unselected and the name when selected.
A label that means one thing before a click and another after is worse than either, and the
type is legible from the question itself while the name appears nowhere else on the canvas.

### A panel measures itself, not the window

Anything that can live in a host's sidebar sizes on a container query. A property grid in a
15rem panel on a 2000px monitor is exactly the case where the viewport and the panel
disagree, and `@media` asks the wrong one.

The corollary bit twice: a child pinned with `grid-column: 2` must release it when the row
stacks, because **a grid asked for a column it does not declare invents one**, and the
implicit column takes the space.

## Consequences

- Adding a capability means answering "is this authored text, or is it rare or lossy?"
  before deciding where it goes. There is no longer a default of "put it in the adorner".
- **The text seam is a published contract with a subject in it**, so it carries identity for
  anything that wants to write back. That was a breaking change to `TextRenderer`, taken
  before 1.0.0 because it is free now.
- Inline editing needs `DesignSurface.elementNamed`: what survives a re-parse is a name, and
  `getQuestionByName` does not find panels.
- Two rules protect data rather than layout, and they are not negotiable for convenience: a
  choice label writes `text` and never `value` (the answer key responses are already stored
  under), and a label equal to its value stays bare so the round-trip shape does not change
  because somebody clicked.
- Container queries are now the default for Creator panels. A `@media` query in this
  package's CSS should be read as a bug until argued otherwise.

## Alternatives considered

- **Keep the adorner and widen it.** What the canvas is for is the survey; furniture that
  grows until it is wider than the content is the problem, not the symptom.
- **Put the type picker in the overflow menu.** Twenty types flattened into a menu is
  unusable, and a submenu needs either nesting the `Menu` primitive deliberately does not do
  or a `Dialog` that is not in ADR-0022's set.
- **Delete conversion entirely.** Rare is not optional: without it, "this should have been a
  checkbox" means delete, re-add, and retype the title, the choices and any logic that
  referred to it — and K5 would be a green row with no reachable capability.
- **Commit on every keystroke.** Correct about the model and wrong about the caret, the undo
  stack, and the number of re-parses.

## Parent and related links

- [ADR-0009](./0009-creator-drag-and-drop.md) — definition in, definition out
- [ADR-0021](./0021-creator-composition.md) — pieces, and a default assembly
- [ADR-0022](./0022-design-system-primitives.md) — the host draws the chrome
- [ADR-0023](./0023-the-creator-says-what-happened.md) — refusals and notices
