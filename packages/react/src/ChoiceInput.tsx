import type { ItemValue, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import { readOnlyControl, whenEditable } from './readOnly.js';

export interface ChoiceInputProps {
  readonly question: SelectQuestion;
  readonly choice: ItemValue;
  readonly groupName: string;
  readonly isMultiple: boolean;
}

/**
 * One selectable choice.
 *
 * Reports the click and nothing more: which choices may coexist, and what a limit or
 * an exclusive `none` does, is decided by the model.
 */
export function ChoiceInput({
  question,
  choice,
  groupName,
  isMultiple,
}: ChoiceInputProps): ReactElement {
  return (
    <label className="kajay-choice">
      <input
        type={isMultiple ? 'checkbox' : 'radio'}
        name={groupName}
        value={String(choice.value)}
        checked={question.isSelected(choice.value)}
        // A checkbox carries the state itself; a radio cannot — ARIA does not define
        // `aria-readonly` on `radio`, so a single-select group says it on the
        // `radiogroup` around them instead.
        {...(isMultiple ? readOnlyControl(question.isReadOnly) : {})}
        onChange={whenEditable(question.isReadOnly, () => {
          question.select(choice.value);
        })}
      />
      <span>{choice.text}</span>
    </label>
  );
}
