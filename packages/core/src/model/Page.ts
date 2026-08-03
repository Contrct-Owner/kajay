import { PageElement } from './PageElement.js';
import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/**
 * One page of a survey.
 *
 * Not a `PageElement`, which is the thing a page *contains*: were it one, a page would
 * be a legal child of a page. It repeats `name` and `title` for that reason.
 */
export class Page extends SurveyElement {
  readonly #elements: PageElement[] = [];
  #valueHost: ValueHost | undefined;

  override get type(): string {
    return 'page';
  }

  get name(): string {
    return this.getStringProperty('name');
  }

  set name(value: string) {
    this.setPropertyValue('name', value);
  }

  /** Raw, with no fallback to the name: a page with no title renders without one. */
  get title(): string {
    return this.getStringProperty('title');
  }

  set title(value: string) {
    this.setPropertyValue('title', value);
  }

  get elements(): readonly PageElement[] {
    return this.#elements;
  }

  /** Elements a respondent can currently see. What the renderer draws. */
  get visibleElements(): readonly PageElement[] {
    return this.#elements.filter((element) => element.isVisible);
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'elements' ? this.#elements : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'elements') {
      throw new Error(`A page does not accept children under "${property}".`);
    }
    if (!(child instanceof PageElement)) {
      throw new Error(`A page accepts questions and panels; received "${child.type}".`);
    }
    this.#elements.push(child);
    if (this.#valueHost !== undefined) {
      child.attachValueHost(this.#valueHost);
    }
  }

  /** Propagates the host to current and future children, so attach order is free. */
  attachValueHost(host: ValueHost): void {
    this.#valueHost = host;
    for (const element of this.#elements) {
      element.attachValueHost(host);
    }
  }
}
