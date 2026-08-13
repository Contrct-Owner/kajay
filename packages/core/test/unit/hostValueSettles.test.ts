import { createDefaultFunctionRegistry, parseSurvey } from '@kajay/core';
import type { ParseResult, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/** A panel gated on a host value, plus an answer the same page can change. */
function build(options: Readonly<Record<string, unknown>> = {}): ParseResult {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'plan' },
            { type: 'text', name: 'upgrade', visibleIf: '{$tier} = "gold"' },
          ],
        },
      ],
      calculatedValues: [{ name: 'seatsPlusOne', expression: '{$seats} + 1' }],
    },
    createTestRegistry(),
    options,
  );
}

function isVisible(survey: Survey, name: string): boolean {
  return survey.getQuestionByName(name)?.isVisible ?? false;
}

describe('parity/B12-host-value-settles', () => {
  test('a write recomputes everything that reads it', () => {
    const { survey } = build({ values: { tier: 'bronze' } });
    expect(isVisible(survey, 'upgrade')).toBe(false);

    survey.setHostValue('tier', 'gold');

    // The point of rule 3: unlike an endpoint, a host value is a real graph root, so a
    // condition reading it re-runs rather than holding the answer it first computed.
    expect(isVisible(survey, 'upgrade')).toBe(true);
  });

  test('and a calculated value that reads it is recomputed too', () => {
    const { survey } = build({ values: { seats: 40 } });
    expect(survey.getCalculatedValue('seatsPlusOne')).toBe(41);

    survey.setHostValue('seats', 10);

    expect(survey.getCalculatedValue('seatsPlusOne')).toBe(11);
  });

  test('a value supplied for the first time is a change', () => {
    const { survey } = build();
    expect(isVisible(survey, 'upgrade')).toBe(false);

    survey.setHostValue('tier', 'gold');

    // Absent and `undefined` are the same to a reader, but going from "never supplied"
    // to a value has to recompute or a host that sets everything after parsing would
    // watch nothing happen.
    expect(isVisible(survey, 'upgrade')).toBe(true);
  });

  test('writing the value already in force recomputes nothing', () => {
    let calls = 0;
    const functions = createDefaultFunctionRegistry();
    functions.register('countCalls', (args) => {
      calls += 1;
      return args[0];
    });
    const { survey } = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [{ type: 'text', name: 'q', visibleIf: 'countCalls({$tier}) = "gold"' }],
          },
        ],
      },
      createTestRegistry(),
      { values: { tier: 'gold' }, functions },
    );
    const before = calls;

    survey.setHostValue('tier', 'gold');

    // Counting evaluations rather than announcements: nothing *would* have changed
    // anyway, so an announcement count cannot tell "did not recompute" from
    // "recomputed and found the same answer". A host free to refresh its context on a
    // timer must not be able to make the survey re-evaluate for a value that did not move.
    expect(calls).toBe(before);
    expect(before).toBeGreaterThan(0);
  });

  test('an explicit undefined still counts as supplying it', () => {
    const { survey } = build({ values: { tier: 'gold' } });
    expect(isVisible(survey, 'upgrade')).toBe(true);

    survey.setHostValue('tier', undefined);

    // Withdrawing a value is a change like any other; the condition stops holding.
    expect(isVisible(survey, 'upgrade')).toBe(false);
  });

  test('nothing is observable part-way through a multi-step cascade', () => {
    const { survey } = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [{ type: 'text', name: 'big', visibleIf: '{doubled} > 20' }],
          },
        ],
        calculatedValues: [{ name: 'doubled', expression: '{$seats} * 2' }],
      },
      createTestRegistry(),
      { values: { seats: 5 } },
    );
    const seen: { doubled: unknown; big: boolean }[] = [];
    survey.onElementStateChanged.add(() => {
      // Read the model from inside the announcement. The write moves a host value, which
      // moves a calculated value, which moves a visibility — two hops, so a listener
      // reached too early could catch `doubled` already updated while `big` still holds
      // the answer computed from the old one. ADR-0004 says that state is unobservable,
      // and a new kind of graph root must not be the thing that makes it observable.
      seen.push({ doubled: survey.getCalculatedValue('doubled'), big: isVisible(survey, 'big') });
    });

    survey.setHostValue('seats', 20);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen).toEqual(seen.map(() => ({ doubled: 40, big: true })));
  });

  test('a host value change is not announced as an answer change', () => {
    const { survey } = build({ values: { tier: 'bronze' } });
    const values: string[] = [];
    survey.onValueChanged.add((event) => {
      values.push(event.name);
    });

    survey.setHostValue('tier', 'gold');

    // `onValueChanged` means an answer changed, and a listener told otherwise would go
    // looking in `data` for a name that is not there — a partial save woken by this
    // would write a response nobody had altered.
    expect(values).toEqual([]);
  });

  test('and it never reaches the response, however it was written', () => {
    const { survey } = build({ values: { tier: 'bronze' } });
    survey.setValue('plan', 'pro');
    survey.setHostValue('tier', 'gold');

    expect(survey.data).toEqual({ plan: 'pro' });
    expect(Object.keys(survey.createSnapshot().data)).toEqual(['plan']);
  });

  test('a host value and an answer of the same name stay independent', () => {
    const { survey } = build({ values: { plan: 'host' } });
    survey.setValue('plan', 'answer');
    survey.setHostValue('plan', 'host2');

    // Two scopes, two stores: writing one must not disturb the other in either
    // direction, which is what keeps the respondent unable to touch host context.
    expect(survey.getValue('plan')).toBe('answer');
    expect(survey.evaluate('{$plan}').value).toBe('host2');
    expect(survey.evaluate('{plan}').value).toBe('answer');
  });

  test('the status templates follow a write, not just the parse-time values', () => {
    const { survey } = parseSurvey(
      { completedHtml: 'Tier: {$tier}', pages: [{ name: 'p1', elements: [] }] },
      createTestRegistry(),
      { values: { tier: 'bronze' } },
    );
    survey.setHostValue('tier', 'gold');
    survey.complete();

    // Templates read through the same store, so they cannot show a value the conditions
    // have already moved past.
    expect(survey.status.completedHtml).toBe('Tier: gold');
  });
});
