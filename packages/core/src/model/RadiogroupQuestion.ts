import { SingleSelectQuestion } from './SingleSelectQuestion.js';

/** Single-select rendered as a list of radio buttons. */
export class RadiogroupQuestion extends SingleSelectQuestion {
  override get type(): string {
    return 'radiogroup';
  }

  get showClearButton(): boolean {
    return this.getBooleanProperty('showClearButton');
  }
}
