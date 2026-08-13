import { FillInTheBlankQuestion, parseSurvey, serializeSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const DEFINITION: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        {
          type: 'fillintheblank',
          name: 'geography',
          template: 'The capital of France is [[capital]] and its currency is the [[currency]].',
          blanks: [
            { name: 'capital', label: 'Capital city', correctAnswer: 'Paris' },
            { name: 'currency', label: 'Currency', correctAnswer: 'Euro', caseSensitive: true },
          ],
        },
      ],
    },
  ],
};

function question(definition: SurveyDefinition = DEFINITION): FillInTheBlankQuestion {
  const { survey } = parseSurvey(definition, createTestRegistry(), {});
  const found = survey.getQuestionByName('geography');
  if (!(found instanceof FillInTheBlankQuestion)) {
    throw new TypeError('expected a fillintheblank question');
  }
  return found;
}

describe('parity/C13-registration', () => {
  test('the type parses into its own model with its blanks', () => {
    const parsed = question();

    expect(parsed.template).toBe(
      'The capital of France is [[capital]] and its currency is the [[currency]].',
    );
    expect(parsed.blanks.map((blank) => blank.name)).toEqual(['capital', 'currency']);
    expect(parsed.blanks[0]?.type).toBe('fillintheblankitem');
  });

  test('a blank declares what the prose cannot carry', () => {
    const [capital, currency] = question().blanks;

    // Correct answers and labels live here rather than in the template, because the
    // template is a string a translator edits — a correct answer inside it would mean a
    // translation could change the marking.
    expect(capital?.correctAnswer).toBe('Paris');
    expect(capital?.label).toBe('Capital city');
    expect(currency?.caseSensitive).toBe(true);
  });

  test('matching defaults are the registry’s, not the reader’s', () => {
    const [capital] = question().blanks;

    // ADR-0016: the descriptor is the only place a default is written. Trimmed and
    // case-insensitive by default — an assessment marking `paris` wrong is measuring
    // typing rather than geography.
    expect(capital?.trim).toBe(true);
    expect(capital?.caseSensitive).toBe(false);
  });

  test('a label falls back to the name, so no blank is ever unnamed to a reader', () => {
    const parsed = question({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'fillintheblank',
              name: 'geography',
              template: 'The capital of France is [[capital]].',
              blanks: [{ name: 'capital' }],
            },
          ],
        },
      ],
    });

    expect(parsed.blanks[0]?.label).toBe('capital');
  });

  test('the definition round-trips as authored', () => {
    const { survey } = parseSurvey(DEFINITION, createTestRegistry(), {});

    // Including the markers: the template is prose and the round trip is a fixed point,
    // so what comes back is what an author wrote (ADR-0002).
    expect(serializeSurvey(survey)).toEqual({ schemaVersion: 1, ...DEFINITION });
  });

  test('it is a question, so it inherits conditions and quiz membership', () => {
    const parsed = question();

    // Registered under `question`, which is what gives it `visibleIf`, `isRequired` and a
    // place in scoring without any of them being declared again here.
    expect(parsed.isVisible).toBe(true);
    expect(parsed.name).toBe('geography');
  });
});
