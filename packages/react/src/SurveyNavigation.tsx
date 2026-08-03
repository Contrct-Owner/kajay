import type { Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import { useSurveyValidating } from './useSurveyState.js';

export interface SurveyNavigationProps {
  readonly survey: SurveyModel;
}

/**
 * Previous / next / complete, and where the respondent is.
 *
 * The primary button is one control that changes label, not two that swap places:
 * moving it as the last page arrives would put "Complete" under a cursor that was
 * aiming at "Next".
 *
 * `type="button"` on both, with completion driven by the form's submit: a survey that
 * is one page long still completes on Enter, and a multi-page one does not submit
 * itself when the respondent presses Enter in a text field.
 */
/**
 * The primary button's label.
 *
 * Still one control that changes text, for the same reason it does not swap places:
 * whatever it says, it stays where the cursor already is.
 */
function validatingLabel(survey: SurveyModel, isValidating: boolean, isLastPage: boolean): string {
  if (isValidating) {
    return survey.uiText('validating');
  }
  return survey.uiText(isLastPage ? 'complete' : 'nextPage');
}

export function SurveyNavigation({ survey }: SurveyNavigationProps): ReactElement {
  const { isFirstPage, isLastPage, pageCount, currentPageNo } = survey;
  const isValidating = useSurveyValidating(survey);

  return (
    <div className="kajay-navigation">
      {survey.validation.checkError === undefined ? null : (
        // Not a question error: no answer is at fault, and saying so is the difference
        // between "fix your input" and "try that again".
        <p className="kajay-navigation__check-error" role="alert">
          {`We could not check your answers: ${survey.validation.checkError}`}
        </p>
      )}

      {pageCount > 1 ? (
        <p className="kajay-navigation__position" data-testid="page-position">
          {`Page ${currentPageNo + 1} of ${pageCount}`}
        </p>
      ) : null}

      {isFirstPage ? null : (
        <button
          className="kajay-navigation__previous"
          type="button"
          onClick={() => {
            survey.prevPage();
          }}
        >
          Previous
        </button>
      )}

      {/* Disabled while a check is outstanding, so a respondent cannot queue a second
          round trip behind the first — and so the wait is visible rather than the page
          simply not responding. */}
      <button
        className="kajay-navigation__next"
        type="submit"
        disabled={isValidating}
        aria-busy={isValidating || undefined}
      >
        {validatingLabel(survey, isValidating, isLastPage)}
      </button>
    </div>
  );
}
