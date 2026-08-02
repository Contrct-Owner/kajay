import { SurveyElement } from './SurveyElement.js';

/**
 * Markup chosen by a condition.
 *
 * The completed page's `completedHtmlOnCondition`: the first entry whose expression is
 * truthy wins, and the plain `completedHtml` is the fallback when none is. An ordered
 * list rather than one expression per message, because "which of these applies" is a
 * decision with an order, and the alternative — several unrelated conditions that might
 * all be true at once — has no defined answer.
 *
 * Its own element type rather than a plain record so it round-trips, reaches the
 * contract, and can carry more later, exactly as choices and validators do.
 */
export class HtmlCondition extends SurveyElement {
  override get type(): string {
    return 'htmlcondition';
  }

  /** Truthy expression selects this markup. */
  get expression(): string {
    return this.getStringProperty('expression');
  }

  set expression(value: string) {
    this.setPropertyValue('expression', value);
  }

  get html(): string {
    return this.getStringProperty('html');
  }

  set html(value: string) {
    this.setPropertyValue('html', value);
  }
}
