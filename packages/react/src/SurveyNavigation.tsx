import type { Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';

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
export function SurveyNavigation({ survey }: SurveyNavigationProps): ReactElement {
  const { isFirstPage, isLastPage, pageCount, currentPageNo } = survey;

  return (
    <div className="kajay-navigation">
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

      <button className="kajay-navigation__next" type="submit">
        {isLastPage ? 'Complete' : 'Next'}
      </button>
    </div>
  );
}
