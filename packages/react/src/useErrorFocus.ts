import type { Survey } from '@kajay/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface ErrorFocus {
  /** Attach to the form element that contains the questions. */
  readonly formRef: RefObject<HTMLFormElement | null>;
  /** Call after a move the model refused. Focus lands once the errors have rendered. */
  readonly requestFocus: () => void;
}

/**
 * Moves focus to the first question that blocked a move.
 *
 * Deliberately not done inline in the submit handler: React flushes the state update
 * that draws the errors at the *end* of the handler, so focusing there would run
 * against the previous render — and, when the blocking question is on a part of the
 * page that only appears with its error, against an element that does not exist yet.
 * An effect keyed on a counter runs after the commit, which is the point at which the
 * model's answer and the DOM agree.
 *
 * A counter rather than the question's name: two failed attempts on the same field must
 * both move focus, and a name-keyed effect would not re-run for the second.
 */
export function useErrorFocus(survey: Survey): ErrorFocus {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [attempt, setAttempt] = useState(0);

  const requestFocus = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (attempt === 0) {
      return;
    }
    focusQuestion(formRef.current, survey.validation.firstErrorQuestion?.name);
  }, [attempt, survey]);

  return { formRef, requestFocus };
}

/**
 * Focuses the first usable control inside the named question.
 *
 * Matched by reading `dataset` rather than by building a selector, because a question
 * name is author-supplied and needs no escaping this way.
 *
 * `control.disabled` rather than the `[disabled]` attribute: a `fieldset` disables its
 * descendants without marking any of them, so the attribute would miss exactly the
 * controls that cannot take focus.
 */
function focusQuestion(form: HTMLFormElement | null, name: string | undefined): void {
  if (form === null || name === undefined) {
    return;
  }
  const container = [...form.querySelectorAll<HTMLElement>('[data-question-name]')].find(
    (element) => element.dataset['questionName'] === name,
  );
  const controls = container?.querySelectorAll<HTMLInputElement>('input, select, textarea');
  for (const control of controls ?? []) {
    if (!control.disabled) {
      control.focus();
      return;
    }
  }
}
