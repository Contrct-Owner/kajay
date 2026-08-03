import type { Survey as SurveyModel } from '@kajay/core';
import { useEffect, useState } from 'react';

/**
 * Drives the model's clocks, and re-renders while they run — checklist E8.
 *
 * **The interval lives here**, in the adapter, because core is I/O-free by rule: the
 * model computes what the clocks read and acts when one runs out, and something outside
 * it has to say when to look. One second, because that is the smallest change a panel
 * can show.
 *
 * Held by the *form* rather than by the timer panel, and that is not a detail. A survey
 * with `maxTimeToFinish` and no panel is still timed — a host may well not want to show
 * a respondent a countdown — so tying the interval to the panel would mean an invisible
 * deadline that never actually arrives. The panel is a view of this; it is not what
 * makes it work.
 *
 * The re-render is local state rather than a model event. A number changing on screen is
 * not a change to the survey, and announcing one every second would re-render every
 * question in it once a second for the rest of the session.
 */
export function useSurveyTimer(survey: SurveyModel): void {
  const [, setTick] = useState(0);
  const isTimed = survey.maxTimeToFinish > 0 || survey.timer.pageTime.limit > 0;

  useEffect(() => {
    if (!isTimed) {
      return;
    }
    survey.timer.start();
    const handle = setInterval(() => {
      survey.timer.tick();
      setTick((previous) => previous + 1);
    }, 1000);
    return () => {
      clearInterval(handle);
    };
  }, [survey, isTimed]);
}
