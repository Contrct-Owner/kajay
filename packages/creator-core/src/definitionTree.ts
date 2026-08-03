import type { SurveyDefinition } from '@kajay/core';

/**
 * Reading and rewriting a survey *definition* — the JSON, not the model.
 *
 * Structural edits work on the definition and re-parse
 * ([ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3), so this is
 * where the Creator meets untyped JSON. Every accessor here is guarded and returns
 * `undefined` rather than asserting: a definition can contain anything a host wrote,
 * including the shapes the parser reports diagnostics about, and the Creator has to
 * stay standing on one.
 */

/**
 * A list a drop can land in — checklist K2 and K4.
 *
 * The survey's pages and a page's elements are two different lists, and naming which
 * one is meant is what lets **one** reorder serve both. Reordering pages is the same
 * operation as reordering questions — the same off-by-one moving downwards, the same
 * pair of slots that mean "where it already is" — and a second implementation of it
 * would be a second place for that bug to live. It survived a mutant once already.
 */
export type DropList =
  | { readonly of: 'elements'; readonly page: string }
  | { readonly of: 'pages' };

/** What is in that list, or `undefined` if the definition has no such list. */
export function listOf(
  definition: SurveyDefinition,
  list: DropList,
): readonly SurveyDefinition[] | undefined {
  if (list.of === 'pages') {
    return pages(definition);
  }
  const page = pages(definition).find((candidate) => candidate['name'] === list.page);
  // `undefined` for "no such page" and `[]` for "a page with nothing on it" are
  // different answers: the second still offers a slot to drop into.
  return page === undefined ? undefined : definitionsUnder(page, 'elements');
}

/**
 * The same definition with one list replaced.
 *
 * Copies what it passes through and shares everything else, so an edit produces a new
 * definition without deep-cloning a survey on every drop.
 */
export function withList(
  definition: SurveyDefinition,
  list: DropList,
  items: readonly SurveyDefinition[],
): SurveyDefinition {
  if (list.of === 'pages') {
    return { ...definition, pages: items };
  }
  const rewritten: SurveyDefinition[] = [];
  for (const page of pages(definition)) {
    rewritten.push(page['name'] === list.page ? Object.assign({}, page, { elements: items }) : page);
  }
  return { ...definition, pages: rewritten };
}

/**
 * Every `name` anywhere in the definition.
 *
 * A deep walk rather than a walk of pages and elements, and deliberately
 * **over-inclusive**: it also collects the names of matrix columns, multiple-text items
 * and anything else that has one. Over-collecting only makes a generated name more
 * conservative, while under-collecting produces a collision — and a collision is a
 * question that answers to somebody else's name in every expression that mentions it.
 */
export function collectNames(definition: SurveyDefinition): ReadonlySet<string> {
  const names = new Set<string>();
  visit(definition, names);
  return names;
}

/**
 * `text1`, `text2`, … — the first one nothing has taken.
 *
 * Numbered from a stem rather than from a title, because the name is what expressions
 * refer to and what arrives in the response data. A designer renames it; a title with a
 * space in it would have to be escaped in every `visibleIf` that mentioned it.
 *
 * Uniqueness is checked across the **whole survey**. Two pages holding a question called
 * `text1` each is exactly the collision that makes `getQuestionByName` return the wrong
 * one — and a page shares that name space, because `{page1}` in an expression has to
 * mean one thing.
 */
export function uniqueName(stem: string, taken: ReadonlySet<string>): string {
  for (let suffix = 1; ; suffix += 1) {
    const candidate = `${stem}${String(suffix)}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

export function nameOf(definition: SurveyDefinition): string | undefined {
  const name = definition['name'];
  return typeof name === 'string' ? name : undefined;
}

function visit(value: unknown, names: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, names);
    }
    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'name' && typeof child === 'string') {
      names.add(child);
    }
    visit(child, names);
  }
}

/**
 * The survey's pages.
 *
 * A drop into a *panel* is not offered. Extending {@link listOf} to find one is a
 * recursive walk, but the design surface cannot yet adorn an element inside a panel, and
 * logic no test can reach is logic nobody has checked.
 */
function pages(definition: SurveyDefinition): readonly SurveyDefinition[] {
  return definitionsUnder(definition, 'pages');
}

function definitionsUnder(
  parent: SurveyDefinition,
  property: string,
): readonly SurveyDefinition[] {
  const value = parent[property];
  return Array.isArray(value) ? value.filter((entry) => isDefinition(entry)) : [];
}

function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
