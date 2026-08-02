import { DisplayElement } from './DisplayElement.js';

/**
 * Author-supplied markup shown between questions.
 *
 * **Trust boundary.** The markup is rendered as markup — that is the whole feature —
 * so a definition is code as far as this element is concerned, at the same level of
 * trust as the host's own bundle. A host that accepts definitions from people it does
 * not trust (a survey-builder SaaS, say) must pass `sanitizeHtml` to the renderer; the
 * adapter provides that seam rather than shipping a hand-rolled sanitizer, because a
 * sanitizer that is nearly right is more dangerous than none at all.
 */
export class HtmlElement extends DisplayElement {
  override get type(): string {
    return 'html';
  }

  get html(): string {
    return this.getStringProperty('html');
  }

  set html(value: string) {
    this.setPropertyValue('html', value);
  }
}
