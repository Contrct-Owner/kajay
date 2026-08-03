import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * Survey and page timers — checklist E8.
 *
 * Not one of these tests waits for a real second to pass. The clock is injected, the
 * host decides when to tick, and time moves because the test moved it — which is the
 * whole reason the timer computes rather than schedules.
 */
class TestClock {
  #at = Date.parse('2026-08-03T09:00:00.000Z');

  readonly now = (): Date => new Date(this.#at);

  advance(seconds: number): void {
    this.#at += seconds * 1000;
  }
}

function build(
  definition: Readonly<Record<string, unknown>>,
  clock: TestClock,
): Survey {
  return parseSurvey(definition, createTestRegistry(), { now: clock.now }).survey;
}

function timedSurvey(clock: TestClock, extra: Readonly<Record<string, unknown>> = {}): Survey {
  return build(
    {
      maxTimeToFinish: 60,
      ...extra,
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'first' }] },
        { name: 'p2', elements: [{ type: 'text', name: 'second' }] },
      ],
    },
    clock,
  );
}

describe('parity/E8-timer', () => {
  test('an injected clock reaches the survey through parseSurvey', () => {
    // It did not before E8: the registry builds a survey through a no-argument factory,
    // so a `now` handed to `parseSurvey` used to reach nothing at all.
    const clock = new TestClock();
    const survey = timedSurvey(clock);
    survey.timer.start();

    clock.advance(7);
    expect(survey.timer.surveyTime.elapsed).toBe(7);
  });

  test('nothing is running until the host starts it', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock);

    // A survey parsed on a server to score a stored response is not being sat by
    // anybody; a clock that began at construction would have it arrive over its limit.
    expect(survey.timer.isRunning).toBe(false);
    clock.advance(90);
    expect(survey.timer.surveyTime).toEqual({ elapsed: 0, limit: 60, remaining: 60 });

    survey.timer.tick();
    expect(survey.isCompleted).toBe(false);
  });

  test('a clock reads zero for the whole of its first second', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock);
    survey.timer.start();

    clock.advance(0.999);
    expect(survey.timer.surveyTime.elapsed).toBe(0);
    clock.advance(0.001);
    expect(survey.timer.surveyTime.elapsed).toBe(1);
  });

  test('time passes whether or not anybody ticks', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock);
    survey.timer.start();

    // A respondent who backgrounds the tab has not paused the exam. Elapsed is computed
    // from the clock when asked, never accumulated a tick at a time.
    clock.advance(45);
    expect(survey.timer.surveyTime).toEqual({ elapsed: 45, limit: 60, remaining: 15 });
  });

  test('running out of survey time completes it, and only once', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock);
    const completions: unknown[] = [];
    survey.onComplete.add((event) => completions.push(event.data));
    survey.timer.start();

    clock.advance(59);
    survey.timer.tick();
    expect(survey.isCompleted).toBe(false);

    clock.advance(1);
    survey.timer.tick();
    expect(survey.isCompleted).toBe(true);
    expect(completions).toHaveLength(1);

    clock.advance(60);
    survey.timer.tick();
    expect(completions).toHaveLength(1);
  });

  test('an expired survey is submitted as it stands', () => {
    const clock = new TestClock();
    const survey = build(
      {
        maxTimeToFinish: 30,
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'answered' },
              { type: 'text', name: 'missing', isRequired: true },
            ],
          },
        ],
      },
      clock,
    );
    survey.setValue('answered', 'here');
    survey.timer.start();

    clock.advance(30);
    survey.timer.tick();

    // No validation gate. A deadline that could be held off by leaving a question blank
    // would not be a deadline.
    expect(survey.isCompleted).toBe(true);
    expect(survey.data).toEqual({ answered: 'here' });
  });

  test('the timer stops when the survey ends by any route', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock);
    survey.timer.start();
    survey.complete();

    expect(survey.timer.isRunning).toBe(false);
  });
});

describe('parity/E8-page-timer', () => {
  function pageTimed(clock: TestClock): Survey {
    return build(
      {
        maxTimeToFinishPage: 10,
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'first' }] },
          { name: 'p2', maxTimeToFinish: 25, elements: [{ type: 'text', name: 'second' }] },
          { name: 'p3', elements: [{ type: 'text', name: 'third' }] },
        ],
      },
      clock,
    );
  }

  test('a page turns itself when its time is up', () => {
    const clock = new TestClock();
    const survey = pageTimed(clock);
    survey.timer.start();

    clock.advance(10);
    survey.timer.tick();
    expect(survey.currentPage?.name).toBe('p2');
  });

  test('a page states its own allowance over the survey default', () => {
    const clock = new TestClock();
    const survey = pageTimed(clock);
    survey.timer.start();
    survey.goTo('p2');

    expect(survey.timer.pageTime.limit).toBe(25);
    clock.advance(10);
    survey.timer.tick();
    expect(survey.currentPage?.name).toBe('p2');

    clock.advance(15);
    survey.timer.tick();
    expect(survey.currentPage?.name).toBe('p3');
  });

  test('turning the page restarts the page clock but not the survey clock', () => {
    const clock = new TestClock();
    const survey = pageTimed(clock);
    survey.timer.start();

    clock.advance(6);
    survey.nextPage();
    expect(survey.timer.pageTime.elapsed).toBe(0);
    expect(survey.timer.surveyTime.elapsed).toBe(6);
  });

  test('a page-change listener sees the new page allowance, not the old remainder', () => {
    const clock = new TestClock();
    const survey = pageTimed(clock);
    survey.timer.start();
    clock.advance(6);
    const seen: (number | undefined)[] = [];
    survey.onCurrentPageChanged.add(() => seen.push(survey.timer.pageTime.remaining));

    survey.nextPage();

    // The clock restarts *before* anyone is told. A listener that reads the timer on a
    // page change — to draw it, to log it — would otherwise see the page they just left.
    expect(seen).toEqual([25]);
  });

  test('the survey clock wins when both run out at once', () => {
    const clock = new TestClock();
    const survey = build(
      {
        maxTimeToFinish: 10,
        maxTimeToFinishPage: 10,
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'first' }] },
          { name: 'p2', elements: [{ type: 'text', name: 'second' }] },
        ],
      },
      clock,
    );
    survey.timer.start();

    clock.advance(10);
    survey.timer.tick();

    // Turning the page instead would leave the respondent looking at a fresh page of a
    // survey that is already over.
    expect(survey.isCompleted).toBe(true);
    expect(survey.currentPage?.name).toBe('p1');
  });

  test('a page timeout on the last page still offers the preview', () => {
    const clock = new TestClock();
    const survey = build(
      {
        maxTimeToFinishPage: 5,
        showPreviewBeforeComplete: 'showAllQuestions',
        pages: [{ name: 'p1', elements: [{ type: 'text', name: 'first' }] }],
      },
      clock,
    );
    survey.timer.start();

    clock.advance(5);
    survey.timer.tick();

    // The page's time is up, not the survey's — there is still time to check the
    // answers, which is exactly what the preview is for.
    expect(survey.status.state).toBe('preview');
    expect(survey.isCompleted).toBe(false);

    // And the page clock does not keep running underneath the preview. It did once: the
    // limit still resolved against the page they had left, so the survey submitted
    // itself five seconds into somebody's review.
    expect(survey.timer.pageTime.limit).toBe(0);
    clock.advance(60);
    survey.timer.tick();
    expect(survey.isCompleted).toBe(false);
  });

  test('an untimed survey has clocks that never expire', () => {
    const clock = new TestClock();
    const survey = build(
      { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'first' }] }] },
      clock,
    );
    survey.timer.start();

    clock.advance(100_000);
    survey.timer.tick();
    expect(survey.isCompleted).toBe(false);
    expect(survey.timer.surveyTime).toEqual({
      elapsed: 100_000,
      limit: 0,
      remaining: undefined,
    });
  });
});

describe('parity/E8-timer-panel', () => {
  test('the panel is off unless the definition asks for it', () => {
    const clock = new TestClock();
    expect(timedSurvey(clock).showTimerPanel).toBe('none');
  });

  test('an unrecognised panel setting falls back rather than throwing', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock, { showTimerPanel: 'sideways', showTimerPanelMode: 'both' });

    expect(survey.showTimerPanel).toBe('none');
    expect(survey.showTimerPanelMode).toBe('all');
  });

  test('the panel settings survive a round trip', () => {
    const clock = new TestClock();
    const survey = timedSurvey(clock, { showTimerPanel: 'top', showTimerPanelMode: 'survey' });

    expect(survey.showTimerPanel).toBe('top');
    expect(survey.showTimerPanelMode).toBe('survey');
  });
});
