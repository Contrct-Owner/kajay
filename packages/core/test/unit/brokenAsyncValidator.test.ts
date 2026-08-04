import { AsyncValidator, parseSurvey } from '@kajay/core';
import type { SurveyError } from '@kajay/core';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * What happens when a host's own async validator is broken.
 *
 * Its own file because it needs its own validator class, and the repo allows one class
 * per file — which is also why the working validator lives in asyncValidation.test.ts.
 */
class BrokenValidator extends AsyncValidator {
  override get type(): string {
    return 'brokenvalidator';
  }

  override validateAsync(): Promise<SurveyError | undefined> {
    throw new Error('lookup exploded');
  }
}

const registry = createTestRegistry();
registry.addClass({
  name: 'brokenvalidator',
  parent: 'validator',
  create: () => new BrokenValidator(),
});

test('parity/D3-async-validators: a validator that throws does not freeze the survey', async () => {
  const survey = parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'text', name: 'code', validators: [{ type: 'brokenvalidator' }] }],
        },
      ],
    },
    registry,
  ).survey;
  survey.setValue('code', 'KJ-1');

  expect(survey.nextPageOrComplete()).toBe('pending');
  await vi.waitFor(() => {
    expect(survey.validation.isValidating).toBe(false);
  });

  // Unhandled, this left `isValidating` true forever: a Next button reading
  // "Checking…" that never comes back, with no error and no way forward. The move is
  // still refused — nothing confirmed the answers — but the reason is a *check*
  // failure, not an objection to what the respondent typed.
  expect(survey.validation.isValidating).toBe(false);
  expect(survey.validation.checkError).toBe('lookup exploded');
  expect(survey.isCompleted).toBe(false);
  expect(survey.getQuestionByName('code')?.errors).toEqual([]);
});
