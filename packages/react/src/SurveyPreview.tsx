import type { Survey as SurveyModel } from '@kajay/core';
import type { FormEvent, ReactElement } from 'react';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import { SurveyElements } from './SurveyElements.js';

export interface SurveyPreviewProps {
  readonly survey: SurveyModel;
  readonly renderers: PageElementRendererRegistry;
}

/**
 * What the respondent is about to submit, before they submit it.
 *
 * The same question renderers, not a bespoke summary table: an answer shown in a
 * different control from the one it was given in is an invitation to misread it, and a
 * summary would need its own formatting for every question type — which is where the
 * table and the form start to disagree.
 *
 * Nothing here makes it read-only. The survey reports itself read-only while previewing,
 * so every question already is; a renderer that had to remember would be a renderer that
 * could forget.
 *
 * Flat rather than paginated, because the point of the screen is to see the whole
 * response at once — that is what the respondent is being asked to confirm.
 */
export function SurveyPreview({ survey, renderers }: SurveyPreviewProps): ReactElement {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    survey.nextPageOrComplete();
  };

  return (
    <form className="kajay-survey kajay-survey--preview" onSubmit={handleSubmit} noValidate>
      <h2 className="kajay-survey__preview-title">{survey.uiText('preview')}</h2>

      <SurveyElements survey={survey} elements={survey.previewQuestions} renderers={renderers} />

      <div className="kajay-navigation">
        {/* Back to the pages, not to the first one: they were part-way through, and a
            preview that costs a respondent their place is one they learn not to open. */}
        <button
          className="kajay-navigation__previous"
          type="button"
          onClick={() => {
            survey.status.cancelPreview();
          }}
        >
          {survey.uiText('editAnswers')}
        </button>
        <button className="kajay-navigation__next" type="submit">
          Complete
        </button>
      </div>
    </form>
  );
}
