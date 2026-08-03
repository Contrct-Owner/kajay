import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/**
 * Anything a page can contain: a question, or a panel grouping further elements.
 *
 * Introduced so a page's `elements` collection has one type rule rather than a special
 * case per container. `name`, `title` and the conditional state properties belong here
 * because they mean the same thing for a group as for a single question — a panel is
 * shown by `visibleIf` and frozen by `enableIf` exactly as a question is.
 *
 * `isRequired` deliberately stays on `Question`: requiredness is a statement about an
 * answer, and a panel does not hold one.
 */
export abstract class PageElement extends SurveyElement {
  #valueHost: ValueHost | undefined;

  get name(): string {
    return this.getStringProperty('name');
  }

  set name(value: string) {
    this.setPropertyValue('name', value);
  }

  /**
   * Display title, falling back to the element name.
   *
   * Serialization deliberately does not go through this accessor — it reads the raw
   * property — so a fallback title is never written into the definition.
   */
  get title(): string {
    const title = this.getStringProperty('title');
    return title.length > 0 ? title : this.name;
  }

  set title(value: string) {
    this.setPropertyValue('title', value);
  }

  /**
   * Connects this element tree to the survey that owns its answers.
   *
   * Composite page elements use the conventional `elements` child collection. The
   * propagation belongs here so adding a new composite type does not require teaching
   * pages, panels, and every traversal about that concrete class.
   */
  attachValueHost(host: ValueHost): void {
    this.#valueHost = host;
    for (const child of this.getChildren('elements')) {
      if (child instanceof PageElement) {
        child.attachValueHost(host);
      }
    }
  }

  /** The answer host for question implementations. */
  protected get valueHost(): ValueHost | undefined {
    return this.#valueHost;
  }

  /** Connects a page element added after this element was attached to a survey. */
  protected attachChildValueHost(child: PageElement): void {
    if (this.#valueHost !== undefined) {
      child.attachValueHost(this.#valueHost);
    }
  }
}
