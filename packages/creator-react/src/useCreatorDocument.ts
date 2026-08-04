import { sameDefinition } from '@kajay/creator-core';
import type { DesignSurface, SaveController } from '@kajay/creator-core';
import type { SurveyDefinition } from '@kajay/core';
import { useEffect, useRef } from 'react';
import { useSurfaceVersion } from './useSurfaceVersion.js';

export interface CreatorDocumentOptions {
  readonly surface: DesignSurface;
  /** The definition the Creator shows. Changing it to something new re-opens it. */
  readonly value?: SurveyDefinition | undefined;
  readonly onChange?: ((definition: SurveyDefinition) => void) | undefined;
  /** Where an auto-save goes. Absent means the host is not auto-saving. */
  readonly autoSave?: SaveController | undefined;
}

/**
 * Keeps a host's `value` and the Creator's own document in step — checklist N1.
 *
 * **Controlled, with the one honest reading of the word.** A survey being designed is a
 * large stateful model with an undo stack and a selection; a strictly controlled component
 * would have to be re-created from a prop on every keystroke, and a host who forgot to echo
 * `onChange` back would have an editor that refused to type. So `value` is the document the
 * Creator *opens*, and the two sides are kept in step through one remembered fact: the last
 * definition they agreed on.
 *
 * - The Creator changes → the new definition is reported once, and remembered.
 * - `value` changes to something that is **not** what we last reported → the host means it,
 *   so the document is re-opened.
 * - `value` changes to exactly what we last reported → that is our own echo coming back,
 *   and nothing happens. Without this the editor would re-open itself on every keystroke,
 *   losing the selection and filling the undo stack with its own output.
 *
 * Compared as canonical JSON, because every read of `definition` builds a fresh object —
 * see `sameDefinition`.
 */
export function useCreatorDocument({
  surface,
  value,
  onChange,
  autoSave,
}: CreatorDocumentOptions): void {
  useSurfaceVersion(surface);
  // The last definition the host and the Creator agreed on. A ref rather than state: it is
  // read and written inside effects and nothing renders differently for it.
  const agreed = useRef<SurveyDefinition | undefined>(value);

  useEffect(() => {
    const current = surface.definition;
    if (sameDefinition(current, agreed.current)) {
      return;
    }
    agreed.current = current;
    onChange?.(current);
    autoSave?.request(current);
    // Deliberately runs after *every* render rather than on a dependency list. What it
    // watches is the surface's contents, which `useSurfaceVersion` above has already made
    // a render trigger — and a dependency on `surface.definition` would be a fresh object
    // each time, which is the same thing said less clearly.
  });

  useEffect(() => {
    if (value === undefined || sameDefinition(value, agreed.current)) {
      return;
    }
    agreed.current = value;
    // Through `applyEdit`, so a host swapping the document in is an edit like any other and
    // a designer can take it back. The alternative — building a new surface — would throw
    // away the undo stack that a host pushing a correction is most likely to want.
    surface.applyEdit(value);
  }, [value, surface]);
}
