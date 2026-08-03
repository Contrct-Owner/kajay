import { parseSurvey } from '@kajay/core';
import type { Survey, SurveyProgress } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const DEFINITION: Readonly<Record<string, unknown>> = {
  clearInvisibleValues: 'none',
  calculatedValues: [
    { name: 'total', expression: '{first} + {second}', includeIntoResult: true },
  ],
  pages: [
    {
      name: 'numbers',
      elements: [
        { type: 'text', name: 'first', inputType: 'number' },
        { type: 'text', name: 'second', inputType: 'number' },
      ],
    },
    { name: 'thoughts', elements: [{ type: 'comment', name: 'why' }] },
    { name: 'extra', elements: [{ type: 'text', name: 'anythingElse' }] },
  ],
};

function build(definition: Readonly<Record<string, unknown>> = DEFINITION): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

/** A respondent part-way through, on the second page. */
function partway(): Survey {
  const survey = build();
  survey.setValue('first', 2);
  survey.setValue('second', 3);
  survey.nextPageOrComplete();
  survey.setValue('why', 'because');
  return survey;
}

/** Round-trips a snapshot through JSON, as any real store would. */
function stored(progress: SurveyProgress): SurveyProgress {
  return JSON.parse(JSON.stringify(progress)) as SurveyProgress;
}

describe('parity/E6-save-and-resume', () => {
  test('a snapshot carries the answers and where the respondent was', () => {
    const progress = partway().progress;

    expect(progress.data).toEqual({ first: 2, second: 3, why: 'because' });
    expect(progress.pageName).toBe('thoughts');
  });

  test('the snapshot survives being stored as JSON, because that is where it goes', () => {
    const restored = build();
    restored.restore(stored(partway().progress));

    expect(restored.data['why']).toBe('because');
    expect(restored.currentPage?.name).toBe('thoughts');
  });

  test('a calculated value is recomputed, not restored', () => {
    const progress = partway().progress;
    // Not in the snapshot: it is a function of the answers, and writing it back would
    // put a value in the response that nothing computed — one that would then disagree
    // with its own expression the moment an answer changed.
    expect(progress.data['total']).toBeUndefined();

    const restored = build();
    restored.restore(progress);
    expect(restored.data['total']).toBe(5);
  });

  test('the page is remembered by name, so a changed definition cannot mislead', () => {
    const progress = stored(partway().progress);
    expect(progress.pageName).toBe('thoughts');

    // The same survey with a page inserted before the one they were on. An index would
    // now point at the wrong page and say nothing about it.
    const changed = build({
      ...DEFINITION,
      pages: [
        { name: 'intro', elements: [{ type: 'text', name: 'greeting' }] },
        ...(DEFINITION['pages'] as readonly unknown[]),
      ],
    });
    changed.restore(progress);

    expect(changed.currentPage?.name).toBe('thoughts');
  });

  test('a page that no longer exists leaves the respondent at the start', () => {
    const survey = build();
    survey.restore({ data: { first: 1 }, pageName: 'deleted' });

    // Not an error and not nowhere: definitions change between saving and resuming, and
    // the first page is somewhere they can carry on from.
    expect(survey.currentPage?.name).toBe('numbers');
    expect(survey.data['first']).toBe(1);
  });

  test('answers are restored before the page, because visibility depends on them', () => {
    const survey = build({
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'plan' }] },
        {
          name: 'billing',
          visibleIf: '{plan} = "paid"',
          elements: [{ type: 'text', name: 'card' }],
        },
      ],
    });

    survey.restore({ data: { plan: 'paid' }, pageName: 'billing' });
    // The page only exists *because* of the answer. Navigating first would have aimed
    // at a page that had not appeared yet.
    expect(survey.currentPage?.name).toBe('billing');
  });

  test('a snapshot of an untouched survey restores to an untouched survey', () => {
    const survey = build();
    const restored = build();
    restored.restore(stored(survey.progress));

    expect(restored.data).toEqual({});
    expect(restored.currentPage?.name).toBe('numbers');
  });
});

describe('parity/E6-save-seams', () => {
  test('the two events a host saves on cover both kinds of progress', () => {
    const survey = build();
    const saves: string[] = [];
    // The `sendResultOnPageNext` pattern: answers as they are given, and the move
    // between pages. Neither event implies the other — a respondent can fill a whole
    // page without moving, or move without answering anything.
    survey.onValueChanged.add(() => saves.push('value'));
    survey.onCurrentPageChanged.add(() => saves.push('page'));

    survey.setValue('first', 2);
    survey.nextPageOrComplete();

    expect(saves).toEqual(['value', 'page']);
  });

  test('what a host saves on the page-change event already has the new page in it', () => {
    const survey = build();
    let seen: SurveyProgress | undefined;
    survey.onCurrentPageChanged.add(() => {
      seen = survey.progress;
    });

    survey.nextPageOrComplete();
    // Saving on the way out has to record where they arrived, not where they left.
    expect(seen?.pageName).toBe('thoughts');
  });
});
