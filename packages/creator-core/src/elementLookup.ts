import type { Page, PageElement } from '@kajay/core';

/**
 * Finding a page element by name, anywhere in the survey — checklist P10.
 *
 * **The model-side twin of `locate`.** `Survey.getQuestionByName` finds questions, and a
 * panel is not one; anything editing an element it knows only by name — which, after
 * [ADR-0009](../../../docs/adr/0009-creator-drag-and-drop.md) decision 3, is everything
 * that survives a re-parse — has to resolve a *page element*. P10 found this the first time
 * somebody typed on a panel's description and nothing happened.
 *
 * Its own file rather than a method body, because `DesignSurface` is at its line limit and
 * a recursive walk is a self-contained thing with a name.
 */
export function elementNamedIn(pages: readonly Page[], name: string): PageElement | undefined {
  for (const page of pages) {
    const hit = within(page.elements, name);
    if (hit !== undefined) {
      return hit;
    }
  }
  return undefined;
}

function within(elements: readonly PageElement[], name: string): PageElement | undefined {
  for (const element of elements) {
    if (element.name === name) {
      return element;
    }
    const inside = within(element.getChildren('elements') as readonly PageElement[], name);
    if (inside !== undefined) {
      return inside;
    }
  }
  return undefined;
}
