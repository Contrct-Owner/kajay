/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Quiz mode in the DOM — checklist E8.
 *
 * The model's arithmetic is proved in the unit suite. What is left here is the part
 * only a renderer can be wrong about: that the interval exists, that it reaches the
 * model, and that expiry actually changes what is on screen.
 *
 * The clock is injected and the interval is faked, so nothing waits for a real second.
 */
class TestClock {
  #at = Date.parse('2026-08-03T09:00:00.000Z');

  readonly now = (): Date => new Date(this.#at);

  advance(seconds: number): void {
    this.#at += seconds * 1000;
  }
}

function build(definition: Readonly<Record<string, unknown>>, clock: TestClock): SurveyModel {
  return parseSurvey(definition, undefined, { now: clock.now }).survey;
}

const TIMED = {
  maxTimeToFinish: 90,
  maxTimeToFinishPage: 30,
  showTimerPanel: 'top',
  pages: [
    { name: 'p1', elements: [{ type: 'text', name: 'first', title: 'First' }] },
    { name: 'p2', elements: [{ type: 'text', name: 'second', title: 'Second' }] },
  ],
};

test('parity/E8-timer-panel: both clocks count down from their own limits', async () => {
  const clock = new TestClock();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  try {
    const screen = await render(<Survey model={build(TIMED, clock)} />);

    // Rendered before a single tick: the panel reads the model, and a panel that only
    // filled in after a second would flash empty on every timed survey.
    await expect.element(screen.getByText('0:30')).toBeInTheDocument();
    await expect.element(screen.getByText('1:30')).toBeInTheDocument();

    clock.advance(11);
    await vi.advanceTimersByTimeAsync(1000);

    await expect.element(screen.getByText('0:19')).toBeInTheDocument();
    await expect.element(screen.getByText('1:19')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('parity/E8-timer-panel: an expired page turns itself', async () => {
  const clock = new TestClock();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  try {
    const screen = await render(<Survey model={build(TIMED, clock)} />);
    await expect.element(screen.getByLabelText('First')).toBeInTheDocument();

    clock.advance(30);
    await vi.advanceTimersByTimeAsync(1000);

    // The page moved with nothing typed and nobody clicking, which is the whole point
    // of a per-page limit.
    await expect.element(screen.getByLabelText('Second')).toBeInTheDocument();
    // And the new page starts with its own full allowance rather than inheriting the
    // clock that just ran out.
    await expect.element(screen.getByText('0:30')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('parity/E8-timer-panel: a page limit alone is enough to start the clock', async () => {
  const clock = new TestClock();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  try {
    const screen = await render(
      <Survey
        model={build(
          {
            // No `maxTimeToFinish` at all — the shape the demo uses, where one page has a
            // deadline and the survey as a whole has none. Deciding to run the interval
            // from the survey limit alone leaves that page's clock stopped forever.
            showTimerPanel: 'top',
            pages: [
              {
                name: 'p1',
                maxTimeToFinish: 20,
                elements: [{ type: 'text', name: 'first', title: 'First' }],
              },
              { name: 'p2', elements: [{ type: 'text', name: 'second', title: 'Second' }] },
            ],
          },
          clock,
        )}
      />,
    );
    await expect.element(screen.getByLabelText('First')).toBeInTheDocument();

    clock.advance(20);
    await vi.advanceTimersByTimeAsync(1000);

    await expect.element(screen.getByLabelText('Second')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('parity/E8-timer-panel: an expired survey submits what there is', async () => {
  const clock = new TestClock();
  const survey = build(
    {
      maxTimeToFinish: 20,
      showTimerPanel: 'top',
      completedHtml: '<p>Handed in.</p>',
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'first', title: 'First' }] }],
    },
    clock,
  );
  vi.useFakeTimers({ shouldAdvanceTime: false });
  try {
    const screen = await render(<Survey model={survey} />);
    await expect.element(screen.getByLabelText('First')).toBeInTheDocument();

    clock.advance(20);
    await vi.advanceTimersByTimeAsync(1000);

    await expect.element(screen.getByText('Handed in.')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('parity/E8-timer-panel: a survey with no limit shows no panel', async () => {
  const clock = new TestClock();
  const screen = await render(
    <Survey
      model={build(
        {
          showTimerPanel: 'top',
          pages: [{ name: 'p1', elements: [{ type: 'text', name: 'first', title: 'First' }] }],
        },
        clock,
      )}
    />,
  );

  // Asking for the panel is not the same as having a deadline. A clock counting up from
  // zero tells a respondent they are being timed when nothing is going to happen.
  expect(screen.container.querySelector('.kajay-timer')).toBeNull();
});

test('parity/E8-timer-panel: the panel is not a live region', async () => {
  const clock = new TestClock();
  const screen = await render(<Survey model={build(TIMED, clock)} />);

  // Announcing a number that changes every second would interrupt a screen reader
  // continuously for the length of the survey. It reads on demand instead.
  const panel = screen.container.querySelector('.kajay-timer');
  expect(panel?.querySelector('[aria-live]')).toBeNull();
  expect(screen.container.querySelector('[data-clock="page"] .kajay-timer__value')).toHaveAttribute(
    'aria-label',
    'Page: 0:30 remaining',
  );
});

test('parity/E3-progress: a question-counting bar keeps up with the answers', async () => {
  const clock = new TestClock();
  const screen = await render(
    <Survey
      model={build(
        {
          showProgressBar: 'top',
          progressBarType: 'questions',
          pages: [
            {
              name: 'p1',
              elements: [
                { type: 'text', name: 'first', title: 'First' },
                { type: 'text', name: 'second', title: 'Second' },
              ],
            },
          ],
        },
        clock,
      )}
    />,
  );

  // Nothing subscribed the bar to answers until E8 needed one that counts correct
  // ones, so every question-counting bar held its first reading until something else
  // forced a render — a page turn, or a rule firing.
  await expect.element(screen.getByText('0 of 2 questions completed')).toBeInTheDocument();
  await screen.getByLabelText('First').fill('here');
  await expect.element(screen.getByText('1 of 2 questions completed')).toBeInTheDocument();
});

test('parity/E3-progress-correct: the bar reports marks earned', async () => {
  const clock = new TestClock();
  const screen = await render(
    <Survey
      model={build(
        {
          showProgressBar: 'top',
          progressBarType: 'correctQuestions',
          pages: [
            {
              name: 'p1',
              elements: [
                { type: 'text', name: 'capital', title: 'Capital', correctAnswer: 'Paris' },
                { type: 'text', name: 'river', title: 'River', correctAnswer: 'Seine' },
              ],
            },
          ],
        },
        clock,
      )}
    />,
  );

  await expect.element(screen.getByText('0 of 2 correct')).toBeInTheDocument();
  await screen.getByLabelText('Capital').fill('Paris');
  await expect.element(screen.getByText('1 of 2 correct')).toBeInTheDocument();
});
