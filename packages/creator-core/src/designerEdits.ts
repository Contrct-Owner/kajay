import type { DesignSurface } from './DesignSurface.js';
import { addPage, pageAfterRemoving, removePage } from './pageEdits.js';
import { notice } from './CreatorNotice.js';
import { placementRefusal } from './placement.js';
import type { DropSlot, PlacementSource } from './placement.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';

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
export function removePageFrom(
  surface: DesignSurface,
  name: string,
): EditRefusal | undefined {
  const before = surface.definition;
  const after = removePage(before, name);
  if (after === before) {
    return refuse('not-found', name);
  }
  const goTo = surface.page?.name === name ? pageAfterRemoving(before, name) : surface.page?.name;
  return surface.applyEdit(after, { goTo, from: before });
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

/**
 * Puts a new element, or an existing one, at a slot — checklists K2 and K4.
 *
 * A free function beside the other structural edits, and back here after the placement
 * state machine took the mechanics: what is left is the part that is about *surveys* —
 * which refusals a drop can carry, and what is worth saying afterwards.
 *
 * **The reason comes from the same predicate the session guards with.** Asking
 * `placementRefusal` here is what turns the session's one-word `'refused'` back into
 * something a designer can act on, and because it is one function rather than two, the
 * drop this refuses and the drop the session refuses cannot come apart (ADR-0023).
 */
export function placeOn(
  surface: DesignSurface,
  source: PlacementSource,
  slot: DropSlot,
): EditRefusal | undefined {
  if (surface.isReadOnly) {
    return refuse('read-only');
  }
  const refusal = placementRefusal(surface.definition, source, slot, surface.configuration);
  if (refusal !== undefined) {
    return refusal;
  }
  const outcome = surface.placement.transition({ kind: 'place', source, slot });
  // `'ignored'` is a drop that changed nothing, which refuses nothing. Past the check
  // above, `'refused'` can only be the session's own state: a drag already in flight.
  if (outcome === 'refused') {
    return refuse('drag-in-progress');
  }
  // N5 gave the toolbox starter choices, rows and template elements so a dropped question
  // is answerable straight away. That is content a designer did not type appearing in their
  // survey, and only the items carrying any say so (ADR-0023).
  if (outcome === 'committed' && source.kind === 'new' && hasStarterContent(source.item)) {
    surface.notify(notice('starter-content', { subject: surface.selection.name ?? source.item.type }));
  }
  return undefined;
}

/** Whether a toolbox item brings anything beyond its type and a name. */
function hasStarterContent(item: { readonly defaults: Readonly<Record<string, unknown>> }): boolean {
  return Object.keys(item.defaults).length > 0;
}
