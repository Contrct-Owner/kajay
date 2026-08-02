import { measureProgress, parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    {
      showProgressBar: 'top',
      ...extra,
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'first', isRequired: true },
            { type: 'text', name: 'second' },
          ],
        },
        { name: 'p2', elements: [{ type: 'text', name: 'third', isRequired: true }] },
        { name: 'p3', elements: [{ type: 'text', name: 'fourth' }] },
      ],
    },
    createTestRegistry(),
  ).survey;
}

describe('parity/E3-progress', () => {
  test('by default the bar counts pages, and counts what is behind them', () => {
    const survey = build();
    expect(survey.progressBarType).toBe('pages');
    expect(measureProgress(survey)).toEqual({
      done: 0,
      total: 3,
      ratio: 0,
      label: '0 of 3 pages completed',
    });

    survey.setValue('first', 'a');
    survey.nextPageOrComplete();
    // Two thirds on the last page, not three: they are looking at it, so it is not
    // finished. Flattering the number tells someone they are done with a page of
    // questions still in front of them.
    survey.setValue('third', 'c');
    survey.nextPageOrComplete();
    expect(measureProgress(survey).ratio).toBeCloseTo(2 / 3);
  });

  test('counting questions measures the answers instead of the steps', () => {
    const survey = build({ progressBarType: 'questions' });
    survey.setValue('first', 'a');

    // Across the whole survey, not the page: a bar that reset on every page would be
    // measuring the wrong thing twice.
    expect(measureProgress(survey)).toEqual({
      done: 1,
      total: 4,
      ratio: 0.25,
      label: '1 of 4 questions completed',
    });
  });

  test('counting required questions ignores the optional ones', () => {
    const survey = build({ progressBarType: 'requiredQuestions' });
    survey.setValue('second', 'b');
    // Answering something optional moved nothing: on a form whose optional questions
    // outnumber its required ones, counting them all makes it look further from done
    // than it is.
    expect(measureProgress(survey).done).toBe(0);

    survey.setValue('first', 'a');
    expect(measureProgress(survey)).toEqual({
      done: 1,
      total: 2,
      ratio: 0.5,
      label: '1 of 2 questions completed',
    });
  });

  test('a question nobody can reach is not part of the total', () => {
    const survey = parseSurvey(
      {
        showProgressBar: 'top',
        progressBarType: 'questions',
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'plan' },
              { type: 'text', name: 'card', visibleIf: '{plan} = "paid"' },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    expect(measureProgress(survey).total).toBe(1);
    survey.setValue('plan', 'paid');
    // The bar grew because the survey did. Counting hidden questions would show a
    // respondent progress falling as they answer.
    expect(measureProgress(survey).total).toBe(2);
  });

  test('nothing to answer is nothing outstanding', () => {
    const survey = build({ progressBarType: 'requiredQuestions' });
    for (const question of survey.questions) {
      question.setPropertyValue('isRequired', false);
    }
    // A full bar rather than an empty one: an empty bar on a form that cannot be
    // advanced any further is a lie in the more misleading direction.
    expect(measureProgress(survey)).toEqual({
      done: 0,
      total: 0,
      ratio: 1,
      label: '0 of 0 questions completed',
    });
  });

  test('one of something is not one of somethings', () => {
    const survey = parseSurvey(
      {
        progressBarType: 'pages',
        pages: [{ name: 'p1', elements: [{ type: 'text', name: 'only' }] }],
      },
      createTestRegistry(),
    ).survey;
    expect(measureProgress(survey).label).toBe('0 of 1 page completed');
  });

  test('the bar is off unless the definition asks for it, and knows where it goes', () => {
    expect(build({ showProgressBar: 'nowhere' }).showProgressBar).toBe('off');
    expect(build({ showProgressBar: 'both' }).showProgressBar).toBe('both');
    expect(build({}).showTOC).toBe(false);
  });
});
