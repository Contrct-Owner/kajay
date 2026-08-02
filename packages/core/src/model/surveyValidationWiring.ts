import { collectVisibleQuestions } from './pageElements.js';
import type { Survey } from './Survey.js';
import type { SurveyValidationHost } from './SurveyValidation.js';

/** The half of the validation host that only the survey internals can supply. */
export type ValidationWiring = Pick<
  SurveyValidationHost,
  | 'readProperty'
  | 'writeProperty'
  | 'evaluate'
  | 'data'
  | 'hostErrors'
  | 'announce'
  | 'flush'
  | 'announceValidating'
>;

/**
 * Assembles what validation is allowed to see.
 *
 * Everything here is readable from the survey's own public API, so it lives outside the
 * class: a five-line object literal buried in a field initializer is where the rule
 * "only reachable questions are checked" would go unnoticed, and it is not a small rule.
 */
export function createValidationHost(
  survey: Survey,
  wiring: ValidationWiring,
): SurveyValidationHost {
  return {
    currentPageQuestions: () => collectVisibleQuestions(survey.currentPage?.elements ?? []),
    // Visible pages only, and `collectVisibleQuestions` rather than `survey.questions`:
    // a question the respondent can never reach — on a hidden page, or inside a hidden
    // panel — must not be able to hold completion hostage over an error nobody can see.
    allQuestions: () =>
      survey.visiblePages.flatMap((page) => collectVisibleQuestions(page.elements)),
    isLastPage: () => survey.isLastPage,
    ...wiring,
  };
}
