import { SurveyElement } from './SurveyElement.js';

/** The trigger kinds the built-in registry declares. */
export type TriggerKind = 'complete' | 'setvalue' | 'copyvalue' | 'runexpression' | 'skip';

/**
 * A survey-level rule that *acts* when its condition becomes true.
 *
 * One class parameterised by its registered type name, rather than five near-identical
 * subclasses: the kinds differ only in which properties they declare and what the
 * logic engine does with them, and none of that difference belongs in the model.
 */
export class Trigger extends SurveyElement {
  readonly #type: TriggerKind;

  constructor(type: TriggerKind) {
    super();
    this.#type = type;
  }

  override get type(): string {
    return this.#type;
  }

  get kind(): TriggerKind {
    return this.#type;
  }

  /** Condition. The trigger acts when this becomes true, not while it stays true. */
  get expression(): string {
    return this.getStringProperty('expression');
  }

  set expression(value: string) {
    this.setPropertyValue('expression', value);
  }

  /** Question whose answer the trigger writes, for the kinds that write one. */
  get setToName(): string {
    return this.getStringProperty('setToName');
  }

  /** Question the trigger copies from (`copyvalue`). */
  get fromName(): string {
    return this.getStringProperty('fromName');
  }

  /** Expression whose result is stored (`runexpression`). */
  get runExpression(): string {
    return this.getStringProperty('runExpression');
  }

  /** Page, or the page owning the named question, to navigate to (`skip`). */
  get gotoName(): string {
    return this.getStringProperty('gotoName');
  }
}
