import type { DesignSurface } from './DesignSurface.js';
import type { DropSlot, PlacementSource } from './placement.js';
import { addPage, pageAfterRemoving, removePage } from './pageEdits.js';
import { applyPlacement, placedName } from './placement.js';
import { isTypeAllowed } from './CreatorConfiguration.js';

/**
 * The structural edits, written as what they are: a definition in, a definition out.
 *
 * Free functions over {@link DesignSurface.applyEdit} rather than methods, so that the
 * surface stays about the *document* — what is parsed, what is selected, what can be
 * undone — while the edits stay about surveys. Each one is a small, readable proof that
 * `applyEdit` is a sufficient seam, which is the claim K5 will lean on.
 */

/**
 * Adds an empty page at the end and moves to it — checklist K4.
 *
 * Moving to it is the whole point of the button: a designer adds a page in order to put
 * something on it, and one that appeared somewhere off-screen would need finding first.
 */
export function addPageTo(surface: DesignSurface): void {
  const before = surface.definition;
  const after = addPage(before);
  surface.applyEdit(after, { goTo: newestPage(after), from: before });
}

/**
 * Removes a page and everything on it — checklist K4.
 *
 * Returns whether anything happened. The canvas lands on the page that took its place,
 * or the one before it when the last page went — but **only when the page removed was
 * the one being looked at**. Relocating unconditionally sent a designer off the page
 * they were working on because a different one had been tidied up.
 */
export function removePageFrom(surface: DesignSurface, name: string): boolean {
  const before = surface.definition;
  const after = removePage(before, name);
  if (after === before) {
    return false;
  }
  const goTo = surface.page?.name === name ? pageAfterRemoving(before, name) : surface.page?.name;
  surface.applyEdit(after, { goTo, from: before });
  return true;
}

/**
 * Puts a new element, or an existing one, at a slot — checklist K2 and K4.
 *
 * Returns whether anything happened, so a caller can leave a refused drop unspoken — and
 * so a drop that lands where it started does not put an entry on the undo stack that
 * undoes nothing.
 */
export function placeOn(
  surface: DesignSurface,
  source: PlacementSource,
  slot: DropSlot,
): boolean {
  // A restricted Creator refuses the *edit*, not merely the button — checklist N2. A
  // toolbox that drew a shorter list while `place` still accepted anything would make the
  // restriction a suggestion, and a keyboard drag or a host calling `place` directly would
  // walk straight past it.
  if (source.kind === 'new' && !isTypeAllowed(source.item.type, surface.configuration)) {
    return false;
  }
  const before = surface.definition;
  const after = applyPlacement(before, source, slot);
  if (after === before) {
    return false;
  }
  surface.applyEdit(after, { select: placedName(source, after, slot), from: before });
  return true;
}

function newestPage(definition: Record<string, unknown>): string | undefined {
  const pages = definition['pages'];
  if (!Array.isArray(pages)) {
    return undefined;
  }
  const last: unknown = pages.at(-1);
  const name = (last as Record<string, unknown> | undefined)?.['name'];
  return typeof name === 'string' ? name : undefined;
}
