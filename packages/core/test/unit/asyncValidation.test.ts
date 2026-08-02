import { AsyncValidator, globalRegistry, parseSurvey } from '@kajay/core';
import type { ServerValidator, Survey, SurveyError, ValidationContext } from '@kajay/core';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * Custom and async validators (D3) and the server seam (D4).
 *
 * The custom validator here is registered exactly as a host would register one — a
 * subclass plus a registry entry — because "a host can add a check of its own" is the
 * row, and a validator the library ships would prove nothing about it.
 */
class ReservedNameValidator extends AsyncValidator {
  /** Every instance records what it was asked, so a test can prove staleness handling. */
  static readonly asked: string[] = [];

  override get type(): string {
    return 'reservednamevalidator';
  }

  override async validateAsync({ value }: ValidationContext): Promise<SurveyError | undefined> {
    const text = String(value);
    ReservedNameValidator.asked.push(text);
    await Promise.resolve();
    return text === 'admin' ? { kind: this.type, text: `"${text}" is reserved.` } : undefined;
  }
}

const registry = createTestRegistry();
registry.addClass({
  name: 'reservednamevalidator',
  parent: 'validator',
  create: () => new ReservedNameValidator(),
});

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, registry).survey;
}

function withReservedName(): Survey {
  return build({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'text',
            name: 'nickname',
            isRequired: true,
            validators: [{ type: 'reservednamevalidator' }],
          },
        ],
      },
    ],
  });
}

function errorsOf(survey: Survey, name: string): readonly string[] {
  return (survey.getQuestionByName(name)?.errors ?? []).map((error) => error.text);
}

/** Resolves once every pending promise callback has run. A macrotask on purpose. */
function flushPendingWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

afterEach(() => {
  ReservedNameValidator.asked.length = 0;
});

describe('parity/D3-async-validators', () => {
  test('a move waits for the check, then happens on its own', async () => {
    const survey = withReservedName();
    survey.setValue('nickname', 'ada');

    expect(survey.nextPageOrComplete()).toBe('pending');
    expect(survey.validation.isValidating).toBe(true);
    expect(survey.isCompleted).toBe(false);

    await flushPendingWork();
    expect(survey.validation.isValidating).toBe(false);
    expect(survey.isCompleted).toBe(true);
  });

  test('a failed check blocks the move and reports against the answer', async () => {
    const survey = withReservedName();
    survey.setValue('nickname', 'admin');

    expect(survey.nextPageOrComplete()).toBe('pending');
    await flushPendingWork();

    expect(survey.isCompleted).toBe(false);
    expect(errorsOf(survey, 'nickname')).toEqual(['"admin" is reserved.']);
  });

  test('the synchronous checks run first, so a known-bad answer costs no round trip', async () => {
    const survey = withReservedName();
    // Required and unanswered. Paying for a lookup to confirm an answer already known
    // to be wrong would be a request bought with nothing.
    expect(survey.nextPageOrComplete()).toBe('blocked');
    await flushPendingWork();
    expect(ReservedNameValidator.asked).toEqual([]);
  });

  test('an empty answer is never sent, exactly as in the synchronous pass', async () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'nickname', validators: [{ type: 'reservednamevalidator' }] },
          ],
        },
      ],
    });
    expect(survey.nextPageOrComplete()).toBe('advanced');
    await flushPendingWork();
    expect(ReservedNameValidator.asked).toEqual([]);
  });

  test('pressing again while one is outstanding does not start a second', async () => {
    const survey = withReservedName();
    survey.setValue('nickname', 'ada');

    expect(survey.nextPageOrComplete()).toBe('pending');
    expect(survey.nextPageOrComplete()).toBe('pending');

    await flushPendingWork();
    expect(ReservedNameValidator.asked).toEqual(['ada']);
  });

  test('an answer that changed while the check was in flight does not move on', async () => {
    const survey = withReservedName();
    survey.setValue('nickname', 'ada');
    survey.nextPageOrComplete();

    // The respondent kept typing. Completing on the strength of a check against a value
    // they have already replaced would be the wrong answer confidently applied.
    survey.setValue('nickname', 'admin');
    await flushPendingWork();

    expect(survey.isCompleted).toBe(false);
  });

  test('validating state is announced both ways', async () => {
    const survey = withReservedName();
    survey.setValue('nickname', 'ada');
    const seen: boolean[] = [];
    survey.onValidatingChanged.add((event) => seen.push(event.isValidating));

    survey.nextPageOrComplete();
    await flushPendingWork();

    expect(seen).toEqual([true, false]);
  });
});

describe('parity/D4-server-validation', () => {
  function withServerValidator(validate: ServerValidator): Survey {
    const survey = build({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'code' }] }],
    });
    survey.validation.setServerValidator(validate);
    return survey;
  }

  test('the server sees the answers and the questions under the gate', async () => {
    const validate = vi.fn<ServerValidator>(() => Promise.resolve([]));
    const survey = withServerValidator(validate);
    survey.setValue('code', 'KJ-1');

    expect(survey.nextPageOrComplete()).toBe('pending');
    await flushPendingWork();

    expect(validate).toHaveBeenCalledWith({
      data: { code: 'KJ-1' },
      questionNames: ['code'],
    });
    expect(survey.isCompleted).toBe(true);
  });

  test('an objection from the server lands on the question it names', async () => {
    const survey = withServerValidator(() =>
      Promise.resolve([{ questionName: 'code', text: 'That code is already in use.' }]),
    );
    survey.setValue('code', 'KJ-1');
    survey.nextPageOrComplete();
    await flushPendingWork();

    expect(survey.isCompleted).toBe(false);
    expect(errorsOf(survey, 'code')).toEqual(['That code is already in use.']);
  });

  test('a failed request blocks the move without blaming an answer', async () => {
    const survey = withServerValidator(() => Promise.reject(new Error('Network down')));
    survey.setValue('code', 'KJ-1');
    survey.nextPageOrComplete();
    await flushPendingWork();

    // The server is the authority and nothing confirmed the answers, so the move is
    // refused — but the respondent's answer is not at fault and is not marked as such.
    expect(survey.isCompleted).toBe(false);
    expect(errorsOf(survey, 'code')).toEqual([]);
    expect(survey.validation.serverError).toBe('Network down');
  });

  test('removing the validator makes the gate synchronous again', () => {
    const survey = withServerValidator(() => Promise.resolve([]));
    survey.validation.setServerValidator(undefined);
    survey.setValue('code', 'KJ-1');

    expect(survey.nextPageOrComplete()).toBe('advanced');
  });
});

describe('parity/D4-validate-question-event', () => {
  test('a host rule reports through the same channel as a validator', () => {
    const survey = build({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'code' }] }],
    });
    survey.onValidateQuestion.add(({ value, addError }) => {
      if (String(value).startsWith('X')) {
        addError('Codes may not start with X.');
      }
    });

    survey.setValue('code', 'X1');
    expect(survey.nextPageOrComplete()).toBe('blocked');
    expect(errorsOf(survey, 'code')).toEqual(['Codes may not start with X.']);

    survey.setValue('code', 'A1');
    expect(survey.nextPageOrComplete()).toBe('advanced');
  });

  test('a host rule does not pile onto an answer that already failed', () => {
    const survey = build({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'code', isRequired: true }] }],
    });
    survey.onValidateQuestion.add(({ addError }) => {
      addError('And another thing.');
    });

    survey.nextPageOrComplete();
    // One omission, one message — the same rule that keeps validators away from an
    // empty answer.
    expect(errorsOf(survey, 'code')).toEqual(['This question requires an answer.']);
  });
});

test('the global registry knows nothing about the test-only validator', () => {
  // The registry a test builds is its own; registering into it must not leak into the
  // process-wide one, or the suite stops being parallel-safe.
  expect(globalRegistry.hasClass('reservednamevalidator')).toBe(false);
});
