import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey, ValueChangedEvent } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(elements: readonly Readonly<Record<string, unknown>>[]): Survey {
  return parseSurvey({ pages: [{ name: 'p1', elements }] }, createTestRegistry()).survey;
}

describe('parity/B5-default-value-expression', () => {
  test('supplies a value at load, before any answer exists', () => {
    const survey = build([
      { type: 'text', name: 'country', defaultValueExpression: "'uk'" },
    ]);
    expect(survey.getValue('country')).toBe('uk');
  });

  test('keeps tracking its dependencies while nobody has overridden the answer', () => {
    const survey = build([
      { type: 'text', name: 'source' },
      { type: 'text', name: 'copy', defaultValueExpression: '{source}' },
    ]);
    survey.setValue('source', 'first');
    expect(survey.getValue('copy')).toBe('first');
    survey.setValue('source', 'second');
    expect(survey.getValue('copy')).toBe('second');
  });

  test('a legitimately falsy computed default does not freeze itself', () => {
    // "Only write while empty" would stop here forever: 0 is an answer, not a blank.
    const survey = build([
      { type: 'text', name: 'count' },
      { type: 'text', name: 'doubled', defaultValueExpression: '{count} * 2' },
    ]);
    survey.setValue('count', 0);
    expect(survey.getValue('doubled')).toBe(0);
    survey.setValue('count', 4);
    expect(survey.getValue('doubled')).toBe(8);
  });

  test('never overwrites an answer the respondent already gave', () => {
    const survey = build([
      { type: 'text', name: 'source' },
      { type: 'text', name: 'copy', defaultValueExpression: '{source}' },
    ]);
    survey.setValue('copy', 'typed by hand');
    survey.setValue('source', 'ignored');
    expect(survey.getValue('copy')).toBe('typed by hand');
  });

  test('a cleared answer is refilled on the next dependency change, not immediately', () => {
    const survey = build([
      { type: 'text', name: 'source' },
      { type: 'text', name: 'copy', defaultValueExpression: '{source}' },
    ]);
    survey.setValue('source', 'a');
    survey.setValue('copy', undefined);

    // The rule does not read its own answer — declaring that would make every
    // defaulted question a self-cycle — so clearing alone does not re-trigger it.
    expect(survey.getValue('copy')).toBeUndefined();

    survey.setValue('source', 'b');
    expect(survey.getValue('copy')).toBe('b');
  });

  test('a malformed expression writes nothing', () => {
    const survey = build([{ type: 'text', name: 'q', defaultValueExpression: '{a} ===' }]);
    expect(survey.getValue('q')).toBeUndefined();
  });

  test('computed defaults use the full function library', () => {
    const survey = build([
      { type: 'text', name: 'a' },
      { type: 'text', name: 'b' },
      { type: 'text', name: 'total', defaultValueExpression: 'sum({a}, {b}) * 2' },
    ]);
    survey.setValue('a', 3);
    expect(survey.getValue('total')).toBe(6);
  });
});

describe('parity/B5-set-value-if', () => {
  test('forces a value while the condition holds', () => {
    const survey = build([
      { type: 'text', name: 'plan' },
      {
        type: 'text',
        name: 'price',
        setValueIf: "{plan} == 'free'",
        setValueExpression: '0',
      },
    ]);
    survey.setValue('price', 99);
    survey.setValue('plan', 'free');
    expect(survey.getValue('price')).toBe(0);
  });

  test('overwrites an existing answer, unlike defaultValueExpression', () => {
    const survey = build([
      { type: 'text', name: 'source' },
      { type: 'text', name: 'mirror', setValueIf: '{source} notempty', setValueExpression: '{source}' },
    ]);
    survey.setValue('mirror', 'typed by hand');
    survey.setValue('source', 'forced');
    expect(survey.getValue('mirror')).toBe('forced');
  });

  test('does nothing while the condition is false', () => {
    const survey = build([
      { type: 'text', name: 'plan' },
      { type: 'text', name: 'price', setValueIf: "{plan} == 'free'", setValueExpression: '0' },
    ]);
    survey.setValue('price', 99);
    survey.setValue('plan', 'paid');
    expect(survey.getValue('price')).toBe(99);
  });

  test('setValueIf without setValueExpression registers no rule', () => {
    const survey = build([
      { type: 'text', name: 'plan' },
      { type: 'text', name: 'price', setValueIf: '{plan} notempty' },
    ]);
    survey.setValue('plan', 'x');
    expect(survey.getValue('price')).toBeUndefined();
  });
});

describe('parity/B5-reset-value-if', () => {
  test('clears the answer while the condition holds', () => {
    const survey = build([
      { type: 'text', name: 'hasPet' },
      { type: 'text', name: 'petName', resetValueIf: "{hasPet} == 'no'" },
    ]);
    survey.setValue('petName', 'Rex');
    survey.setValue('hasPet', 'no');
    expect(survey.getValue('petName')).toBeUndefined();
  });

  test('leaves the answer alone while the condition is false', () => {
    const survey = build([
      { type: 'text', name: 'hasPet' },
      { type: 'text', name: 'petName', resetValueIf: "{hasPet} == 'no'" },
    ]);
    survey.setValue('petName', 'Rex');
    survey.setValue('hasPet', 'yes');
    expect(survey.getValue('petName')).toBe('Rex');
  });
});

describe('value rule precedence', () => {
  test('reset wins over set', () => {
    const survey = build([
      { type: 'text', name: 'gate' },
      {
        type: 'text',
        name: 'q',
        resetValueIf: '{gate} notempty',
        setValueIf: '{gate} notempty',
        setValueExpression: "'forced'",
      },
    ]);
    survey.setValue('gate', 'x');
    expect(survey.getValue('q')).toBeUndefined();
  });

  test('reset suppresses the default rather than fighting it', () => {
    // Without the precedence rule these two would each undo the other every round
    // until the cascade limit stopped them.
    const survey = build([
      { type: 'text', name: 'gate' },
      {
        type: 'text',
        name: 'q',
        resetValueIf: '{gate} notempty',
        defaultValueExpression: "'fallback'",
      },
    ]);
    expect(survey.getValue('q')).toBe('fallback');
    survey.setValue('gate', 'x');
    expect(survey.getValue('q')).toBeUndefined();
  });

  test('set wins over default', () => {
    const survey = build([
      { type: 'text', name: 'gate' },
      {
        type: 'text',
        name: 'q',
        setValueIf: '{gate} notempty',
        setValueExpression: "'forced'",
        defaultValueExpression: "'defaulted'",
      },
    ]);
    expect(survey.getValue('q')).toBe('defaulted');
    survey.setValue('gate', 'x');
    expect(survey.getValue('q')).toBe('forced');
  });
});

describe('value rules and the dependency graph', () => {
  test('a chain of written values settles in one pass, in order', () => {
    const survey = build([
      { type: 'text', name: 'price' },
      { type: 'text', name: 'tax', setValueIf: '{price} notempty', setValueExpression: '{price} * 0.2' },
      { type: 'text', name: 'total', setValueIf: '{tax} notempty', setValueExpression: '{price} + {tax}' },
    ]);

    survey.setValue('price', 100);

    expect(survey.getValue('tax')).toBe(20);
    expect(survey.getValue('total')).toBe(120);
  });

  test('a written value drives a condition downstream of it', () => {
    const survey = build([
      { type: 'text', name: 'price' },
      { type: 'text', name: 'tax', setValueIf: '{price} notempty', setValueExpression: '{price} * 0.2' },
      { type: 'text', name: 'warning', visibleIf: '{tax} > 10' },
    ]);

    expect(survey.getQuestionByName('warning')?.isVisible).toBe(false);
    survey.setValue('price', 100);
    expect(survey.getQuestionByName('warning')?.isVisible).toBe(true);
  });

  test('every value written by logic is reported, after the model settles', () => {
    const survey = build([
      { type: 'text', name: 'price' },
      { type: 'text', name: 'tax', setValueIf: '{price} notempty', setValueExpression: '{price} * 0.2' },
    ]);

    const seen: ValueChangedEvent[] = [];
    survey.onValueChanged.add((event) => seen.push(event));
    survey.setValue('price', 100);

    expect(seen.map((event) => event.name)).toEqual(['price', 'tax']);
    // The listener sees a settled model, not one mid-cascade.
    expect(survey.data).toEqual({ price: 100, tax: 20 });
  });

  test('a question whose expression references itself is reported as a cycle', () => {
    const survey = build([
      { type: 'text', name: 'q', setValueIf: 'true', setValueExpression: '{q} + 1' },
    ]);

    // Reported rather than looping. The graph names the offender instead of the model
    // incrementing forever or silently doing nothing.
    const cycle = survey.logicDiagnostics.dependencyErrors.find(
      (error) => error.code === 'cycle',
    );
    expect(cycle?.nodes).toContain('question:q:value');
  });

  test('a survey with sound logic reports no diagnostics', () => {
    const survey = build([
      { type: 'text', name: 'a' },
      { type: 'text', name: 'b', defaultValueExpression: '{a}' },
    ]);
    survey.setValue('a', 'x');
    expect(survey.logicDiagnostics.dependencyErrors).toEqual([]);
    expect(survey.logicDiagnostics.expressionErrors).toEqual([]);
  });

  test('a malformed expression is reported through diagnostics', () => {
    const survey = build([{ type: 'text', name: 'q', defaultValueExpression: '{a} ===' }]);
    expect(survey.logicDiagnostics.expressionErrors.length).toBeGreaterThan(0);
  });
});

describe('value rules and serialization', () => {
  test('the rules round-trip; the values they produced do not', () => {
    const registry = createTestRegistry();
    const definition = {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'source' },
            { type: 'text', name: 'copy', defaultValueExpression: '{source}' },
          ],
        },
      ],
    };
    const survey = parseSurvey(definition, registry).survey;
    survey.setValue('source', 'written');

    const serialized = JSON.stringify(serializeSurvey(survey, registry));
    expect(serialized).toContain('"defaultValueExpression":"{source}"');
    expect(serialized).not.toContain('written');
  });
});
