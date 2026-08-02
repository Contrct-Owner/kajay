import { parseSurvey } from '@kajay/core';
import type { ValueChangedEvent } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function buildSurvey() {
  const registry = createTestRegistry();
  return parseSurvey(
    {
      title: 'Demo',
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'firstName', title: 'First name' },
            { type: 'text', name: 'lastName' },
          ],
        },
      ],
    },
    registry,
  ).survey;
}

describe('Survey model', () => {
  test('exposes questions across pages and finds them by name', () => {
    const survey = buildSurvey();
    expect(survey.questions.map((question) => question.name)).toEqual(['firstName', 'lastName']);
    expect(survey.getQuestionByName('lastName')?.type).toBe('text');
    expect(survey.getQuestionByName('missing')).toBeUndefined();
  });

  test('a question title falls back to its name without being serialized', () => {
    const survey = buildSurvey();
    expect(survey.getQuestionByName('firstName')?.title).toBe('First name');
    expect(survey.getQuestionByName('lastName')?.title).toBe('lastName');
    expect(survey.getQuestionByName('lastName')?.getPropertyValue('title')).toBeUndefined();
  });

  test('writing through a question reaches survey data and emits once', () => {
    const survey = buildSurvey();
    const events: ValueChangedEvent[] = [];
    survey.onValueChanged.add((event) => events.push(event));

    const question = survey.getQuestionByName('firstName');
    expect(question).toBeDefined();
    if (question === undefined) {
      return;
    }
    question.value = 'Ada';

    expect(survey.data).toEqual({ firstName: 'Ada' });
    expect(question.value).toBe('Ada');
    expect(events).toEqual([{ name: 'firstName', value: 'Ada', previousValue: undefined }]);
  });

  test('setting an unchanged value emits nothing', () => {
    const survey = buildSurvey();
    survey.setValue('firstName', 'Ada');
    let count = 0;
    survey.onValueChanged.add(() => {
      count += 1;
    });
    survey.setValue('firstName', 'Ada');
    expect(count).toBe(0);
  });

  test('setting undefined removes the key rather than storing it', () => {
    const survey = buildSurvey();
    survey.setValue('firstName', 'Ada');
    survey.setValue('firstName', undefined);
    expect(survey.data).toEqual({});
  });

  test('data is a copy: mutating it does not reach the model', () => {
    const survey = buildSurvey();
    survey.setValue('firstName', 'Ada');
    const snapshot = survey.data as Record<string, unknown>;
    snapshot['firstName'] = 'tampered';
    expect(survey.data['firstName']).toBe('Ada');
  });

  test('complete emits once and is idempotent', () => {
    const survey = buildSurvey();
    survey.setValue('firstName', 'Ada');
    let completions = 0;
    let captured: Readonly<Record<string, unknown>> = {};
    survey.onComplete.add((event) => {
      completions += 1;
      captured = event.data;
    });

    survey.complete();
    survey.complete();

    expect(completions).toBe(1);
    expect(survey.isCompleted).toBe(true);
    expect(captured).toEqual({ firstName: 'Ada' });
  });

  test('unsubscribing stops delivery', () => {
    const survey = buildSurvey();
    let count = 0;
    const unsubscribe = survey.onValueChanged.add(() => {
      count += 1;
    });
    survey.setValue('firstName', 'a');
    unsubscribe();
    survey.setValue('firstName', 'b');
    expect(count).toBe(1);
  });

  test('page navigation reports the transition', () => {
    const registry = createTestRegistry();
    const survey = parseSurvey(
      { pages: [{ name: 'p1' }, { name: 'p2' }] },
      registry,
    ).survey;

    const transitions: number[] = [];
    survey.onCurrentPageChanged.add((event) => transitions.push(event.currentPageNo));

    survey.setCurrentPageNo(1);
    survey.setCurrentPageNo(1);
    survey.setCurrentPageNo(5);

    expect(transitions).toEqual([1]);
    expect(survey.currentPage?.name).toBe('p2');
  });
});
