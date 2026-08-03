import type { SurveyDefinition } from '@kajay/core';
import { collectNames, listOf, nameOf, uniqueName, withList } from './definitionTree.js';

const PAGES: { readonly of: 'pages' } = { of: 'pages' };

/**
 * Adding and removing pages — checklist K4.
 *
 * Separate from placement, because they are not placements. A placement moves something
 * that exists, or creates one from a toolbox item a designer dragged; a page is neither.
 * Nobody drags a page into existence, and nothing in the toolbox is a page.
 */

/**
 * A new empty page, appended.
 *
 * Appended rather than inserted after the current one: a designer building a survey adds
 * pages in order, and inserting in the middle is the rarer intent — which is what the
 * drag reorder is for, once the page exists.
 */
export function addPage(definition: SurveyDefinition): SurveyDefinition {
  const pages = listOf(definition, PAGES) ?? [];
  // Named from the same pool as every question. `{page1}` in an expression has to mean
  // one thing, so a page called `text1` because a question already took `page1` would
  // be worse than the numbering looking untidy.
  const created = { name: uniqueName('page', collectNames(definition)), elements: [] };
  return withList(definition, PAGES, [...pages, created]);
}

/**
 * Removes a page, and everything on it.
 *
 * **The last page can go.** Refusing would mean a designer cannot delete a page they do
 * not want without first adding a replacement, and a survey with no pages is a state the
 * canvas already renders and says so — it is the state every new survey starts in.
 *
 * That it takes the questions with it is the point of the operation, not a side effect;
 * K6's undo is what makes it safe to mean it.
 */
export function removePage(definition: SurveyDefinition, name: string): SurveyDefinition {
  const pages = listOf(definition, PAGES);
  if (pages === undefined || !pages.some((page) => nameOf(page) === name)) {
    return definition;
  }
  return withList(
    definition,
    PAGES,
    pages.filter((page) => nameOf(page) !== name),
  );
}

/**
 * Which page to look at once `name` has gone.
 *
 * The one that takes its place, or the one before it when the last page was removed —
 * never nothing while a page remains. A designer who deletes page three is still looking
 * at the survey, and an empty canvas would read as having deleted rather more than they
 * asked for.
 */
export function pageAfterRemoving(
  definition: SurveyDefinition,
  name: string,
): string | undefined {
  const pages = listOf(definition, PAGES) ?? [];
  const at = pages.findIndex((page) => nameOf(page) === name);
  if (at < 0) {
    return undefined;
  }
  const remaining = pages.filter((_unused, index) => index !== at);
  return nameOf(remaining[Math.min(at, remaining.length - 1)] ?? {});
}
