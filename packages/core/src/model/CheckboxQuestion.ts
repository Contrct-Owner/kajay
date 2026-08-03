import { MultiSelectQuestion } from './MultiSelectQuestion.js';

/** Multi-select rendered as a list of checkboxes. */
export class CheckboxQuestion extends MultiSelectQuestion {
  override get type(): string {
    return 'checkbox';
  }
}
