import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { ElementStateChangedEvent, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

function withCondition(
  property: 'enableIf' | 'requiredIf',
  expression: string,
  extra: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'trigger' },
          { type: 'text', name: 'dependent', [property]: expression, ...extra },
        ],
      },
    ],
  };
}

describe('parity/B4-enable-if', () => {
  test('an element with no condition is enabled', () => {
    const survey = build({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q' }] }] });
    expect(survey.getQuestionByName('q')?.isEnabled).toBe(true);
  });

  test('a condition is evaluated on load', () => {
    const survey = build(withCondition('enableIf', '{trigger} notempty'));
    expect(survey.getQuestionByName('dependent')?.isEnabled).toBe(false);
  });

  test('answering enables the question, and clearing disables it again', () => {
    const survey = build(withCondition('enableIf', '{trigger} notempty'));
    survey.setValue('trigger', 'x');
    expect(survey.getQuestionByName('dependent')?.isEnabled).toBe(true);
    survey.setValue('trigger', '');
    expect(survey.getQuestionByName('dependent')?.isEnabled).toBe(false);
  });

  test('a disabled question stays visible — the two states are independent', () => {
    const survey = build(withCondition('enableIf', '{trigger} notempty'));
    const dependent = survey.getQuestionByName('dependent');
    expect(dependent?.isEnabled).toBe(false);
    expect(dependent?.isVisible).toBe(true);
  });

  test('a broken condition leaves the question editable rather than freezing it', () => {
    const survey = build(withCondition('enableIf', '{trigger} ==='));
    expect(survey.getQuestionByName('dependent')?.isEnabled).toBe(true);
  });
});

describe('parity/B4-required-if', () => {
  test('requiredIf drives the required state', () => {
    const survey = build(withCondition('requiredIf', '{trigger} == 1'));
    expect(survey.getQuestionByName('dependent')?.isRequired).toBe(false);
    survey.setValue('trigger', 1);
    expect(survey.getQuestionByName('dependent')?.isRequired).toBe(true);
  });

  test('requiredIf overrides an authored isRequired in both directions', () => {
    const survey = build(withCondition('requiredIf', '{trigger} == 1', { isRequired: true }));
    // The conditional rule is the more specific statement of intent.
    expect(survey.getQuestionByName('dependent')?.isRequired).toBe(false);
    survey.setValue('trigger', 1);
    expect(survey.getQuestionByName('dependent')?.isRequired).toBe(true);
  });

  test('without requiredIf the stored property answers', () => {
    const survey = build({
      pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q', isRequired: true }] }],
    });
    expect(survey.getQuestionByName('q')?.isRequired).toBe(true);
  });

  test('a broken condition leaves the question NOT required', () => {
    const survey = build(withCondition('requiredIf', 'brokenExpression ==='));
    // Mirror image of visibleIf/enableIf: blocking submission over a malformed
    // expression is worse than letting the answer through.
    expect(survey.getQuestionByName('dependent')?.isRequired).toBe(false);
  });

  test('the computed override never reaches the serialized definition', () => {
    const registry = createTestRegistry();
    const survey = parseSurvey(withCondition('requiredIf', '{trigger} == 1'), registry).survey;
    survey.setValue('trigger', 1);

    const serialized = JSON.stringify(serializeSurvey(survey, registry));
    expect(serialized).toContain('"requiredIf":"{trigger} == 1"');
    expect(serialized).not.toContain('"isRequired"');
  });
});

describe('conditions combined', () => {
  test('all three conditions coexist on one question', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            {
              type: 'text',
              name: 'q',
              visibleIf: '{a} notempty',
              enableIf: "{a} != 'locked'",
              requiredIf: "{a} == 'now'",
            },
          ],
        },
      ],
    });
    const question = survey.getQuestionByName('q');

    expect([question?.isVisible, question?.isEnabled, question?.isRequired]).toEqual([
      false,
      true,
      false,
    ]);

    survey.setValue('a', 'locked');
    expect([question?.isVisible, question?.isEnabled, question?.isRequired]).toEqual([
      true,
      false,
      false,
    ]);

    survey.setValue('a', 'now');
    expect([question?.isVisible, question?.isEnabled, question?.isRequired]).toEqual([
      true,
      true,
      true,
    ]);
  });

  test('each state change is reported with its own discriminator', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'text', name: 'q', enableIf: '{a} notempty', requiredIf: '{a} notempty' },
          ],
        },
      ],
    });

    const seen: ElementStateChangedEvent[] = [];
    survey.onElementStateChanged.add((event) => seen.push(event));
    survey.setValue('a', 'x');

    expect(seen.map((event) => event.state).toSorted()).toEqual(['enabled', 'required']);
    expect(seen.every((event) => event.value)).toBe(true);
  });

  test('a change touching nothing conditional emits no state events', () => {
    const survey = build(withCondition('enableIf', '{trigger} notempty'));
    survey.setValue('trigger', 'x');

    let count = 0;
    survey.onElementStateChanged.add(() => {
      count += 1;
    });
    survey.setValue('unrelated', 'y');
    expect(count).toBe(0);
  });
});
