import { measureProgress } from '@kajay/core';
import type { ProgressBarLocation, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import { useSurveyAnswerChanges } from './useSurveyState.js';

export interface SurveyProgressBarProps {
  readonly survey: SurveyModel;
  /** Which of the two possible positions this one is. */
  readonly at: 'top' | 'bottom';
}

/** Whether a bar in this position is wanted. */
function isDrawnAt(location: ProgressBarLocation, at: 'top' | 'bottom'): boolean {
  return location === at || location === 'both';
}

/**
 * How far through the survey the respondent is.
 *
 * A native `<progress>` rather than a styled `div` with `role="progressbar"`: it is
 * announced, it degrades to something readable without CSS, and its value is a real
 * number a browser can report — none of which a div gets without being told each thing
 * separately.
 *
 * The text beside it is not decoration. "Two thirds" is a shape; "2 of 3 pages
 * completed" is the fact, and it is the only version that survives being read aloud.
 */
export function SurveyProgressBar({ survey, at }: SurveyProgressBarProps): ReactElement | null {
  // Before the early return, because hooks are unconditional — and because everything
  // this bar can measure except the page number moves when an answer does.
  useSurveyAnswerChanges(survey);

  if (!isDrawnAt(survey.showProgressBar, at)) {
    return null;
  }
  const progress = measureProgress(survey);

  return (
    <div className="kajay-progress" data-at={at}>
      <progress
        className="kajay-progress__bar"
        max={1}
        value={progress.ratio}
        aria-label={progress.label}
      />
      <p className="kajay-progress__label">{progress.label}</p>
    </div>
  );
}
