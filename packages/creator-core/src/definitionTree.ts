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

/** The definitions under a container's `elements`, or `undefined` if there is no such container. */
export function elementsOf(
  definition: SurveyDefinition,
  container: string,
): readonly SurveyDefinition[] | undefined {
  const page = pages(definition).find((candidate) => candidate['name'] === container);
  // `undefined` for "no such container" and `[]` for "a container with nothing in it"
  // are different answers: the second still offers a slot to drop into.
  return page === undefined ? undefined : elementList(page);
}

/**
 * The same definition with one container's elements replaced.
 *
 * Copies the containers it passes through and shares everything else, so an edit
 * produces a new definition without deep-cloning a survey on every drop.
 */
export function withElements(
  definition: SurveyDefinition,
  container: string,
  elements: readonly SurveyDefinition[],
): SurveyDefinition {
  const rewritten: SurveyDefinition[] = [];
  for (const page of pages(definition)) {
    rewritten.push(page['name'] === container ? Object.assign({}, page, { elements }) : page);
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
 * A container is looked up among pages only. A panel is a legal container for a drop as
 * far as {@link elementsOf}'s signature is concerned, and extending this to find one is
 * a recursive walk — but the design surface cannot yet offer a slot inside a panel, and
 * logic no test can reach is logic nobody has checked.
 */
function pages(definition: SurveyDefinition): readonly SurveyDefinition[] {
  const value = definition['pages'];
  return Array.isArray(value) ? value.filter((entry) => isDefinition(entry)) : [];
}

function elementList(page: SurveyDefinition): readonly SurveyDefinition[] {
  const value = page['elements'];
  return Array.isArray(value) ? value.filter((entry) => isDefinition(entry)) : [];
}

function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
