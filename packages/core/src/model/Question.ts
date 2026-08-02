import { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/** Base for every question type. Answers live in the host, never on the question. */
export abstract class Question extends SurveyElement {
  #valueHost: ValueHost | undefined;

  get name(): string {
    return this.getStringProperty('name');
  }

  set name(value: string) {
    this.setPropertyValue('name', value);
  }

  /**
   * Display title, falling back to the question name.
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

  get isRequired(): boolean {
    return this.getBooleanProperty('isRequired');
  }

  set isRequired(value: boolean) {
    this.setPropertyValue('isRequired', value);
  }

  get value(): unknown {
    return this.#valueHost?.getValue(this.name);
  }

  set value(next: unknown) {
    this.#valueHost?.setValue(this.name, next);
  }

  attachValueHost(host: ValueHost): void {
    this.#valueHost = host;
  }
}
