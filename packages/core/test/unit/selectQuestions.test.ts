import { CheckboxQuestion, RadiogroupQuestion, parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey, SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(question: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ name: 'q', ...question }] }] },
    createTestRegistry(),
  ).survey;
}

function radiogroup(question: Readonly<Record<string, unknown>> = {}): RadiogroupQuestion {
  const found = build({ type: 'radiogroup', choices: ['a', 'b', 'c'], ...question }).getQuestionByName('q');
  if (!(found instanceof RadiogroupQuestion)) {
    throw new TypeError('expected a radiogroup');
  }
  return found;
}

function checkbox(question: Readonly<Record<string, unknown>> = {}): CheckboxQuestion {
  const found = build({ type: 'checkbox', choices: ['a', 'b', 'c'], ...question }).getQuestionByName('q');
  if (!(found instanceof CheckboxQuestion)) {
    throw new TypeError('expected a checkbox');
  }
  return found;
}

describe('choice shorthand', () => {
  test('a bare scalar expands to a choice with that value', () => {
    const question = radiogroup();
    expect(question.choices.map((choice) => choice.value)).toEqual(['a', 'b', 'c']);
    expect(question.choices[0]?.text).toBe('a');
  });

  test('shorthand and object form may be mixed', () => {
    const question = radiogroup({ choices: ['a', { value: 'b', text: 'Bee' }] });
    expect(question.choices.map((choice) => choice.text)).toEqual(['a', 'Bee']);
  });

  test('numbers and booleans keep their type', () => {
    const question = radiogroup({ choices: [1, true] });
    expect(question.choices.map((choice) => choice.value)).toEqual([1, true]);
  });

  test('shorthand expands on the canonical pass and is stable thereafter', () => {
    const registry = createTestRegistry();
    const definition = {
      pages: [{ name: 'p1', elements: [{ type: 'radiogroup', name: 'q', choices: ['a', 'b'] }] }],
    };
    const canonical = serializeSurvey(parseSurvey(definition, registry).survey, registry);
    const second = serializeSurvey(parseSurvey(canonical, registry).survey, registry);

    expect(JSON.stringify(second)).toBe(JSON.stringify(canonical));
    // Exactly the case ADR-0002 cites for why the bar is a fixed point.
    expect(JSON.stringify(canonical)).toContain('"choices":[{"value":"a"},{"value":"b"}]');
  });
});

describe('parity/C3-radiogroup', () => {
  test('selecting records the choice value', () => {
    const question = radiogroup();
    question.select('b');
    expect(question.value).toBe('b');
    expect(question.isSelected('b')).toBe(true);
    expect(question.isSelected('a')).toBe(false);
  });

  test('selecting a different choice replaces the answer', () => {
    const question = radiogroup();
    question.select('a');
    question.select('c');
    expect(question.value).toBe('c');
  });

  test('re-selecting the current answer clears it', () => {
    const question = radiogroup();
    question.select('a');
    question.select('a');
    expect(question.value).toBeUndefined();
  });

  test('choicesOrder sorts for display without rewriting the definition', () => {
    const question = radiogroup({ choices: ['c', 'a', 'b'], choicesOrder: 'asc' });
    expect(question.visibleChoices.map((choice) => choice.value)).toEqual(['a', 'b', 'c']);
    expect(question.choices.map((choice) => choice.value)).toEqual(['c', 'a', 'b']);
  });

  test('desc reverses, and an unknown order leaves the authored order alone', () => {
    expect(
      radiogroup({ choices: ['a', 'b'], choicesOrder: 'desc' }).visibleChoices.map((c) => c.value),
    ).toEqual(['b', 'a']);
    expect(
      radiogroup({ choices: ['c', 'a'], choicesOrder: 'nonsense' }).visibleChoices.map(
        (c) => c.value,
      ),
    ).toEqual(['c', 'a']);
  });

  test('none and other are offered without joining the authored choices', () => {
    const question = radiogroup({ showNoneItem: true, showOtherItem: true });
    expect(question.visibleChoices.map((choice) => choice.value)).toEqual([
      'a',
      'b',
      'c',
      'none',
      'other',
    ]);
    expect(question.choices).toHaveLength(3);
  });
});

describe('parity/C4-checkbox', () => {
  test('selecting accumulates an array', () => {
    const question = checkbox();
    question.select('a');
    question.select('c');
    expect(question.value).toEqual(['a', 'c']);
  });

  test('selecting an already-selected choice removes it', () => {
    const question = checkbox();
    question.select('a');
    question.select('a');
    expect(question.value).toEqual([]);
  });

  test('maxSelectedChoices refuses rather than replacing an earlier answer', () => {
    const question = checkbox({ maxSelectedChoices: 2 });
    question.select('a');
    question.select('b');
    question.select('c');
    expect(question.value).toEqual(['a', 'b']);
  });

  test('a limit still allows deselecting', () => {
    const question = checkbox({ maxSelectedChoices: 1 });
    question.select('a');
    question.select('a');
    expect(question.value).toEqual([]);
  });

  test('none is exclusive in both directions', () => {
    const question = checkbox({ showNoneItem: true });
    question.select('a');
    question.select('none');
    expect(question.value).toEqual(['none']);

    question.select('b');
    expect(question.value).toEqual(['b']);
  });

  test('selectAll selects every visible choice, and again clears them', () => {
    const question = checkbox({ showSelectAllItem: true });
    question.selectAll();
    expect(question.value).toEqual(['a', 'b', 'c']);
    expect(question.isAllSelected).toBe(true);

    question.selectAll();
    expect(question.value).toEqual([]);
  });

  test('selectAll ignores the none and other entries', () => {
    const question = checkbox({ showNoneItem: true, showOtherItem: true });
    question.selectAll();
    expect(question.value).toEqual(['a', 'b', 'c']);
  });
});

function withChoiceCondition(): Survey {
  return parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'gate' },
              {
                type: 'radiogroup',
                name: 'q',
                choices: ['always', { value: 'sometimes', visibleIf: "{gate} == 'yes'" }],
              },
            ],
          },
        ],
      },
    createTestRegistry(),
  ).survey;
}

describe('parity/B3-visible-if: individual choices', () => {
  test('a choice is withheld until its condition holds', () => {
    const survey = withChoiceCondition();
    const question = survey.getQuestionByName('q');
    expect(question).toBeInstanceOf(RadiogroupQuestion);
    if (!(question instanceof RadiogroupQuestion)) {
      return;
    }

    expect(question.visibleChoices.map((choice) => choice.value)).toEqual(['always']);
    survey.setValue('gate', 'yes');
    expect(question.visibleChoices.map((choice) => choice.value)).toEqual([
      'always',
      'sometimes',
    ]);
  });

  test('the choice list is unchanged; only what is offered differs', () => {
    const survey = withChoiceCondition();
    const question = survey.getQuestionByName('q');
    if (!(question instanceof RadiogroupQuestion)) {
      return;
    }
    expect(question.choices).toHaveLength(2);
  });

  test('a hidden choice reports itself through the same state machinery', () => {
    const survey = withChoiceCondition();
    const question = survey.getQuestionByName('q');
    if (!(question instanceof RadiogroupQuestion)) {
      return;
    }
    expect(question.choices[1]?.isVisible).toBe(false);
    survey.setValue('gate', 'yes');
    expect(question.choices[1]?.isVisible).toBe(true);
  });
});

describe('select questions and the engine', () => {
  test('an answer drives logic like any other', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'checkbox', name: 'toppings', choices: ['cheese', 'ham'] },
              { type: 'text', name: 'note', visibleIf: "{toppings} contains 'ham'" },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    const question = survey.getQuestionByName('toppings');
    expect(survey.getQuestionByName('note')?.isVisible).toBe(false);
    if (question instanceof CheckboxQuestion) {
      question.select('ham');
    }
    expect(survey.getQuestionByName('note')?.isVisible).toBe(true);
  });

  test('a malformed choice entry is reported', () => {
    const { diagnostics } = parseSurvey(
      {
        pages: [
          { name: 'p1', elements: [{ type: 'radiogroup', name: 'q', choices: [null] }] },
        ],
      } as SurveyDefinition,
      createTestRegistry(),
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('invalid-element');
  });
});
