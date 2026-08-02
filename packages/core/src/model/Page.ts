import { Question } from './Question.js';
import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

export class Page extends SurveyElement {
  readonly #elements: Question[] = [];
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

  get title(): string {
    return this.getStringProperty('title');
  }

  set title(value: string) {
    this.setPropertyValue('title', value);
  }

  get elements(): readonly Question[] {
    return this.#elements;
  }

  /** Elements a respondent can currently see. What the renderer draws. */
  get visibleElements(): readonly Question[] {
    return this.#elements.filter((element) => element.isVisible);
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'elements' ? this.#elements : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'elements') {
      throw new Error(`A page does not accept children under "${property}".`);
    }
    if (!(child instanceof Question)) {
      throw new Error(`A page accepts questions; received "${child.type}".`);
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
