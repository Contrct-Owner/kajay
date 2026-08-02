import type { PageElement } from './PageElement.js';
import { Panel } from './Panel.js';
import { Question } from './Question.js';

/**
 * Walks an element tree to the questions in it, in document order.
 *
 * Panels nest, so anything asking "what questions does this survey have" — the value
 * resolver, rule registration, `getQuestionByName` — has to recurse rather than read
 * one level. Doing it in one place stops each caller inventing its own traversal.
 */
export function collectQuestions(elements: readonly PageElement[]): readonly Question[] {
  return elements.flatMap((element) => {
    if (element instanceof Panel) {
      return collectQuestions(element.elements);
    }
    return element instanceof Question ? [element] : [];
  });
}

/** Every element in the tree, containers included, in document order. */
export function collectElements(elements: readonly PageElement[]): readonly PageElement[] {
  return elements.flatMap((element) =>
    element instanceof Panel ? [element, ...collectElements(element.elements)] : [element],
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
      if (element instanceof Panel) {
        return collectVisibleQuestions(element.elements);
      }
      return element instanceof Question ? [element] : [];
    });
}

/** Every panel in the tree, in document order. */
export function collectPanels(elements: readonly PageElement[]): readonly Panel[] {
  return elements.flatMap((element) =>
    element instanceof Panel ? [element, ...collectPanels(element.elements)] : [],
  );
}
