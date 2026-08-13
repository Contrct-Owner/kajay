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
            { type: 'text', name: 'capital', title: 'Capital city', correctAnswer: 'Paris' },
            { type: 'text', name: 'currency', title: 'Currency', correctAnswer: 'Euro', caseSensitive: true },
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
    expect(parsed.blanks[0]?.type).toBe('text');
  });

  test('a blank declares what the prose cannot carry', () => {
    const [capital, currency] = question().blanks;

    // Correct answers and labels live here rather than in the template, because the
    // template is a string a translator edits — a correct answer inside it would mean a
    // translation could change the marking.
    expect(capital?.correctAnswer).toBe('Paris');
    expect(capital?.title).toBe('Capital city');
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

  test('a blank is a real question, so it brings its own type with it', () => {
    const parsed = question({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'fillintheblank',
              name: 'geography',
              template: 'The capital of France is [[capital]].',
              blanks: [{ type: 'dropdown', name: 'capital', choices: ['Paris', 'Lyon'] }],
            },
          ],
        },
      ],
    });

    // A dropdown blank *is* a dropdown: its choices come from the select family rather
    // than from anything reimplemented inside a private item type.
    expect(parsed.blanks[0]?.type).toBe('dropdown');
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
