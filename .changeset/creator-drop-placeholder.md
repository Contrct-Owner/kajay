---
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/react': minor
'@kajay/themes': minor
---

The Creator shows a drop where it would land, instead of pointing at it.

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
  rule read a single column as a *row* almost everywhere, and reaching the end of a list
  meant dragging far below the last question.
- The design surface now honours the page's `colCount`. The canvas *is* the page's grid
  and the stylesheet had always read the column count from it, but nothing ever wrote one,
  so a two-column page was drawn in a single column.
