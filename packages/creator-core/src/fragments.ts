import type { MetadataRegistry, SurveyDefinition } from '@kajay/core';
import { collectNames, nameOf } from './definitionTree.js';
import { rewriteRenames } from './referenceRewrite.js';

/**
 * Making a copy of part of a survey fit to live beside the original — checklist K5.
 *
 * Two things have to happen, and the second is the one that is easy to miss.
 *
 * **Names must not collide**, or the copy and the original both answer to one name and
 * `getQuestionByName` returns whichever the parser saw first.
 *
 * **References inside the copy must follow the copy.** A duplicated panel whose second
 * question says `visibleIf: "{first} = 'yes'"` means *its own* first question, not the
 * one in the panel it was copied from. Renaming without rewriting leaves a copy that
 * looks right and is quietly wired to somebody else's questions — which is worse than
 * a copy that fails loudly, because nobody notices until a respondent does.
 */

export type { RenameMap } from './referenceRewrite.js';

/**
 * A copy of `fragment` whose names are free, with its own references rewritten.
 *
 * References *out* of the fragment are deliberately left alone. A question copied from
 * one page to another that says `visibleIf: "{consent} = true"`, where `consent` was not
 * copied, still means the original `consent` — there is nothing else it could mean.
 */
export function freshenFragment(
  fragment: SurveyDefinition,
  taken: ReadonlySet<string>,
  registry: MetadataRegistry,
): { readonly fragment: SurveyDefinition; readonly renames: ReadonlyMap<string, string> } {
  const claimed = new Set(taken);
  const renames = new Map<string, string>();
  for (const name of collectNames(fragment)) {
    if (!claimed.has(name)) {
      // Free already. Keeping it means a fragment pasted into a different survey reads
      // exactly as it was written, which is what a designer expects of a paste.
      claimed.add(name);
      continue;
    }
    const fresh = nextName(name, claimed);
    claimed.add(fresh);
    renames.set(name, fresh);
  }
  // The renames come back rather than being thrown away. They are the whole of what a
  // designer needs to hear — their `who` is now `who1`, and they will go looking for
  // `who` — and this is the only moment anything knows it (ADR-0023).
  return { fragment: rewriteRenames(fragment, renames, registry), renames };
}

/**
 * `who2` from `who`, `text3` from `text2`.
 *
 * **Counts on from the original rather than from one.** A copy of `who` called `who1`
 * reads as an unrelated question that happens to sort next to it; `who` and `who2` read
 * as a series, which is what they are. So the number the name already carries is the
 * starting point, and a name carrying none is treated as the first.
 *
 * Trailing digits are part of the number, not of the stem, so copying `text2` gives
 * `text3` rather than `text21` — which reads as a typo and sorts nowhere sensible.
 *
 * This is deliberately not `uniqueName`, which numbers from one because a *new* `text`
 * from the toolbox is the first of its kind and `text1` is right for it.
 */
function nextName(name: string, taken: ReadonlySet<string>): string {
  const digits = /\d+$/u.exec(name)?.[0];
  const stem = digits === undefined ? name : name.slice(0, -digits.length);
  const base = stem.length > 0 ? stem : name;
  for (let suffix = Number(digits ?? '1') + 1; ; suffix += 1) {
    const candidate = `${base}${String(suffix)}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

/**
 * One name changed everywhere it appears — checklist L1's rename.
 *
 * The same walk a paste uses, with a map of one. That is the whole reason renaming an
 * element from the property grid cost nothing: K5 had already established that a name and
 * the references to it move together, and the only difference here is that the rewrite
 * covers the survey rather than a fragment cut out of it.
 *
 * Over-inclusive in the same direction as {@link takenNames}: a definition that already
 * has two things called `who` — which nothing the Creator produces can — renames both.
 * The alternative is renaming one and leaving every reference ambiguous, which is worse.
 */
export function renameThroughout(
  definition: SurveyDefinition,
  from: string,
  to: string,
  registry: MetadataRegistry,
): SurveyDefinition {
  return rewriteRenames(definition, new Map([[from, to]]), registry);
}

export function takenNames(definition: SurveyDefinition): ReadonlySet<string> {
  return collectNames(definition);
}

/** The element or page in a list that answers to `name`. */
export function findByName(
  items: readonly SurveyDefinition[],
  name: string,
): SurveyDefinition | undefined {
  return items.find((item) => nameOf(item) === name);
}
