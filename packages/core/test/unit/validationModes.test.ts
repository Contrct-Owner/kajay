/**
 * When validation runs, and what happens when it is switched off.
 *
 * Split from validation.test.ts when that file outgrew the repo's own file-size
 * limit. These scenarios share a subject: policy, rather than what any one check
 * decides about an answer.
 */
import { parseSurvey } from '@kajay/core';
import type { ElementStateChangedEvent, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

/** Two pages, each with one required question. The shape most of §D needs. */
function twoRequiredPages(): Survey {
  return build({
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'a', isRequired: true }] },
      { name: 'p2', elements: [{ type: 'text', name: 'b', isRequired: true }] },
    ],
  });
}

function errorsOf(survey: Survey, name: string): readonly string[] {
  return (survey.getQuestionByName(name)?.errors ?? []).map((error) => error.text);
}

describe('parity/D5-check-errors-mode', () => {
  test('onNextPage: an answer changing does not raise an error on its own', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a', validators: [{ type: 'textvalidator', minLength: 5 }] },
          ],
        },
      ],
    });
    survey.setValue('a', 'ab');
    expect(errorsOf(survey, 'a')).toEqual([]);
  });

  test('onValueChanged: the question that changed is re-checked immediately', () => {
    const survey = build({
      checkErrorsMode: 'onValueChanged',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a', validators: [{ type: 'textvalidator', minLength: 5 }] },
            { type: 'text', name: 'b', validators: [{ type: 'textvalidator', minLength: 5 }] },
          ],
        },
      ],
    });
    survey.setValue('a', 'ab');
    expect(errorsOf(survey, 'a')).toEqual(['Please enter at least 5 characters.']);
    // Only the question that changed: reporting on `b` would surface an error against
    // a field the respondent has not reached yet.
    expect(errorsOf(survey, 'b')).toEqual([]);

    survey.setValue('a', 'abcdef');
    expect(errorsOf(survey, 'a')).toEqual([]);
  });

  test('onValueChanged: a hidden question written by logic raises nothing', () => {
    const survey = build({
      checkErrorsMode: 'onValueChanged',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'trigger' },
            {
              type: 'text',
              name: 'a',
              visibleIf: '{trigger} == 1',
              validators: [{ type: 'textvalidator', minLength: 5 }],
            },
          ],
        },
      ],
    });
    // A trigger, a setValueIf or `setData` can move a hidden answer. Posting an error
    // against a field that is not on screen would block the respondent with nothing to
    // act on; they meet it on the way out of the page instead.
    survey.setValue('a', 'ab');
    expect(errorsOf(survey, 'a')).toEqual([]);

    survey.setValue('trigger', 1);
    expect(survey.validation.validateCurrentPage()).toBe(false);
  });

  test('onComplete: intermediate pages are not gated, the last one checks everything', () => {
    const survey = build({
      checkErrorsMode: 'onComplete',
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'a', isRequired: true }] },
        { name: 'p2', elements: [{ type: 'text', name: 'b', isRequired: true }] },
      ],
    });
    expect(survey.nextPageOrComplete()).toBe(true);
    expect(survey.currentPageNo).toBe(1);

    expect(survey.nextPageOrComplete()).toBe(false);
    expect(survey.isCompleted).toBe(false);
    expect(errorsOf(survey, 'a')).toHaveLength(1);
    expect(errorsOf(survey, 'b')).toHaveLength(1);
  });
});

describe('parity/D6-validation-enabled', () => {
  test('disabling validation stops it blocking, and stops it running', () => {
    const survey = twoRequiredPages();
    survey.validation.setEnabled(false);

    expect(survey.nextPageOrComplete()).toBe(true);
    expect(survey.currentPageNo).toBe(1);
    expect(errorsOf(survey, 'a')).toEqual([]);
  });

  test('the toggle serializes, so a definition can ship with it off', () => {
    const survey = build({
      validationEnabled: false,
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'a', isRequired: true }] }],
    });
    expect(survey.validation.isEnabled).toBe(false);
    expect(survey.nextPageOrComplete()).toBe(true);
    expect(survey.isCompleted).toBe(true);
  });
});

describe('parity/D6-first-error-question', () => {
  test('the first error is the first in document order, not the first found', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'text', name: 'b', isRequired: true },
            { type: 'text', name: 'c', isRequired: true },
          ],
        },
      ],
    });
    survey.nextPageOrComplete();
    expect(survey.validation.firstErrorQuestion?.name).toBe('b');
  });

  test('there is no first error when nothing failed', () => {
    const survey = build({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'a' }] }] });
    survey.validation.validateCurrentPage();
    expect(survey.validation.firstErrorQuestion).toBeUndefined();
  });
});

describe('parity/D5-errors-announced', () => {
  test('an error appearing reaches the renderer through the state channel', () => {
    const survey = twoRequiredPages();
    const seen: ElementStateChangedEvent[] = [];
    survey.onElementStateChanged.add((event) => seen.push(event));

    survey.nextPageOrComplete();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.state).toBe('errors');
    expect(seen[0]?.element).toBe(survey.getQuestionByName('a'));
  });

  test('checking again with the same outcome announces nothing', () => {
    const survey = twoRequiredPages();
    survey.nextPageOrComplete();

    let count = 0;
    survey.onElementStateChanged.add(() => {
      count += 1;
    });
    // Errors are rebuilt on every check, so identity always differs. Comparing by
    // content is what stops a second Next re-rendering the whole page for nothing.
    survey.nextPageOrComplete();
    expect(count).toBe(0);
  });
});
