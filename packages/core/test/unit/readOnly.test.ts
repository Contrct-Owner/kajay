import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    {
      ...extra,
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'name' },
            { type: 'text', name: 'reference', readOnly: true },
          ],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
}

describe('parity/E7-read-only', () => {
  test('a question can be for reading while the rest of the survey is not', () => {
    const survey = build();
    expect(survey.getQuestionByName('name')?.isReadOnly).toBe(false);
    expect(survey.getQuestionByName('reference')?.isReadOnly).toBe(true);
  });

  test('the whole survey turns to reading in one flag', () => {
    const survey = build({ readOnly: true });
    // Combined by the model, not by each adapter: leaving that to renderers is how one
    // honours the survey-wide flag and another only the per-question one.
    expect(survey.getQuestionByName('name')?.isReadOnly).toBe(true);
  });

  test('a host can flip it at runtime, and the renderer hears about it', () => {
    const survey = build();
    const states: string[] = [];
    survey.onElementStateChanged.add((event) => states.push(event.state));

    survey.setReadOnly(true);
    expect(survey.getQuestionByName('name')?.isReadOnly).toBe(true);
    // On the channel a renderer already watches. A silent change would leave a
    // respondent typing into a survey that believes nobody may.
    expect(states).toEqual(['readonly']);
  });

  test('read-only is not disabled, and the two are independent', () => {
    const survey = build({ readOnly: true });
    const question = survey.getQuestionByName('name');

    // Different states with different meanings: disabled is "not yet", read-only is
    // "not yours to change". A read-only question is still enabled, so it keeps its
    // place in the tab order and its answer stays readable.
    expect(question?.isEnabled).toBe(true);
    expect(question?.isReadOnly).toBe(true);
  });

  test('logic still writes into a read-only question', () => {
    const survey = parseSurvey(
      {
        readOnly: true,
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'price', inputType: 'number' },
              {
                type: 'text',
                name: 'annual',
                readOnly: true,
                defaultValueExpression: '{price} * 12',
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    survey.setValue('price', 10);
    // The whole point of a read-only answer that computes itself: the respondent may
    // not type into it, and something else must be able to fill it in.
    expect(survey.getValue('annual')).toBe(120);
  });

  test('the flag round-trips as authored, on the survey and on the question', () => {
    const survey = build({ readOnly: true });
    expect(survey.isReadOnly).toBe(true);
    expect(survey.getQuestionByName('reference')?.getPropertyValue('readOnly')).toBe(true);
  });
});

describe('parity/K3-design-mode', () => {
  test('a survey on a canvas is read-only without the definition saying so', () => {
    const survey = build();
    survey.setDesignMode(true);

    // The third contributor to `isReadOnly`, taking the route `isPreviewing` already
    // takes: computed, never a property, so opening a definition in a Creator cannot
    // stamp it with a flag the author never wrote.
    expect(survey.isReadOnly).toBe(true);
    expect(survey.getPropertyValue('readOnly')).toBeUndefined();
  });

  test('entering the mode it is already in announces nothing', () => {
    const survey = build();
    survey.setDesignMode(true);
    let announcements = 0;
    survey.onElementStateChanged.add(() => {
      announcements += 1;
    });

    survey.setDesignMode(true);

    // Re-entering design mode would otherwise re-render every question on the canvas
    // for a state that did not change.
    expect(announcements).toBe(0);
  });

  test('leaving it hands the survey back', () => {
    const survey = build();
    survey.setDesignMode(true);
    survey.setDesignMode(false);

    expect(survey.isReadOnly).toBe(false);
  });
});
