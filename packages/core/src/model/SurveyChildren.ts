import { CalculatedValue } from './CalculatedValue.js';
import { HtmlCondition } from './HtmlCondition.js';
import { collectQuestions } from './pageElements.js';
import { Page } from './Page.js';
import type { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import { Trigger } from './Trigger.js';
import type { ValueHost } from './ValueHost.js';

/**
 * The survey's child collections, and the type rule for each.
 *
 * Held together because they are one concept — what a survey contains — and because
 * keeping the property-name dispatch in one place stops it being duplicated between
 * `getChildren` and `addChild`.
 */
export class SurveyChildren {
  readonly #pages: Page[] = [];
  readonly #calculatedValues: CalculatedValue[] = [];
  readonly #triggers: Trigger[] = [];
  readonly #completedHtmlOnCondition: HtmlCondition[] = [];

  get pages(): readonly Page[] {
    return this.#pages;
  }

  get calculatedValues(): readonly CalculatedValue[] {
    return this.#calculatedValues;
  }

  get triggers(): readonly Trigger[] {
    return this.#triggers;
  }

  /** Completed-page markup, in the order the conditions are tried. */
  get completedHtmlOnCondition(): readonly HtmlCondition[] {
    return this.#completedHtmlOnCondition;
  }

  /** Every question on every page, panels flattened, in document order. */
  get questions(): readonly Question[] {
    return this.#pages.flatMap((page) => collectQuestions(page.elements));
  }

  findQuestion(name: string): Question | undefined {
    return this.questions.find((question) => question.name === name);
  }

  get(property: string): readonly SurveyElement[] {
    if (property === 'pages') {
      return this.#pages;
    }
    if (property === 'calculatedValues') {
      return this.#calculatedValues;
    }
    if (property === 'completedHtmlOnCondition') {
      return this.#completedHtmlOnCondition;
    }
    return property === 'triggers' ? this.#triggers : [];
  }

  /**
   * Files a child under the named collection.
   *
   * A page is handed the value host on the way in rather than by a second call from
   * the survey: forgetting that step leaves every question on the page unable to read
   * or write its own answer, and there is no reason for the caller to have to remember.
   */
  add(property: string, child: SurveyElement, host: ValueHost): void {
    if (property === 'pages') {
      this.#push(this.#pages, child, Page, 'pages', 'pages');
      if (child instanceof Page) {
        child.attachValueHost(host);
      }
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
    if (property === 'completedHtmlOnCondition') {
      this.#push(
        this.#completedHtmlOnCondition,
        child,
        HtmlCondition,
        'conditional markup',
        property,
      );
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
