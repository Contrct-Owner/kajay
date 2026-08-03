import { SurveyElement } from './SurveyElement.js';

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
}
