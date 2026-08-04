import type { SurveyDefinition } from '@kajay/core';
import { takenNames } from './fragments.js';
import { refuse } from './EditRefusal.js';
import type { EditRefusal } from './EditRefusal.js';

/**
 * Whether a survey would refuse this name, and why —
 * [ADR-0023](../../../docs/adr/0023-the-creator-says-what-happened.md).
 *
 * **One predicate, two callers**, and that is the point of exporting it. `renameIn` guards
 * with this, and a property grid asks it before committing so the field can say what will
 * happen. A view that re-implemented "is this name taken" would drift from the model that
 * enforces it, and the drift shows up as a field promising an edit the document then
 * refuses — which is the defect this row exists to remove, reintroduced one layer up.
 *
 * `undefined` means the rename would be allowed.
 *
 * **Renaming something to what it is already called is refused as taken**, deliberately.
 * Its own name is one of the taken ones, and a `to === from` carve-out here would be a
 * branch that reads as if it did something and could never fire: the caller who wants
 * "leave it alone" is not calling rename.
 */
export function nameRefusal(
  definition: SurveyDefinition,
  to: string,
): EditRefusal | undefined {
  const trimmed = to.trim();
  if (trimmed.length === 0) {
    // No subject: quoting back the empty string would print `Another question is already
    // called ""`, which describes a survey nobody has.
    return refuse('name-empty');
  }
  return takenNames(definition).has(trimmed) ? refuse('name-taken', trimmed) : undefined;
}
