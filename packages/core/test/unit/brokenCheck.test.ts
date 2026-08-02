import { parseSurvey } from '@kajay/core';
import type { ServerValidationError, Survey } from '@kajay/core';
import { expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * What happens when the check itself breaks, rather than a validator inside it.
 *
 * The failure both of these describe is the same one, and it is the worst one this
 * subsystem has: `isValidating` stuck true. A respondent sees a Next button that reads
 * "Checking…" and never comes back — no error, no way forward, nothing to retry. Every
 * path out of an outstanding check has to put that flag down, including the paths
 * nobody planned for.
 */
function withServerValidator(validate: () => Promise<ServerValidationError[]>): Survey {
  const survey = parseSurvey(
    { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'code' }] }] },
    createTestRegistry(),
  ).survey;
  survey.validation.setServerValidator(validate);
  survey.setValue('code', 'KJ-1');
  return survey;
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

test('parity/D4-server-validation: a server hook that resolves with nonsense is a check failure', async () => {
  // Not a rejection — this one *succeeds*, with something that is not a list of errors.
  // Reading it fails inside the gathering code, past the guards that catch a hook which
  // rejects, and nothing below that was watching for it.
  const survey = withServerValidator(() =>
    Promise.resolve(undefined as unknown as ServerValidationError[]),
  );

  expect(survey.nextPageOrComplete()).toBe('pending');
  await flush();

  expect(survey.validation.isValidating).toBe(false);
  expect(survey.validation.checkError).not.toBeUndefined();
  // Refused, because nothing confirmed the answers — but no answer is marked wrong.
  expect(survey.isCompleted).toBe(false);
  expect(survey.getQuestionByName('code')?.errors).toEqual([]);
});

test('parity/D4-validate-question-event: a host rule that throws does not freeze the survey', async () => {
  const survey = withServerValidator(() => Promise.resolve([]));
  let calls = 0;
  survey.onValidateQuestion.add(() => {
    calls += 1;
    // Throws on the second pass only. The gate checks the answers once before asking
    // anything to leave the process and again when the reply lands, so a host rule can
    // pass the first and fail the second — which is the only pass that runs with the
    // survey mid-check and everything hanging on the flag coming down.
    if (calls > 1) {
      throw new Error('the host rule exploded');
    }
  });

  expect(survey.nextPageOrComplete()).toBe('pending');
  await flush();

  expect(survey.validation.isValidating).toBe(false);
  expect(survey.validation.checkError).toBe('the host rule exploded');
  expect(survey.isCompleted).toBe(false);
});

test('parity/D4-server-validation: the survey recovers rather than staying stuck', async () => {
  const survey = withServerValidator(() =>
    Promise.resolve(undefined as unknown as ServerValidationError[]),
  );
  survey.nextPageOrComplete();
  await flush();

  // The point of putting the flag down: the next press starts a real check rather than
  // returning `pending` against a request that will never land.
  survey.validation.setServerValidator(() => Promise.resolve([]));
  expect(survey.nextPageOrComplete()).toBe('pending');
  await flush();

  expect(survey.isCompleted).toBe(true);
});
