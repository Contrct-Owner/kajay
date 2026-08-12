import { parseSurvey } from '@kajay/core';
import type { ChoiceFetcher, SelectQuestion, Survey } from '@kajay/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * What a URL-backed question does when the load does *not* work.
 *
 * Beside `restChoices.test.ts` rather than in it, because these are about the failure
 * being **noticed** rather than about the choices being right — and because a recorded
 * error nobody is told about is still a silent failure. A view rendering `choiceErrors`
 * has no reason to render again when one arrives, so a blocked or broken URL used to look
 * exactly like a URL still loading.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const countries = [
  { id: 'uk', label: 'United Kingdom' },
  { id: 'fr', label: 'France' },
];

function build(url: string, fetchJson: ChoiceFetcher): Survey {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'region' },
            {
              type: 'dropdown',
              name: 'country',
              choicesByUrl: url,
              choicesPath: 'data.items',
              choicesValueName: 'id',
              choicesTitleName: 'label',
            },
          ],
        },
      ],
    },
    createTestRegistry(),
    { fetchJson },
  ).survey;
}

function country(survey: Survey): SelectQuestion {
  return survey.getQuestionByName('country') as SelectQuestion;
}

function choiceValues(survey: Survey): readonly unknown[] {
  return country(survey).visibleChoices.map((choice) => choice.value);
}

describe('parity/B10-rest-choices', () => {
  test('a failed load announces, so a view showing the error redraws', async () => {
    let announced = 0;
    const survey = build('https://example.test/boom', () =>
      Promise.reject(new Error('network down')),
    );
    const question = country(survey);
    survey.onElementStateChanged.add((event) => {
      announced += event.state === 'choices' && event.element === question ? 1 : 0;
    });

    await vi.waitFor(() => {
      expect(survey.choiceErrors.join(' ')).toMatch(/network down/u);
    });
    expect(announced).toBeGreaterThan(0);
  });

  test('a load that fails after an earlier one succeeded keeps the choices it had', async () => {
    // Keyed on the URL, not a call count: registration fetches once before any answer is
    // set, so counting attempts numbers the wrong request.
    const survey = build('https://example.test/{region}', (url) =>
      url.endsWith('/first')
        ? Promise.resolve({ data: { items: countries } })
        : Promise.reject(new Error('network down')),
    );
    survey.setValue('region', 'first');
    await vi.waitFor(() => {
      expect(choiceValues(survey)).toEqual(['uk', 'fr']);
    });

    survey.setValue('region', 'second');
    await vi.waitFor(() => {
      expect(survey.choiceErrors.join(' ')).toMatch(/network down/u);
    });

    // Kept, not cleared: the newer attempt failed, which the error says, and discarding a
    // list the respondent can already see would make the failure worse than it is.
    expect(choiceValues(survey)).toEqual(['uk', 'fr']);
  });
});
