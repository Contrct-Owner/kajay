import type { ItemValue, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import { whenEditable } from './readOnly.js';

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
        // On the checkbox rather than on the group around it: ARIA supports
        // `aria-readonly` on `checkbox` and on `radiogroup`, but *not* on `radio` and
        // not on `group` — which is what a `<fieldset>` maps to. A multi-select group
        // therefore says it here, and a single-select one says it on the fieldset,
        // which carries `role="radiogroup"` for exactly that reason.
        aria-readonly={isMultiple && question.isReadOnly ? true : undefined}
        onChange={whenEditable(question.isReadOnly, () => {
          question.select(choice.value);
        })}
      />
      <span>{choice.text}</span>
    </label>
  );
}
