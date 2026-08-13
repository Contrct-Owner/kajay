import type { SurveyDefinition } from '@kajay/core';

/**
 * Finding and replacing one named thing anywhere in a definition.
 *
 * Its own module because two editors need the same walk and neither owns it: the
 * collection editor replaces a list on the element it finds, and the marker editor
 * rewrites prose on the same one. A second copy of "walk the tree, share every branch
 * that did not change" is a second place for the sharing to be got wrong.
 */

/**
 * The first object in the tree answering to a name.
 *
 * A deep walk rather than pages-then-elements, because the thing being edited may be a
 * matrix column, a multiple-text item, or a question inside a detail panel. Names are
 * unique across a survey — `collectNames` and `uniqueName` are what make that true — so
 * "the first" is "the only".
 */
export function findNamed(value: unknown, owner: string): SurveyDefinition | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNamed(item, owner);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (!isDefinition(value)) {
    return undefined;
  }
  if (value['name'] === owner) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findNamed(child, owner);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * The same tree with one named object replaced.
 *
 * Returns the **same reference** wherever nothing underneath changed, so editing a choice
 * list does not rebuild the questions around it — the sharing `withList` established for
 * the canvas, generalized to any element with a name.
 */
export function rewriteNamed(
  value: SurveyDefinition,
  owner: string,
  change: (found: SurveyDefinition) => SurveyDefinition,
): SurveyDefinition {
  return rewrite(value, owner, change) as SurveyDefinition;
}

function rewrite(
  value: unknown,
  owner: string,
  change: (found: SurveyDefinition) => SurveyDefinition,
): unknown {
  if (Array.isArray(value)) {
    let touched = false;
    const items = value.map((item) => {
      const next = rewrite(item, owner, change);
      touched ||= next !== item;
      return next;
    });
    return touched ? items : value;
  }
  if (!isDefinition(value)) {
    return value;
  }
  if (value['name'] === owner) {
    return change(value);
  }
  let output: SurveyDefinition | undefined;
  for (const [key, child] of Object.entries(value)) {
    const next = rewrite(child, owner, change);
    if (next !== child) {
      output ??= { ...value };
      output[key] = next;
    }
  }
  return output ?? value;
}

export function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

