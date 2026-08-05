import type { ItemValue, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';
import { readOnlyControl, whenEditable } from './readOnly.js';
import { useSurveyComponents } from './SurveyComponents.js';
import { useTextRenderer } from './TextRendererContext.js';

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
  const { Checkbox, Radio } = useSurveyComponents();
  const renderText = useTextRenderer();
  // Two entries in the map, chosen here: a design system's checkbox and its radio are
  // different components with different keyboard contracts, and picking between them is
  // the library's job rather than every host's.
  const Choice = isMultiple ? Checkbox : Radio;

  return (
    <label className="kajay-choice">
      <Choice
        name={groupName}
        value={String(choice.value)}
        checked={question.isSelected(choice.value)}
        // A checkbox carries the state itself; a radio cannot — ARIA does not define
        // `aria-readonly` on `radio`, so a single-select group says it on the
        // `radiogroup` around them instead.
        {...(isMultiple ? readOnlyControl(question.isReadOnly) : {})}
        onCheckedChange={whenEditable(question.isReadOnly, () => {
          question.select(choice.value);
        })}
      />
      <span>
        {renderText(choice.text, {
          kind: 'choice',
          owner: question.name,
          property: 'choices',
          item: String(choice.value),
        })}
      </span>
    </label>
  );
}
