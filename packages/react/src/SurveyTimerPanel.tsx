import type { Survey as SurveyModel, TimerReading } from '@kajay/core';
import type { ReactElement } from 'react';
import { useCssClass } from './SurveyCssContext.js';

export interface SurveyTimerPanelProps {
  readonly survey: SurveyModel;
  /** Which of the two possible positions this one is. */
  readonly at: 'top' | 'bottom';
}

/** `m:ss`, or `h:mm:ss` once there is an hour to show. */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const shown = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const tail = `${shown}:${String(rest).padStart(2, '0')}`;
  return hours > 0 ? `${String(hours)}:${tail}` : tail;
}

/**
 * One clock, in words as well as digits.
 *
 * Counting **down** where there is a limit and up where there is not, because those are
 * different facts: "4:31 remaining" is what a respondent needs in order to decide what
 * to do next, and "0:29 elapsed" tells them nothing about whether to hurry.
 */
function Clock({
  survey,
  label,
  reading,
}: {
  readonly survey: SurveyModel;
  readonly label: string;
  readonly reading: TimerReading;
}): ReactElement {
  const seconds = reading.remaining ?? reading.elapsed;
  const suffix = survey.uiText(reading.remaining === undefined ? 'timerElapsed' : 'timerRemaining');
  const spoken = `${label}: ${formatDuration(seconds)} ${suffix}`;

  return (
    <p className="kajay-timer__clock" data-clock={label.toLowerCase()}>
      <span className="kajay-timer__label">{label}</span>
      {/* The digits change every second, so this is deliberately *not* a live region:
          announcing it would interrupt a screen reader continuously for the length of
          the survey. It reads on demand, and expiry announces itself by the page or the
          survey actually changing. */}
      <span className="kajay-timer__value" aria-label={spoken}>
        {formatDuration(seconds)}
      </span>
    </p>
  );
}

/**
 * What the clocks say — checklist E8.
 *
 * Display only: [`useSurveyTimer`](./useSurveyTimer.ts) is what makes them run, held by
 * the form so that a timed survey with the panel switched off still reaches its
 * deadline.
 *
 * Drawn only when the definition asks for it *and* something is actually limited. A
 * panel counting up from zero with no deadline behind it is furniture, and one that
 * appears on an untimed survey tells the respondent they are being timed when they are
 * not.
 */
export function SurveyTimerPanel({ survey, at }: SurveyTimerPanelProps): ReactElement | null {
  const className = useCssClass('timer', 'kajay-timer');
  const mode = survey.showTimerPanelMode;
  const pageTime = survey.timer.pageTime;
  const surveyTime = survey.timer.surveyTime;

  if (survey.showTimerPanel !== at || (pageTime.limit === 0 && surveyTime.limit === 0)) {
    return null;
  }

  return (
    <div className={className} data-at={at}>
      {mode === 'survey' ? null : (
        <Clock survey={survey} label={survey.uiText('timerPage')} reading={pageTime} />
      )}
      {mode === 'page' ? null : (
        <Clock survey={survey} label={survey.uiText('timerSurvey')} reading={surveyTime} />
      )}
    </div>
  );
}
