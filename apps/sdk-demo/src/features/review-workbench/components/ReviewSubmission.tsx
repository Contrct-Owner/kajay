import { parseSurvey } from '@kajay/core';
import { Survey } from '@kajay/react';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { ReviewTaskDetail } from '../api/ReviewWorkbenchTypes.js';

export function ReviewSubmission({ detail }: { readonly detail: ReviewTaskDetail }): ReactElement {
  const model = useMemo(() => {
    const survey = parseSurvey(detail.definition).survey;
    survey.restoreSnapshot({
      ...detail.submission.snapshot,
      lifecycle: 'running',
      timer: null,
    });
    survey.status.enterPreview();
    return survey;
  }, [detail]);
  return (
    <section className="review-submission" aria-labelledby="review-submission-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Immutable submission</p>
          <h3 id="review-submission-heading">{model.title || 'Survey response'}</h3>
        </div>
        <span>Attempt {detail.submission.attemptNumber}</span>
      </div>
      <Survey model={model} />
    </section>
  );
}
