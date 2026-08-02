import { SurveyElement } from './SurveyElement.js';

/**
 * A survey-level value derived from an expression.
 *
 * It is an element rather than a plain record so the registry owns it like everything
 * else: the serializer round-trips it, the contract documents it, and the Creator's
 * property grid will edit it, all without per-type knowledge.
 */
export class CalculatedValue extends SurveyElement {
  override get type(): string {
    return 'calculatedvalue';
  }

  get name(): string {
    return this.getStringProperty('name');
  }

  set name(value: string) {
    this.setPropertyValue('name', value);
  }

  get expression(): string {
    return this.getStringProperty('expression');
  }

  set expression(value: string) {
    this.setPropertyValue('expression', value);
  }

  /**
   * Whether the computed value joins the survey's answers.
   *
   * Off by default: a calculated value is usually an intermediate step in logic, and
   * putting every one of them into the submitted result would surprise.
   */
  get includeIntoResult(): boolean {
    return this.getBooleanProperty('includeIntoResult');
  }

  set includeIntoResult(value: boolean) {
    this.setPropertyValue('includeIntoResult', value);
  }
}
