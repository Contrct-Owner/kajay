import type { Survey } from '@kajay/core';
import { useSurveyValidating } from '@kajay/react';
import type { ReactElement } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { checkLog, recordCheckEvent, subscribeToCheckLog } from './checkLog.js';

/** How often the elapsed reading refreshes while a check is outstanding. */
const TICK = 500;

export interface CheckTimelineProps {
  readonly model: Survey;
}

/**
 * How long the check has been outstanding, refreshed while one is.
 *
 * The reading is itself a signal. It is driven by a timer, so if it *stops advancing*
 * while the survey still says it is checking, the page's timers are being starved —
 * which is one of the two explanations for the stuck-"Checking…" flake, and the one no
 * amount of staring at the model would have told apart from the other.
 */
function useElapsed(isValidating: boolean, since: number | undefined): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!isValidating) {
      return;
    }
    setNow(performance.now());
    const timer = setInterval(() => {
      setNow(performance.now());
    }, TICK);
    return () => {
      clearInterval(timer);
    };
  }, [isValidating, since]);

  return since === undefined ? 0 : Math.max(0, Math.round(now - since));
}

/**
 * What the last validation check did, as text on the page.
 *
 * On the page rather than in the console on purpose: a Playwright failure snapshot
 * captures the accessibility tree, so anything written here survives into the artefact
 * of a run that failed once in a hundred — which is the only way this particular defect
 * has ever been observed.
 */
export function CheckTimeline({ model }: CheckTimelineProps): ReactElement {
  const entries = useSyncExternalStore(subscribeToCheckLog, checkLog);
  const isValidating = useSurveyValidating(model);

  useEffect(
    () =>
      model.onValidatingChanged.add((event) => {
        recordCheckEvent(event.isValidating ? 'check started' : 'check settled');
      }),
    [model],
  );

  const startedAt = entries.findLast((entry) => entry.label === 'check started')?.at;
  const elapsed = useElapsed(isValidating, startedAt);

  return (
    <section className="host-demo__panel" aria-label="Check timeline">
      <h2>Check timeline</h2>
      <p data-testid="check-state">
        {isValidating ? `checking for ${String(elapsed)}ms` : 'idle'}
      </p>
      <ol className="host-demo__timeline" data-testid="check-log">
        {entries.map((entry, index) => (
          <li key={`${String(entry.at)}:${String(index)}`}>
            {`+${String(entry.at)}ms ${entry.label}`}
          </li>
        ))}
      </ol>
    </section>
  );
}
