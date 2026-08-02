import type { Survey } from '@kajay/core';
import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Gives the first question on each page focus as the page arrives.
 *
 * Opt-in, and off by default, because it is a genuine trade. On a wizard whose pages
 * hold one question it saves a respondent a keystroke every page. On a long page it
 * drops someone using a screen reader past the page's own title and any instructions
 * above the first field — which is why doing this unasked is a bad default rather than
 * a helpful one.
 *
 * Keyed on the page number, so it fires on arrival and not on every re-render: without
 * that, focus would be yanked back to the first field on every keystroke elsewhere.
 */
export function useAutoFocus(
  survey: Survey,
  formRef: RefObject<HTMLFormElement | null>,
  currentPageNo: number,
): void {
  useEffect(() => {
    if (!survey.autoFocusFirstQuestion) {
      return;
    }
    const form = formRef.current;
    const control = form?.querySelector<HTMLElement>(
      '[data-question-name] input:not([disabled]), [data-question-name] select:not([disabled]), [data-question-name] textarea:not([disabled])',
    );
    control?.focus();
  }, [survey, formRef, currentPageNo]);
}
