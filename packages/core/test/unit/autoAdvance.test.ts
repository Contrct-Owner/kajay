import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    {
      goNextPageAutomatic: true,
      ...extra,
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'radiogroup', name: 'plan', choices: ['free', 'paid'] },
            { type: 'rating', name: 'mood', rateMax: 3 },
          ],
        },
        { name: 'p2', elements: [{ type: 'text', name: 'notes' }] },
        { name: 'p3', elements: [{ type: 'text', name: 'more' }] },
      ],
    },
    createTestRegistry(),
  ).survey;
}

describe('parity/E10-go-next-page-automatic', () => {
  test('the page turns once the last one-step answer is given', () => {
    const survey = build();
    survey.setValue('plan', 'free');
    // Still here: one question on the page is unanswered, and moving on would take the
    // choice away rather than save a click.
    expect(survey.currentPageNo).toBe(0);

    survey.setValue('mood', 2);
    expect(survey.currentPageNo).toBe(1);
  });

  test('a typed answer never turns the page', () => {
    const survey = parseSurvey(
      {
        goNextPageAutomatic: true,
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'name' }] },
          { name: 'p2', elements: [{ type: 'text', name: 'notes' }] },
        ],
      },
      createTestRegistry(),
    ).survey;

    survey.setValue('name', 'A');
    // A text answer arrives a character at a time. A survey that turned the page after
    // the first letter of a name would be unusable.
    expect(survey.currentPageNo).toBe(0);
  });

  test('the last page never turns itself in', () => {
    const survey = parseSurvey(
      {
        goNextPageAutomatic: true,
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'notes' }] },
          {
            name: 'p2',
            // One-step, so every other condition for moving on is met — the only thing
            // stopping it is that there is nowhere to go but the end.
            elements: [{ type: 'radiogroup', name: 'plan', choices: ['free', 'paid'] }],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.goTo('p2');

    survey.setValue('plan', 'free');

    // Submitting is a decision. A survey that submitted itself on the final click
    // would take it from the respondent, along with any chance to look back.
    expect(survey.isCompleted).toBe(false);
    expect(survey.currentPageNo).toBe(1);
  });

  test('it still goes through the gate', () => {
    const survey = parseSurvey(
      {
        goNextPageAutomatic: true,
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'radiogroup', name: 'plan', choices: ['free', 'paid'] },
              {
                type: 'text',
                name: 'code',
                defaultValueExpression: "'nope'",
                validators: [{ type: 'regexvalidator', regex: '^[0-9]+$' }],
              },
            ],
          },
          { name: 'p2', elements: [{ type: 'text', name: 'notes' }] },
        ],
      },
      createTestRegistry(),
    ).survey;

    survey.setValue('plan', 'free');
    // Every question is answered, so the move was attempted — and refused, because
    // saving a click must not skip a check.
    expect(survey.currentPageNo).toBe(0);
    expect(survey.getQuestionByName('code')?.hasErrors).toBe(true);
  });

  test('nothing moves unless the definition asks for it', () => {
    const survey = build({ goNextPageAutomatic: false });
    survey.setValue('plan', 'free');
    survey.setValue('mood', 2);

    expect(survey.currentPageNo).toBe(0);
  });

  test('a question nobody can reach does not hold the page back', () => {
    const survey = parseSurvey(
      {
        goNextPageAutomatic: true,
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'radiogroup', name: 'plan', choices: ['free', 'paid'] },
              { type: 'text', name: 'card', visibleIf: '{plan} = "paid"' },
            ],
          },
          { name: 'p2', elements: [{ type: 'text', name: 'notes' }] },
        ],
      },
      createTestRegistry(),
    ).survey;

    survey.setValue('plan', 'free');
    // `card` is unanswered and unreachable, which is not the same as outstanding.
    expect(survey.currentPageNo).toBe(1);
  });
});
