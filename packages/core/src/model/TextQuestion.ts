import { Question } from './Question.js';

/** The one question type Phase 0 carries end to end. */
export class TextQuestion extends Question {
  override get type(): string {
    return 'text';
  }

  get inputType(): string {
    const inputType = this.getStringProperty('inputType');
    return inputType.length > 0 ? inputType : 'text';
  }

  set inputType(value: string) {
    this.setPropertyValue('inputType', value);
  }

  get placeholder(): string {
    return this.getStringProperty('placeholder');
  }

  set placeholder(value: string) {
    this.setPropertyValue('placeholder', value);
  }
}
