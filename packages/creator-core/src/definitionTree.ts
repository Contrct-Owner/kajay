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
  | { readonly of: 'elements'; readonly container: string }
  | { readonly of: 'pages' };

/** Whether two slots name the same place. Slots are values, and compared as values. */
export function sameList(left: DropList, right: DropList): boolean {
  if (left.of === 'pages' || right.of === 'pages') {
    return left.of === right.of;
  }
  return left.container === right.container;
}

/** What is in that list, or `undefined` if the definition has no such list. */
export function listOf(
  definition: SurveyDefinition,
  list: DropList,
): readonly SurveyDefinition[] | undefined {
  if (list.of === 'pages') {
    return pages(definition);
  }
  // `undefined` for "no such container" and `[]` for "a container with nothing in it"
  // are different answers: the second still offers a slot to drop into.
  return findContainer(definition, list.container)?.elements;
}

/**
 * A container and the elements in it, wherever it is.
 *
 * Pages *and panels*, found by walking. A panel is a container in exactly the way a page
 * is — it holds an ordered list of page elements — and the only reason K2 shipped
 * without this was that the design surface could not draw a slot inside one.
 */
function findContainer(
  definition: SurveyDefinition,
  name: string,
): { readonly elements: readonly SurveyDefinition[] } | undefined {
  for (const page of pages(definition)) {
    if (page['name'] === name) {
      return { elements: definitionsUnder(page, 'elements') };
    }
    const nested = findNested(definitionsUnder(page, 'elements'), name);
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

function findNested(
  elements: readonly SurveyDefinition[],
  name: string,
): { readonly elements: readonly SurveyDefinition[] } | undefined {
  for (const element of elements) {
    const children = definitionsUnder(element, 'elements');
    // Matched by name alone, without asking whether it looks like a container: an empty
    // one does not. Nothing reaches here for a question, because a slot only exists
    // where {@link slotsOnPage} was told a container is.
    if (element['name'] === name) {
      return { elements: children };
    }
    const nested = findNested(children, name);
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

/**
 * Whether an element is one a drop can land inside.
 *
 * **The definition cannot answer this and must be told.** An empty panel serializes
 * without its `elements` at all — canonical form elides a collection with nothing in it
 * (ADR-0002) — so by shape it is indistinguishable from a text question. Guessing from
 * the shape meant a panel a designer had just added was the one container in the survey
 * nothing could be dropped into, which took an E2E scenario to notice.
 *
 * The registry knows, so the caller that has one says. `DesignSurface` supplies it.
 */
export type IsContainerType = (type: string) => boolean;

function typeOf(element: SurveyDefinition): string {
  const type = element['type'];
  return typeof type === 'string' ? type : '';
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
  const container = list.container;
  const rewritten = pages(definition).map((page) =>
    page['name'] === container
      ? Object.assign({}, page, { elements: items })
      : Object.assign({}, page, {
          elements: replaceNested(definitionsUnder(page, 'elements'), container, items),
        }),
  );
  return { ...definition, pages: rewritten };
}

/**
 * The same elements, with one nested container's own list replaced.
 *
 * Copies only the containers on the path down and shares every leaf, so dropping into a
 * panel three levels deep still does not clone the questions around it.
 */
function replaceNested(
  elements: readonly SurveyDefinition[],
  container: string,
  items: readonly SurveyDefinition[],
): readonly SurveyDefinition[] {
  return elements.map((element) => {
    if (element['name'] === container) {
      return Object.assign({}, element, { elements: items });
    }
    const children = definitionsUnder(element, 'elements');
    if (children.length === 0) {
      return element;
    }
    return Object.assign({}, element, {
      elements: replaceNested(children, container, items),
    });
  });
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

/**
 * An element's name, plus the name of every container inside it.
 *
 * What a move may **not** land in: dropping a panel into itself, or into one of its own
 * descendants, would detach the whole subtree from the survey and leave it pointing at
 * itself. The classic tree bug, and the one that produces a definition no parser can
 * make sense of rather than merely a wrong-looking page.
 */
export function containersWithin(
  definition: SurveyDefinition,
  name: string,
): ReadonlySet<string> {
  const found = new Set<string>();
  const element = findElement(definition, name);
  if (element !== undefined) {
    found.add(name);
    collectContainers(definitionsUnder(element, 'elements'), found);
  }
  return found;
}

function collectContainers(elements: readonly SurveyDefinition[], into: Set<string>): void {
  for (const element of elements) {
    const name = nameOf(element);
    if (name !== undefined) {
      into.add(name);
    }
    collectContainers(definitionsUnder(element, 'elements'), into);
  }
}

function findElement(
  definition: SurveyDefinition,
  name: string,
): SurveyDefinition | undefined {
  const search = (elements: readonly SurveyDefinition[]): SurveyDefinition | undefined => {
    for (const element of elements) {
      if (nameOf(element) === name) {
        return element;
      }
      const nested = search(definitionsUnder(element, 'elements'));
      if (nested !== undefined) {
        return nested;
      }
    }
    return undefined;
  };
  for (const page of pages(definition)) {
    const found = search(definitionsUnder(page, 'elements'));
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * Where an element is: the container holding it, and its index in that container.
 *
 * Needed because a move is no longer within one list. Until a panel became a container
 * a drop could land in, the source and the target were always the same list and the
 * question never came up — which is why `canPlace` looked for the element in the list it
 * was being moved *to*, and refused every move that crossed a container.
 */
export function locate(
  definition: SurveyDefinition,
  name: string,
): { readonly list: DropList; readonly index: number } | undefined {
  const search = (
    container: string,
    elements: readonly SurveyDefinition[],
  ): { readonly list: DropList; readonly index: number } | undefined => {
    for (const [index, element] of elements.entries()) {
      const childName = nameOf(element);
      if (childName === name) {
        return { list: { of: 'elements', container }, index };
      }
      if (childName !== undefined) {
        const nested = search(childName, definitionsUnder(element, 'elements'));
        if (nested !== undefined) {
          return nested;
        }
      }
    }
    return undefined;
  };
  for (const [index, page] of pages(definition).entries()) {
    if (nameOf(page) === name) {
      return { list: { of: 'pages' }, index };
    }
    const found = search(nameOf(page) ?? '', definitionsUnder(page, 'elements'));
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * Every position a drop could land in on one page, in the order they are on screen.
 *
 * The tree flattened, so that a keyboard walk covers a panel's interior without needing
 * a second gesture to get into one. Reading order: the slot above an element comes before
 * the element, a container's own slots come between its opening and its close, and the
 * slot after the last element closes the list.
 */
export function slotsOnPage(
  definition: SurveyDefinition,
  page: string,
  isContainerType: IsContainerType,
): readonly { readonly container: string; readonly index: number }[] {
  const slots: { container: string; index: number }[] = [];
  const walk = (container: string, elements: readonly SurveyDefinition[]): void => {
    for (const [index, element] of elements.entries()) {
      slots.push({ container, index });
      const name = nameOf(element);
      if (name !== undefined && isContainerType(typeOf(element))) {
        walk(name, definitionsUnder(element, 'elements'));
      }
    }
    slots.push({ container, index: elements.length });
  };
  const elements = listOf(definition, { of: 'elements', container: page });
  if (elements !== undefined) {
    walk(page, elements);
  }
  return slots;
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

/** The survey's pages. */
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
