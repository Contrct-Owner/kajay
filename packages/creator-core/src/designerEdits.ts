import type { DesignSurface } from './DesignSurface.js';
import { addPage, pageAfterRemoving, removePage } from './pageEdits.js';
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
