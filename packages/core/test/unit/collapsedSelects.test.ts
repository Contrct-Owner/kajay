import {
  CheckboxQuestion,
  DropdownQuestion,
  MultiSelectQuestion,
  RadiogroupQuestion,
  SingleSelectQuestion,
  TagboxQuestion,
  parseSurvey,
  serializeSurvey,
} from '@kajay/core';
import type { SelectQuestion, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(question: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ name: 'q', ...question }] }] },
    createTestRegistry(),
  ).survey;
}

function selectQuestion(question: Readonly<Record<string, unknown>>): SelectQuestion {
  const found = build({ choices: ['Apple', 'Banana', 'Cherry'], ...question }).getQuestionByName(
    'q',
  );
  if (found === undefined) {
    throw new TypeError('expected a question');
  }
  return found as SelectQuestion;
}

describe('parity/C5-dropdown', () => {
  test('is single-select: choosing replaces the answer', () => {
    const question = selectQuestion({ type: 'dropdown' });
    expect(question).toBeInstanceOf(DropdownQuestion);
    question.select('Apple');
    question.select('Cherry');
    expect(question.value).toBe('Cherry');
  });

  test('carries a placeholder', () => {
    expect(selectQuestion({ type: 'dropdown', placeholder: 'Pick one' }).placeholder).toBe(
      'Pick one',
    );
  });

  test('offers none and other like any select', () => {
    const question = selectQuestion({ type: 'dropdown', showOtherItem: true });
    expect(question.visibleChoices.map((choice) => choice.value)).toContain('other');
  });
});

describe('parity/C6-tagbox', () => {
  test('is multi-select: choices accumulate', () => {
    const question = selectQuestion({ type: 'tagbox' });
    expect(question).toBeInstanceOf(TagboxQuestion);
    question.select('Apple');
    question.select('Banana');
    expect(question.value).toEqual(['Apple', 'Banana']);
  });

  test('honours maxSelectedChoices, inherited from the multi-select base', () => {
    const question = selectQuestion({ type: 'tagbox', maxSelectedChoices: 1 });
    question.select('Apple');
    question.select('Banana');
    expect(question.value).toEqual(['Apple']);
  });

  test('honours the exclusive none, inherited from the multi-select base', () => {
    const question = selectQuestion({ type: 'tagbox', showNoneItem: true });
    question.select('Apple');
    question.select('none');
    expect(question.value).toEqual(['none']);
  });
});

describe('selection semantics follow arity, not widget', () => {
  test('radiogroup and dropdown share the single-select base', () => {
    expect(selectQuestion({ type: 'radiogroup' })).toBeInstanceOf(SingleSelectQuestion);
    expect(selectQuestion({ type: 'dropdown' })).toBeInstanceOf(SingleSelectQuestion);
  });

  test('checkbox and tagbox share the multi-select base', () => {
    expect(selectQuestion({ type: 'checkbox' })).toBeInstanceOf(MultiSelectQuestion);
    expect(selectQuestion({ type: 'tagbox' })).toBeInstanceOf(MultiSelectQuestion);
  });

  test('the two bases are distinct', () => {
    expect(selectQuestion({ type: 'radiogroup' })).not.toBeInstanceOf(MultiSelectQuestion);
    expect(selectQuestion({ type: 'checkbox' })).not.toBeInstanceOf(SingleSelectQuestion);
  });

  test('radiogroup keeps its own showClearButton, not shared with dropdown', () => {
    const registry = createTestRegistry();
    const radiogroupProperties = registry.getProperties('radiogroup').map((p) => p.name);
    const dropdownProperties = registry.getProperties('dropdown').map((p) => p.name);
    expect(radiogroupProperties).toContain('showClearButton');
    expect(dropdownProperties).not.toContain('showClearButton');
  });

  test('maxSelectedChoices reaches both multi-select types and neither single one', () => {
    const registry = createTestRegistry();
    const has = (type: string): boolean =>
      registry.getProperties(type).some((property) => property.name === 'maxSelectedChoices');
    expect([has('checkbox'), has('tagbox')]).toEqual([true, true]);
    expect([has('radiogroup'), has('dropdown')]).toEqual([false, false]);
  });
});

describe('search filtering', () => {
  test('narrows by display text, case-insensitively', () => {
    const question = selectQuestion({ type: 'dropdown' });
    expect(question.filterChoices('an').map((choice) => choice.value)).toEqual(['Banana']);
    expect(question.filterChoices('A').map((choice) => choice.value)).toEqual([
      'Apple',
      'Banana',
    ]);
  });

  test('an empty query returns everything offered', () => {
    const question = selectQuestion({ type: 'dropdown' });
    expect(question.filterChoices('   ')).toEqual(question.visibleChoices);
  });

  test('matches the text a respondent sees, not the underlying value', () => {
    const question = selectQuestion({
      type: 'dropdown',
      choices: [{ value: 'a1', text: 'Apple' }],
    });
    expect(question.filterChoices('Apple')).toHaveLength(1);
    expect(question.filterChoices('a1')).toHaveLength(0);
  });

  test('searchEnabled: false disables narrowing entirely', () => {
    const question = selectQuestion({ type: 'dropdown', searchEnabled: false });
    expect(question.filterChoices('zzz')).toEqual(question.visibleChoices);
  });

  test('search never offers a choice whose own condition is false', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'gate' },
              {
                type: 'dropdown',
                name: 'q',
                choices: ['Apple', { value: 'Apricot', visibleIf: "{gate} == 'yes'" }],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    const question = survey.getQuestionByName('q') as SelectQuestion;
    expect(question.filterChoices('Ap').map((choice) => choice.value)).toEqual(['Apple']);
    survey.setValue('gate', 'yes');
    expect(question.filterChoices('Ap').map((choice) => choice.value)).toEqual([
      'Apple',
      'Apricot',
    ]);
  });
});

describe('collapsed selects and the rest of the engine', () => {
  test('a dropdown answer drives logic like any other', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'dropdown', name: 'plan', choices: ['free', 'paid'] },
              { type: 'text', name: 'card', visibleIf: "{plan} == 'paid'" },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    expect(survey.getQuestionByName('card')?.isVisible).toBe(false);
    survey.setValue('plan', 'paid');
    expect(survey.getQuestionByName('card')?.isVisible).toBe(true);
  });

  test('all four select types round-trip to a fixed point', () => {
    const registry = createTestRegistry();
    const definition = {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'radiogroup', name: 'a', choices: ['x'] },
            { type: 'dropdown', name: 'b', choices: ['x'], placeholder: 'Pick' },
            { type: 'checkbox', name: 'c', choices: ['x'], maxSelectedChoices: 2 },
            { type: 'tagbox', name: 'd', choices: ['x'], searchEnabled: false },
          ],
        },
      ],
    };

    const canonical = serializeSurvey(parseSurvey(definition, registry).survey, registry);
    const second = serializeSurvey(parseSurvey(canonical, registry).survey, registry);
    expect(JSON.stringify(second)).toBe(JSON.stringify(canonical));
  });

  test('the earlier select types still behave as before', () => {
    expect(selectQuestion({ type: 'radiogroup' })).toBeInstanceOf(RadiogroupQuestion);
    expect(selectQuestion({ type: 'checkbox' })).toBeInstanceOf(CheckboxQuestion);
  });
});
