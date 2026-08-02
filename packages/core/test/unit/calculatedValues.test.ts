import { generateContract, parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey, SurveyDefinition, ValueChangedEvent } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

const order: Readonly<Record<string, unknown>> = {
  calculatedValues: [
    { name: 'subtotal', expression: '{price} * {quantity}' },
    { name: 'tax', expression: '{subtotal} * 0.2', includeIntoResult: true },
  ],
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'price' },
        { type: 'text', name: 'quantity' },
      ],
    },
  ],
};

describe('parity/B6-calculated-values', () => {
  test('computes from answers and recomputes when they change', () => {
    const survey = build(order);
    survey.setValue('price', 10);
    survey.setValue('quantity', 3);
    expect(survey.getCalculatedValue('subtotal')).toBe(30);
    survey.setValue('quantity', 4);
    expect(survey.getCalculatedValue('subtotal')).toBe(40);
  });

  test('one calculated value feeds another, ordered in a single pass', () => {
    const survey = build(order);
    survey.setValue('price', 100);
    survey.setValue('quantity', 1);
    expect(survey.getCalculatedValue('tax')).toBe(20);
  });

  test('is usable from a question expression', () => {
    const survey = build({
      calculatedValues: [{ name: 'total', expression: '{a} + {b}' }],
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'text', name: 'b' },
            { type: 'text', name: 'warning', visibleIf: '{total} > 100' },
          ],
        },
      ],
    });

    expect(survey.getQuestionByName('warning')?.isVisible).toBe(false);
    survey.setValue('a', 60);
    survey.setValue('b', 60);
    expect(survey.getQuestionByName('warning')?.isVisible).toBe(true);
  });

  test('drives a question default', () => {
    const survey = build({
      calculatedValues: [{ name: 'doubled', expression: '{a} * 2' }],
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'text', name: 'echo', defaultValueExpression: '{doubled}' },
          ],
        },
      ],
    });
    survey.setValue('a', 5);
    expect(survey.getValue('echo')).toBe(10);
  });

  test('a malformed expression leaves the value unset', () => {
    const survey = build({ calculatedValues: [{ name: 'broken', expression: '{a} ===' }] });
    expect(survey.getCalculatedValue('broken')).toBeUndefined();
    expect(survey.logicDiagnostics.expressionErrors.length).toBeGreaterThan(0);
  });

  test('a cycle between calculated values is reported, not looped', () => {
    const survey = build({
      calculatedValues: [
        { name: 'a', expression: '{b} + 1' },
        { name: 'b', expression: '{a} + 1' },
      ],
    });
    const cycle = survey.logicDiagnostics.dependencyErrors.find((e) => e.code === 'cycle');
    expect(cycle?.nodes).toContain('calculatedValue:a');
  });
});

describe('includeIntoResult', () => {
  test('only included values reach survey data', () => {
    const survey = build(order);
    survey.setValue('price', 10);
    survey.setValue('quantity', 2);

    expect(survey.data).toEqual({ price: 10, quantity: 2, tax: 4 });
    // Still computed and usable, just not part of the submitted result.
    expect(survey.getCalculatedValue('subtotal')).toBe(20);
  });

  test('an included value is announced; an excluded one is not', () => {
    const survey = build(order);
    const seen: ValueChangedEvent[] = [];
    survey.onValueChanged.add((event) => seen.push(event));

    survey.setValue('price', 10);
    survey.setValue('quantity', 2);

    expect(seen.map((event) => event.name)).toEqual(['price', 'quantity', 'tax']);
  });

  test('completion carries the included values', () => {
    const survey = build(order);
    survey.setValue('price', 5);
    survey.setValue('quantity', 2);

    let captured: Readonly<Record<string, unknown>> = {};
    survey.onComplete.add((event) => {
      captured = event.data;
    });
    survey.complete();

    expect(captured['tax']).toBe(2);
    expect(captured).not.toHaveProperty('subtotal');
  });
});

describe('calculated values and serialization', () => {
  test('round-trip is a fixed point, and computed results are never written', () => {
    const registry = createTestRegistry();
    const survey = parseSurvey(order, registry).survey;
    survey.setValue('price', 7);

    const canonical = serializeSurvey(survey, registry);
    const second = serializeSurvey(parseSurvey(canonical, registry).survey, registry);
    expect(JSON.stringify(second)).toBe(JSON.stringify(canonical));

    expect(JSON.stringify(canonical)).toContain('"expression":"{price} * {quantity}"');
    expect(JSON.stringify(canonical)).not.toContain('"subtotal":');
  });

  test('both survey collections serialize, in declaration order', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(parseSurvey(order, registry).survey, registry);
    expect(Object.keys(canonical)).toEqual(['schemaVersion', 'pages', 'calculatedValues']);
  });

  test('an empty collection is omitted entirely', () => {
    const registry = createTestRegistry();
    const canonical = serializeSurvey(
      parseSurvey({ pages: [{ name: 'p1' }] }, registry).survey,
      registry,
    );
    expect(canonical).not.toHaveProperty('calculatedValues');
  });

  test('the contract documents both collections as arrays of their element type', () => {
    const registry = createTestRegistry();
    const definitions = generateContract(registry)['$defs'] as Record<
      string,
      Record<string, unknown>
    >;
    const properties = definitions['survey']?.['properties'] as Record<string, unknown>;

    expect(properties['pages']).toEqual({ type: 'array', items: { $ref: '#/$defs/page' } });
    expect(properties['calculatedValues']).toEqual({
      type: 'array',
      items: { $ref: '#/$defs/calculatedvalue' },
    });
  });

  test('a wrongly typed child is reported rather than accepted', () => {
    const registry = createTestRegistry();
    const { diagnostics } = parseSurvey(
      { calculatedValues: [{ type: 'text', name: 'nope' }] } as SurveyDefinition,
      registry,
    );
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('unknown-element-type');
  });
});
