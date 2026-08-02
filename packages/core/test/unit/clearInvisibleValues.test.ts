import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/** A branch: `secret` is only reachable while `show` says yes. */
function branching(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    {
      ...extra,
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'show' },
            { type: 'text', name: 'secret', visibleIf: '{show} = "yes"' },
          ],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
}

function answered(extra: Readonly<Record<string, unknown>> = {}): Survey {
  const survey = branching(extra);
  survey.setValue('show', 'yes');
  survey.setValue('secret', 'told you');
  return survey;
}

describe('parity/E9-clear-invisible-values', () => {
  test('by default an unreachable answer survives the survey but not the submission', () => {
    const survey = answered();
    expect(survey.clearInvisibleValues).toBe('onComplete');

    survey.setValue('show', 'no');
    // Still there: a respondent flicking a branch back and forth would otherwise lose
    // what they typed the first time.
    expect(survey.data['secret']).toBe('told you');

    survey.complete();
    // And gone from what the host receives, because nobody answered a question they
    // could not see.
    expect(survey.data['secret']).toBeUndefined();
  });

  test('what the host is handed at completion is already clean', () => {
    const survey = answered();
    survey.setValue('show', 'no');

    let submitted: Readonly<Record<string, unknown>> | undefined;
    survey.onComplete.add((event) => {
      submitted = event.data;
    });
    survey.complete();

    // The event carries the answers, so clearing after emitting would ship exactly the
    // data the policy exists to withhold.
    expect(submitted).toEqual({ show: 'no' });
  });

  test('onHidden destroys the answer as the question goes', () => {
    const survey = answered({ clearInvisibleValues: 'onHidden' });
    survey.setValue('show', 'no');

    expect(survey.data['secret']).toBeUndefined();
    // Really gone, not withheld: bringing the branch back does not bring it back.
    survey.setValue('show', 'yes');
    expect(survey.data['secret']).toBeUndefined();
  });

  test('onHidden clears inside the settle, so nobody sees the answer outlive its question', () => {
    const survey = answered({ clearInvisibleValues: 'onHidden' });

    let dataAtFirstEvent: Readonly<Record<string, unknown>> | undefined;
    survey.onValueChanged.add(() => {
      dataAtFirstEvent ??= survey.data;
    });
    survey.setValue('show', 'no');

    // The very first thing anyone hears about this change already has the answer gone.
    // Clearing after the settle would announce a model where the question is
    // unreachable and its answer is still in the data (ADR-0004).
    expect(dataAtFirstEvent).toEqual({ show: 'no' });
  });

  test('none keeps everything, even through completion', () => {
    const survey = answered({ clearInvisibleValues: 'none' });
    survey.setValue('show', 'no');
    survey.complete();

    // Right when the branches are a filter rather than a fork: the answer was given,
    // and the definition merely stopped asking for it.
    expect(survey.data['secret']).toBe('told you');
  });

  test('an unknown policy falls back to the default rather than to keeping everything', () => {
    const survey = answered({ clearInvisibleValues: 'whenever' });
    expect(survey.clearInvisibleValues).toBe('onComplete');
  });
});

describe('parity/E9-reachability', () => {
  test('a question inside a hidden panel is unreachable however visible it is', () => {
    const survey = parseSurvey(
      {
        clearInvisibleValues: 'onHidden',
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'show' },
              {
                type: 'panel',
                name: 'details',
                visibleIf: '{show} = "yes"',
                elements: [{ type: 'text', name: 'secret' }],
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('show', 'yes');
    survey.setValue('secret', 'told you');

    survey.setValue('show', 'no');
    // The question's own `isVisible` never changed — the container took it out of
    // reach, which is a different question and the one that matters here.
    expect(survey.getQuestionByName('secret')?.isVisible).toBe(true);
    expect(survey.data['secret']).toBeUndefined();
  });

  test('a question on a hidden page goes the same way', () => {
    const survey = parseSurvey(
      {
        clearInvisibleValues: 'onHidden',
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'show' }] },
          {
            name: 'p2',
            visibleIf: '{show} = "yes"',
            elements: [{ type: 'text', name: 'secret' }],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('show', 'yes');
    survey.setValue('secret', 'told you');

    survey.setValue('show', 'no');
    expect(survey.data['secret']).toBeUndefined();
  });

  test('clearing one answer clears what depended on it, in the same change', () => {
    const survey = parseSurvey(
      {
        clearInvisibleValues: 'onHidden',
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'show' },
              { type: 'text', name: 'first', visibleIf: '{show} = "yes"' },
              { type: 'text', name: 'second', visibleIf: '{first} notempty' },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('show', 'yes');
    survey.setValue('first', 'a');
    survey.setValue('second', 'b');

    survey.setValue('show', 'no');
    // `second` was reachable until `first` was cleared, so one sweep would have left
    // it behind — which is why the pass repeats until nothing more falls out.
    expect(survey.data).toEqual({ show: 'no' });
  });

  test('a rule that refills what the policy clears settles instead of hanging', () => {
    const survey = parseSurvey(
      {
        clearInvisibleValues: 'onHidden',
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'show' },
              {
                // An authoring mistake: the answer is forced by a rule and hidden by
                // its own condition, so clearing it and refilling it could go round
                // for ever. The pass cap turns that into a survey that settles.
                type: 'text',
                name: 'forced',
                visibleIf: '{show} = "yes"',
                setValueIf: '{show} = "no"',
                setValueExpression: "'again'",
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    survey.setValue('show', 'no');
    expect(survey.getValue('show')).toBe('no');
  });

  test('a rule that reads the answer it refills does not recurse for ever', () => {
    const survey = parseSurvey(
      {
        clearInvisibleValues: 'onHidden',
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'show' },
              {
                // The nastier shape of the same mistake: the rule *reads* the answer it
                // writes, so clearing it is a change the rule reacts to by putting it
                // back. Each clear re-runs the rule, which is a stack of clears rather
                // than a loop of them — the pass cap alone would not stop this.
                type: 'text',
                name: 'forced',
                visibleIf: '{show} = "yes"',
                setValueIf: '{forced} empty',
                setValueExpression: "'again'",
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    survey.setValue('show', 'no');
    // Settled somewhere rather than overflowing the stack. Which side it lands on is
    // the author's business; that the survey survives their mistake is ours.
    expect(survey.getValue('show')).toBe('no');
  });

  test('a default written into a hidden question is cleared as the survey is built', () => {
    const survey = parseSurvey(
      {
        clearInvisibleValues: 'onHidden',
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'show' },
              {
                type: 'text',
                name: 'seeded',
                visibleIf: '{show} = "yes"',
                defaultValueExpression: "'from the definition'",
              },
            ],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    // The policy holds from the first evaluation, not only from the first change —
    // which is what a restored response depends on.
    expect(survey.data).toEqual({});
  });
});
