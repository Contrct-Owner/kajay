/**
 * Moves one entry of a list to another position, leaving everything else in order.
 *
 * The whole of what "reorder" means, in one pure function. It is here rather than
 * inside the ranking question because reordering a list is not a ranking idea: the
 * Creator reorders questions, panels and pages with exactly these semantics
 * ([ADR-0009](../../../../docs/adr/0009-creator-drag-and-drop.md) constraint 3), and a
 * second implementation of it would be a second set of off-by-one bugs.
 *
 * `to` is the index the moved entry ends up at in the *result*, which is the index a
 * respondent or an author points at — not the index in the list minus the entry, which
 * nobody can see.
 *
 * Returns the original array when nothing would change, so a caller can compare by
 * identity and skip announcing a move that did not happen.
 */
export function moveWithin<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || !isIndexOf(items, from) || !isIndexOf(items, to)) {
    return items;
  }
  const rest = items.filter((_, index) => index !== from);
  // `slice` rather than an element read: under `noUncheckedIndexedAccess` an indexed
  // read is `T | undefined`, and a list whose entries may legitimately be `undefined`
  // could not be narrowed back without a cast that would be a lie for some `T`.
  const moved = items.slice(from, from + 1);
  return [...rest.slice(0, to), ...moved, ...rest.slice(to)];
}

function isIndexOf(items: readonly unknown[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < items.length;
}
