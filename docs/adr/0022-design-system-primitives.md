# ADR-0022 — The host's design system draws the chrome

- Area: React adapters (`@kajay/react`, `@kajay/creator-react`)
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

## Context

The people who adopt this are building an application that already has a design
system. Today that overwhelmingly means **shadcn/ui** — Radix primitives copied into
their own repository — or a shadcn-compatible registry such as **ReUI**, styled with
**Tailwind CSS**. They have a `<Button>`. They have a `<Dialog>` with their portal,
their animation and their focus trap. They have a `<Select>` whose keyboard behaviour
their users are already used to.

The token contract ([design-tokens.md](../design-tokens.md), I4, ADR-0008) was built
for a different question and answers it well: *what colour is this*. It does not
answer *whose component is this*. A shadcn host who overrides `--kajay-color-accent`
still gets our button — our focus ring beside theirs, our disabled state, our idea of
a dialog — and ends up with two design systems on one page, which is worse than one
they dislike.

The Creator makes this acute. A survey is inputs and labels; a Creator is buttons,
dialogs, popovers, tabs and a property grid that is nothing *but* form controls. If
those are ours, the Creator will always look like a guest in the host's application.

Deciding now is cheap because `creator-react` is empty. Deciding after §K is a
rewrite.

## Decision

**Both React packages draw their chrome through a small, closed set of primitives that
the host may replace. Working defaults ship, so nothing has to be supplied.**

```tsx
<SurveyCreator creator={creator} components={{ Button, Input, Dialog }} />
```

### The set is small, closed, and earns each entry

A primitive is in the set only if the library needs it in more than one place *and*
a design system almost certainly already has it. Twelve components a host can adapt in
an afternoon is a seam people use; forty is a seam nobody finishes.

Anything outside the set is ours to draw — out of the primitives, styled by the tokens.
A design surface adorner is not a primitive; it is a thing we build from a button.

### The map is partial, and unsupplied entries fall back

`components` is `Partial<>`. A host may replace one thing. **This is what makes the set
extensible without breaking anyone**: adding a primitive in a later version cannot break
a host who supplied a full map, because there is no such thing as a full map.

### Props follow the conventions the target ecosystem already uses

`open`/`onOpenChange`, `value`/`onValueChange`, `checked`/`onCheckedChange`,
`disabled`, `children`, and `className` passed through on everything. Where Radix has
settled a convention, we use its shape — so a shadcn adapter is a re-export, not a
translation layer:

```tsx
components={{ Button, Input, Dialog }}   // straight from the host's own ui/ folder
```

We match the *shape*. We do not adopt Radix idioms that only work with Radix — `asChild`
and slot-cloning are out, because they tie the contract to one library's implementation.

### The library depends on none of it

No Radix, no Tailwind, no shadcn, no registry, in any package. The UI packages take
React as a peer and carry nothing else. Shipping Tailwind classes in our own markup
would force Tailwind on every host and leave those without it holding unstyled markup;
depending on Radix would put a second copy of it in the bundle of every shadcn host,
with the version conflict landing on them.

The defaults are native elements with the `kajay-*` class names the stylesheet already
styles. A host who wants the shipped look changes nothing; a host who wants their own
supplies components; a Tailwind host who wants neither passes `className` through.

### It is a different seam from the renderer registry

Replacing a whole question type is [ADR-0019](./0019-deep-runtime-modules-and-rendering-seam.md)'s
rendering seam. Replacing every button is this one. A host doing the first is saying
"draw a rating differently"; a host doing the second is saying "draw everything with my
components", and making one mechanism serve both would mean re-registering twenty
renderers to change a focus ring.

## Sequencing

**`creator-react` is built on this from its first commit** — the code does not exist
yet, so it costs nothing.

**`@kajay/react` adopts it as its own piece of work**, not as a side effect. Twenty-odd
renderers draw native inputs today and they all shipped green in Phase 2; converting
them is real work with real regression risk, and pretending otherwise here is how it
would get done badly. It is a row, sized and scheduled, and until it lands the
renderer's answer to "style it however you choose" is the token contract — which is
honest, and less than this.

**That row landed as §P2** (2026-08-04), after the reference application made the gap
visible: a shadcn host had a Creator built from their components and a survey built from
ours, in the same frame. Forty-eight native controls became five primitives, the defaults
render byte-identical markup, and the existing suites were the regression net. What the
conversion *found* is the amendment below.

## Amendment (2026-08-04): the set admits leaves, not containers

Written after the first real integration — `apps/site` supplying shadcn components to
both packages — because the admission rule above turned out to be necessary and not
sufficient.

### What the rule missed

The rule said a primitive is in the set only if the library needs it in more than one
place *and* a design system almost certainly already has it. A radio passes both. It is
still not admissible as written, and the reason is a distinction the original decision
never drew.

**A design system does not ship "a radio". It ships a `RadioGroup` and a
`RadioGroupItem`** — a container that owns the value and the roving-tabindex focus, and
an item that is meaningless outside it. Radix, and therefore shadcn and ReUI, all work
this way. That is a *container* primitive, and every entry in this set is a **leaf**: a
control that draws itself, reports its own value, and shares no state with its siblings.

The difference is not stylistic. A container changes three things at once: the value
moves up from the item to the group, two map entries become one indivisible unit, and
the map stops being safely partial — supplying a `RadioGroup` without a matching
`RadioGroupItem` is broken in a way that supplying `Button` without `Input` is not.

### Why a container cannot be admitted here

The matrix settles it. §F1 draws a radio group **across a table row**:

```html
<tr>
  <td>row label</td>
  <td><input type="radio" name="row-1"></td>
  <td><input type="radio" name="row-1"></td>
</tr>
```

Native radios group by the `name` attribute, which requires **no wrapping element at
all**. That is precisely why one mechanism serves a table row, a rating scale and a tile
grid alike. A container primitive requires an element, and there is no legal element
between `<tr>` and `<td>` to put it in. Radix's escape hatch is `asChild`, which this ADR
already rejected for tying the contract to one library's implementation.

A primitive that serves some of the places the library draws it and not others is not a
primitive. So: **the set is closed to containers**, and `RadioGroup` is not admitted.

### `Radio` stays, as the one entry a host writes rather than re-exports

The tempting conclusion is that `Radio` should leave the set too. It does not, and the
reason is what a survey looks like: §C3 and §C4 put a radio group and a checkbox list in
the same form routinely. Shipping a seam that makes the checkboxes theirs and leaves the
radios ours produces a form that is *more* obviously wrong than one drawn entirely in
either — mixed chrome reads as a bug, consistent chrome reads as a choice.

So `Radio` remains a leaf entry, with the cost stated rather than hidden: it is the one
primitive a shadcn host **writes** — a dozen lines putting their own classes on a native
input — instead of re-exporting. The reference application carries that adapter as
evidence that a dozen lines is what it costs.

This narrows the claim made under "Props follow the conventions the target ecosystem
already uses". A shadcn adapter is *mostly* a re-export: `Checkbox` exactly, `Button`
nearly, `Input` and `Textarea` through a three-line `onChange` shim. `Radio` is not, and
neither is the Creator's `Select`, which has to build a trigger, a portal and an item per
option from an `options` array.

### `Select` is not admitted, for the sibling reason

It fails the *second* half of the rule rather than this new third one. A design system
ships a select; it does not ship one carrying §C5 and §C6's lazy paging, its search box
and its "other" row. Those are this library's semantics, not a control's, and a host who
wants their own dropdown wants their whole dropdown.

### The revised rule

A primitive is admitted only if all three hold:

1. the library needs it in **more than one place**;
2. a design system **almost certainly already has it**; and
3. it is a **leaf** — it draws itself, reports its own value, and owns no state shared
   with its siblings.

### Where the rejected cases go instead

To [ADR-0019](./0019-deep-runtime-modules-and-rendering-seam.md)'s rendering seam, which
already exists and already handles the matrix correctly, because a replaced renderer
draws its own markup end to end. A host who wants their group semantics and their
keyboard contract is not asking to restyle a control — they are replacing a question
type, and this ADR drew that line in "It is a different seam from the renderer registry"
before there was a case to test it against. There is one now.

## Consequences

- **Every drawing site in `creator-react` goes through the map.** A raw `<button>`
  outside the defaults module is the defect this ADR exists to prevent, and it is
  visible in review. A lint rule is cheap if review proves insufficient.
- **The primitive contracts are public API from 1.0.0**, and they are behavioural as
  well as structural: a `Dialog` must trap focus, a `Select` must be operable from the
  keyboard. The contract says so per primitive.
- **Accessibility becomes shared.** The defaults are ours and J5's axe sweep covers
  them; a host who substitutes a broken primitive owns that outcome. The contract
  documents what each must do, and the demo proves the seam with a substituted map so
  the substituted path is exercised at all.
- Two things need testing where there was one: the defaults, and at least one scenario
  rendered through a replacement map.
- **A shadcn adapter becomes an obvious follow-on** — a `@kajay/creator-shadcn` package,
  or a registry entry in ReUI's own model, providing the map wired to a host's `ui/`
  folder. That is distribution built *on* this seam, not a substitute for it, and it is
  Phase 4.

## Alternatives considered

- **Tokens and class overrides only.** What exists now. Rejected as the whole answer:
  it delivers colour, not components, and leaves a shadcn host with two focus-ring
  systems and two dialog behaviours on one screen.
- **Ship Tailwind utility classes in our markup.** Rejected: forces Tailwind on
  everyone, gives hosts without it unstyled markup, and couples the library to a
  Tailwind major version we do not control.
- **Depend on Radix and re-export.** Rejected: shadcn *is* Radix, so every such host
  gets a second copy and inherits our version conflicts.
- **Radix-style `asChild` slot cloning.** Rejected: `cloneElement` gymnastics, a
  contract tied to one library's idiom, and worse error messages when it is used wrong.
- **A whole-component override per piece.** Already available under
  [ADR-0021](./0021-creator-composition.md) and useful, but far too coarse for this: a
  host wanting their own button should not have to reimplement the property grid.

## Parent and related links

- [ADR-0008](./0008-no-surveyjs-theme-import.md)
- [ADR-0019](./0019-deep-runtime-modules-and-rendering-seam.md)
- [ADR-0021](./0021-creator-composition.md)
- [Design tokens](../design-tokens.md)
- [Feature-parity checklist §K](../feature-parity-checklist.md)
