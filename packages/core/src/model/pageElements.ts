import { PageElement } from './PageElement.js';
import { Panel } from './Panel.js';
import { Question } from './Question.js';

/** Direct content children declared by a composite page element. */
export function getPageElementChildren(element: PageElement): readonly PageElement[] {
  return element
    .getChildren('elements')
    .filter((child): child is PageElement => child instanceof PageElement);
}

/**
 * Walks an element tree to the questions in it, in document order.
 *
 * Panels nest, so anything asking "what questions does this survey have" — the value
 * resolver, rule registration, `getQuestionByName` — has to recurse rather than read
 * one level. Doing it in one place stops each caller inventing its own traversal.
 */
export function collectQuestions(elements: readonly PageElement[]): readonly Question[] {
  return elements.flatMap((element) => {
    const own = element instanceof Question ? [element] : [];
    return own.concat(collectQuestions(getPageElementChildren(element)));
  });
}

/** Every element in the tree, containers included, in document order. */
export function collectElements(elements: readonly PageElement[]): readonly PageElement[] {
  return elements.flatMap((element) =>
    [element].concat(collectElements(getPageElementChildren(element))),
  );
}

/**
 * Questions the respondent can currently reach, in document order.
 *
 * Visibility is checked at every level, not just the top: a question inside a hidden
 * panel is unreachable however visible the question itself is.
 */
export function collectVisibleQuestions(
  elements: readonly PageElement[],
): readonly Question[] {
  return elements
    .filter((element) => element.isVisible)
    .flatMap((element) => {
      const own = element instanceof Question ? [element] : [];
      return own.concat(collectVisibleQuestions(getPageElementChildren(element)));
    });
}

/** Every panel in the tree, in document order. */
export function collectPanels(elements: readonly PageElement[]): readonly Panel[] {
  return elements.flatMap((element) => {
    const own = element instanceof Panel ? [element] : [];
    return own.concat(collectPanels(getPageElementChildren(element)));
  });
}
