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
A chip beside the pointer says what is being carried, so a drag is no longer an
invisible thing being held; a keyboard drag summons none, having no pointer to follow.

The indicator it replaces was a rule drawn between two elements, which a single column
makes unambiguous and a `colCount: 2` page does not — the geometry has always decided
left-or-right as readily as above-or-below, and a horizontal line could not draw that
answer. The placeholder takes a cell of the container's own layout, so the container
decides which one.

- `@kajay/react` gains `PageElementSlotDecoratorProvider`, the sibling of
  `PageElementDecoratorProvider`: it wraps an element's whole layout slot rather than its
  contents, which is the only way to add something a container lays out as one of its own
  children. A panel's children get it with no change to any renderer.
- `@kajay/creator-core`'s placement snapshot gains `withdrawn` — which element gives up
  its place while a preview stands. Nothing is withdrawn without an active slot, so a drag
  aimed somewhere forbidden, or at the position an element already occupies, leaves it
  exactly where it is.
- The design surface now honours the page's `colCount`. The canvas *is* the page's grid
  and the stylesheet had always read the column count from it, but nothing ever wrote one,
  so a two-column page was drawn in a single column.
