import { MultiSelectQuestion } from './MultiSelectQuestion.js';

/** Multi-select rendered as a collapsed list. */
export class TagboxQuestion extends MultiSelectQuestion {
  override get type(): string {
    return 'tagbox';
  }
}
