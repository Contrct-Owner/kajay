import { MultiSelectQuestion } from '@kajay/core';
import type { ItemValue, SelectQuestion } from '@kajay/core';
import type { ReactElement } from 'react';

/**
 * What goes inside a native `<select>`, wherever one is drawn — checklist C5, C13.
 *
 * Shared because a dropdown in a sentence is the same control as a dropdown on a line of
 * its own, and the first version of the inline one proved what happens when that is
 * written twice: it read a respondent's answer straight off `event.target.value`, so a
 * choice authored as `1` came back as `"1"`, and it took the styling of a text input
 * because it was given a text input's class. Neither was a decision anybody made.
 */

/** Every choice while answering; only the chosen ones while reading. */
export function optionsFor(question: SelectQuestion): readonly ItemValue[] {
  if (!question.isReadOnly) {
    return question.visibleChoices;
  }
  return question.visibleChoices.filter((choice) => question.isSelected(choice.value));
}

/**
 * Records what the browser reports, in the model's own values.
 *
 * A native option carries a string, and the model's values are whatever the author wrote
 * — a number, a boolean, an object. Mapping back through `visibleChoices` is what keeps
 * `1` a number in the response.
 */
export function applySelection(question: SelectQuestion, target: HTMLSelectElement): void {
  const selected = [...target.selectedOptions].flatMap((option) => {
    const choice = question.visibleChoices.find(
      (candidate) => String(candidate.value) === option.value,
    );
    return choice === undefined ? [] : [choice.value];
  });
  question.applySelection(selected);
}

/**
 * The rows a select needs before its choices: the prompt, and the way back to no answer.
 *
 * **The prompt is hidden from the list**, because it is not a choice. Left visible, a
 * respondent opening the list met "a department" sitting between Engineering and Design,
 * which reads as a department of that name. A hidden option still shows as the closed
 * label, which is the whole of the role it plays.
 *
 * **A question that may go unanswered keeps a blank row**, or a respondent who picks by
 * mistake has no way back — a native select has no undo of its own. A required question
 * has none, because "no answer" was never one of its answers.
 */
export function ChoiceOptions({ question }: { readonly question: SelectQuestion }): ReactElement {
  // Neither row belongs to a multi-select: nothing is chosen until something is, and a
  // respondent takes a choice back by unpicking it. Nor to a read-only one, which offers
  // what was answered and no way to change it.
  const prompts = !(question instanceof MultiSelectQuestion) && !question.isReadOnly;
  const clearable = prompts && !question.isRequired;
  return (
    <>
      {prompts && (question.placeholder.length > 0 || !clearable) ? (
        <option value="" hidden>
          {question.placeholder}
        </option>
      ) : null}
      {clearable ? <option value="">{''}</option> : null}
      {optionsFor(question).map((choice) => (
        <option key={String(choice.value)} value={String(choice.value)}>
          {choice.text}
        </option>
      ))}
    </>
  );
}

/** A select's current selection, in the shape React's controlled `value` expects. */
export function currentSelection(question: SelectQuestion): string | string[] {
  return question instanceof MultiSelectQuestion
    ? question.selectedValues.map(String)
    : String(question.value ?? '');
}
