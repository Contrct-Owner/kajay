import { SingleSelectQuestion } from './SingleSelectQuestion.js';

/** Single-select rendered as a collapsed list. */
export class DropdownQuestion extends SingleSelectQuestion {
  override get type(): string {
    return 'dropdown';
  }
}
