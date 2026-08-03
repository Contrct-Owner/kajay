import type { SelectQuestion } from '@kajay/core';
import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';

/** How long typing pauses before the term goes to the host. */
const SETTLE_DELAY = 250;

export interface ChoiceFilterFieldProps {
  readonly question: SelectQuestion;
  readonly id: string;
}

/**
 * Narrows a paged list.
 *
 * Drawn only for a paged question, and that is not an arbitrary line: an ordinary
 * `<select>` holds every option, so the browser's own type-ahead already finds them,
 * while a paged one holds a page of a thousand and type-ahead can only reach what has
 * already arrived. This field asks the host instead.
 *
 * A plain labelled search box rather than a combobox. The combobox — one control that
 * is both the field and the list — is a roving-focus ARIA widget and belongs to Phase
 * 2's accessibility pass; a search field beside a native list is keyboard-operable and
 * screen-reader-correct today, with no interaction code of its own.
 */
export function ChoiceFilterField({ question, id }: ChoiceFilterFieldProps): ReactElement {
  const [term, setTerm] = useState(question.choiceFilter);

  useEffect(() => {
    // Debounced, because every distinct term is a request: sending one per keystroke
    // would ask the host seven times for a six-letter city and use the last answer.
    const timer = setTimeout(() => {
      question.setChoiceFilter(term);
    }, SETTLE_DELAY);
    return () => {
      clearTimeout(timer);
    };
  }, [question, term]);

  return (
    <div className="kajay-choice-filter">
      <label className="kajay-choice-filter__label" htmlFor={id}>
        Filter options
      </label>
      <input
        id={id}
        className="kajay-choice-filter__input"
        type="search"
        value={term}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setTerm(event.target.value);
        }}
      />
    </div>
  );
}
