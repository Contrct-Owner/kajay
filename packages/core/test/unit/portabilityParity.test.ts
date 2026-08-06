import {
  createDefaultFunctionRegistry,
  createValueResolver,
  evaluateExpression,
  parseExpression,
  parseSurvey,
  serializeSurvey,
  TextQuestion,
} from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

class PortableQuestion extends TextQuestion {
  override get type(): string {
    return 'portable';
  }

  get marker(): string {
    return this.getStringProperty('marker');
  }
}

describe('parity/Q9-portability', () => {
  test('definition text, extensions, UTC values, and portable patterns share v2 semantics', () => {
    const registry = createTestRegistry();
    registry.addClass({
      name: 'portable',
      parent: 'text',
      properties: [{ name: 'marker', type: 'string', isLocalizable: true }],
      create: () => new PortableQuestion(),
    });
    registry.addProperty('question', { name: 'tenantTag', type: 'string' });
    const parsed = parseSurvey(
      {
        locale: 'fr-CA',
        title: { default: 'Survey', fr: 'Sondage', 'FR-ca': 'Questionnaire' },
        pages: [
          {
            name: 'main',
            elements: [
              {
                type: 'portable',
                name: 'code',
                marker: { default: 'Badge', fr: 'Insigne' },
                tenantTag: 'blue',
                validators: [{ type: 'regexvalidator', regex: '^(ab|cd)+\\d{2}$' }],
              },
            ],
          },
        ],
      },
      registry,
    );
    const question = parsed.survey.getQuestionByName('code');
    expect(question).toBeInstanceOf(PortableQuestion);
    expect(parsed.survey.locale).toBe('fr-CA');
    expect(parsed.survey.title).toBe('Questionnaire');
    expect((question as PortableQuestion).marker).toBe('Insigne');
    expect(question?.getResolvedProperty('tenantTag')).toBe('blue');

    parsed.survey.setLocale('FR-be');
    expect(parsed.survey.title).toBe('Sondage');
    parsed.survey.setLocale('es-MX');
    expect(parsed.survey.title).toBe('Survey');
    expect((serializeSurvey(parsed.survey) as Record<string, unknown>)['title']).toEqual({
      default: 'Survey',
      fr: 'Sondage',
      'FR-ca': 'Questionnaire',
    });

    parsed.survey.setValue('code', 'ab12');
    expect(parsed.survey.validation.validateAll()).toBe(true);
    parsed.survey.setValue('code', 'abX2');
    expect(parsed.survey.validation.validateAll()).toBe(false);

    const expression = parseExpression('getDate("2030-01-02T03:04:05+05:30")');
    expect(expression.errors).toEqual([]);
    const result = evaluateExpression(expression.node, {
      getValue: createValueResolver({}),
      functions: createDefaultFunctionRegistry(),
      now: new Date('2040-01-01T00:00:00.000Z'),
    });
    expect(result.value).toEqual(new Date('2030-01-01T21:34:05.000Z'));
  });
});
