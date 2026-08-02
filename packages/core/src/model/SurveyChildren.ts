import { CalculatedValue } from './CalculatedValue.js';
import { Page } from './Page.js';
import type { SurveyElement } from './SurveyElement.js';
import { Trigger } from './Trigger.js';

/**
 * The survey's three child collections, and the type rule for each.
 *
 * Held together because they are one concept — what a survey contains — and because
 * keeping the property-name dispatch in one place stops it being duplicated between
 * `getChildren` and `addChild`.
 */
export class SurveyChildren {
  readonly #pages: Page[] = [];
  readonly #calculatedValues: CalculatedValue[] = [];
  readonly #triggers: Trigger[] = [];

  get pages(): readonly Page[] {
    return this.#pages;
  }

  get calculatedValues(): readonly CalculatedValue[] {
    return this.#calculatedValues;
  }

  get triggers(): readonly Trigger[] {
    return this.#triggers;
  }

  get(property: string): readonly SurveyElement[] {
    if (property === 'pages') {
      return this.#pages;
    }
    if (property === 'calculatedValues') {
      return this.#calculatedValues;
    }
    return property === 'triggers' ? this.#triggers : [];
  }

  add(property: string, child: SurveyElement): void {
    if (property === 'pages') {
      this.#push(this.#pages, child, Page, 'pages', 'pages');
      return;
    }
    if (property === 'calculatedValues') {
      this.#push(this.#calculatedValues, child, CalculatedValue, 'calculated values', property);
      return;
    }
    if (property === 'triggers') {
      this.#push(this.#triggers, child, Trigger, 'triggers', property);
      return;
    }
    throw new Error(`A survey does not accept children under "${property}".`);
  }

  #push<TElement extends SurveyElement>(
    target: TElement[],
    child: SurveyElement,
    expected: abstract new (...args: never[]) => TElement,
    expectedLabel: string,
    property: string,
  ): void {
    if (!(child instanceof expected)) {
      throw new Error(`"${property}" accepts ${expectedLabel}; received "${child.type}".`);
    }
    target.push(child);
  }
}
