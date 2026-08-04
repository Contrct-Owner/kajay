import type { SurveyDefinition } from '@kajay/core';
import type { DesignSurface } from './DesignSurface.js';
import type { DropList } from './definitionTree.js';
import { copyFrom, pasteInto } from './elementEdits.js';
import type { DropSlot } from './placement.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';

/**
 * What was copied, and where a paste lands — checklist K5.
 *
 * Its own concept rather than a field on the design surface, because that is what it is:
 * K5's decision was that **the clipboard holds a definition fragment, not an element**.
 * Nothing survives a re-parse by identity, so a fragment can be pasted after any number of
 * edits, into another page, or never — which is a lifetime of its own, not a property of
 * the survey being designed.
 *
 * Kept in memory rather than written to the system clipboard. That is a `navigator` call,
 * which a core package may not make and the architecture check enforces — and it is the
 * right boundary anyway: a host that wants copy between browser tabs reads
 * {@link fragment} and writes it wherever they like.
 */
export class DesignClipboard {
  #fragment: SurveyDefinition | undefined;

  get fragment(): SurveyDefinition | undefined {
    return this.#fragment;
  }

  /**
   * Remembers an element so it can be pasted. Says whether there was one to copy.
   *
   * Announcing is the caller's, and the distinction is the point: copying changes what a
   * view *shows* — whether Paste is available — without changing the survey, so there is
   * nothing to undo and everything to redraw.
   */
  copy(surface: DesignSurface, name: string): EditRefusal | undefined {
    const fragment = copyFrom(surface, name);
    if (fragment === undefined) {
      return refuse('not-found', name);
    }
    this.#fragment = fragment;
    return undefined;
  }

  /**
   * Pastes what was copied.
   *
   * After the selected element by default, and at the end of the page when nothing is
   * selected. Pasting "somewhere" is not a useful answer, and the selection is the only
   * thing on screen that says where a designer is working.
   */
  paste(
    surface: DesignSurface,
    slot: DropSlot | undefined = pasteSlotFor(surface),
  ): EditRefusal | undefined {
    const fragment = this.#fragment;
    // Two reasons a paste does nothing, and only one of them is about the clipboard: an
    // empty clipboard is `nothing-copied`, while no slot means there is no page to paste
    // onto. A designer told "nothing has been copied yet" while holding something copied
    // would go looking for a bug that is not there.
    if (fragment === undefined) {
      return refuse('nothing-copied');
    }
    if (slot === undefined) {
      return refuse('not-found', '');
    }
    return pasteInto(surface, fragment, slot);
  }
}

/** Straight after the selection, or at the end of the page when there is none. */
export function pasteSlotFor(surface: DesignSurface): DropSlot | undefined {
  const page = surface.page;
  if (page === undefined) {
    return undefined;
  }
  const at = page.elements.findIndex((element) => surface.isSelected(element));
  const list: DropList = { of: 'elements', container: page.name };
  return { list, index: at < 0 ? page.elements.length : at + 1 };
}
