import type { SurveyDefinition } from '@kajay/core';
import { collectNames, nameOf } from './definitionTree.js';

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

/** A rename that has been applied to a fragment, old name to new. */
export type RenameMap = ReadonlyMap<string, string>;

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
): SurveyDefinition {
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
  return rewrite(fragment, renames) as SurveyDefinition;
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

function rewrite(value: unknown, renames: RenameMap): unknown {
  if (typeof value === 'string') {
    return rewriteReferences(value, renames);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewrite(item, renames));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = key === 'name' && typeof child === 'string' ? rename(child, renames) : rewrite(child, renames);
  }
  return output;
}

function rename(name: string, renames: RenameMap): string {
  return renames.get(name) ?? name;
}

/**
 * Rewrites `{who}` to `{who2}` inside any string.
 *
 * **Every string, not only the ones the registry calls expressions.** `{who}` in a
 * title, in HTML content or in a validator's message is the same reference by the same
 * syntax (B6's text piping), and a rewrite that covered `visibleIf` but not the heading
 * above it would leave a copy that behaved correctly and read wrongly. Braces are the
 * piping syntax, so a `{name}` in a string *is* a reference — there is no literal use of
 * it to protect.
 *
 * The boundary matters: `{who}` must not match inside `{whoever}`, and `{who.city}` and
 * `{who[0]}` must both be rewritten, because a reference can be into a value.
 */
function rewriteReferences(text: string, renames: RenameMap): string {
  if (renames.size === 0 || !text.includes('{')) {
    return text;
  }
  let output = text;
  for (const [from, to] of renames) {
    output = output.replaceAll(new RegExp(String.raw`\{${escape(from)}(?=[}.[])`, 'gu'), `{${to}`);
  }
  return output;
}

function escape(name: string): string {
  return name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}

/** Every name a survey has already spoken for. */
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
