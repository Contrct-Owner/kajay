import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

function threePages(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return build({
    ...extra,
    pages: [
      { name: 'one', elements: [{ type: 'text', name: 'a' }] },
      { name: 'two', elements: [{ type: 'text', name: 'b' }] },
      { name: 'three', elements: [{ type: 'text', name: 'c' }] },
    ],
  });
}

describe('parity/E2-navigation', () => {
  test('next and previous walk the pages and report the ends', () => {
    const survey = threePages();

    expect([survey.currentPageNo, survey.pageCount]).toEqual([0, 3]);
    expect([survey.isFirstPage, survey.isLastPage]).toEqual([true, false]);

    expect(survey.nextPage()).toBe(true);
    expect(survey.currentPage?.name).toBe('two');
    expect([survey.isFirstPage, survey.isLastPage]).toEqual([false, false]);

    expect(survey.nextPage()).toBe(true);
    expect([survey.isFirstPage, survey.isLastPage]).toEqual([false, true]);

    // Refused rather than clamped silently, so a caller can tell it hit the end.
    expect(survey.nextPage()).toBe(false);
    expect(survey.currentPageNo).toBe(2);

    expect(survey.prevPage()).toBe(true);
    expect(survey.currentPage?.name).toBe('two');
  });

  test('previous from the first page is refused', () => {
    const survey = threePages();
    expect(survey.prevPage()).toBe(false);
    expect(survey.currentPageNo).toBe(0);
  });

  test('a page change is announced once, with both indices', () => {
    const survey = threePages();
    const events: string[] = [];
    survey.onCurrentPageChanged.add((event) => {
      events.push(`${event.previousPageNo}->${event.currentPageNo}`);
    });

    survey.nextPage();
    survey.nextPage();
    survey.nextPage();

    expect(events).toEqual(['0->1', '1->2']);
  });

  test('advancing past the last page completes instead', () => {
    const survey = threePages();
    survey.setCurrentPageNo(2);

    survey.nextPageOrComplete();
    expect(survey.isCompleted).toBe(true);
  });

  test('advancing anywhere else does not complete', () => {
    const survey = threePages();
    survey.nextPageOrComplete();
    expect([survey.currentPageNo, survey.isCompleted]).toEqual([1, false]);
  });
});

describe('parity/E2-page-visibility', () => {
  const branching = {
    pages: [
      { name: 'one', elements: [{ type: 'text', name: 'gate' }] },
      {
        name: 'two',
        visibleIf: "{gate} == 'yes'",
        elements: [{ type: 'text', name: 'b' }],
      },
      { name: 'three', elements: [{ type: 'text', name: 'c' }] },
    ],
  };

  test('a hidden page is not counted and not walked through', () => {
    const survey = build(branching);

    expect(survey.pageCount).toBe(2);
    expect(survey.visiblePages.map((page) => page.name)).toEqual(['one', 'three']);

    survey.nextPage();
    expect(survey.currentPage?.name).toBe('three');
  });

  test('answering brings the page back, in its authored position', () => {
    const survey = build(branching);
    survey.setValue('gate', 'yes');

    expect(survey.pageCount).toBe(3);
    survey.nextPage();
    expect(survey.currentPage?.name).toBe('two');
  });

  test('hiding the page underneath the respondent moves them somewhere real', () => {
    const survey = build(branching);
    survey.setValue('gate', 'yes');
    survey.setCurrentPageNo(2);
    expect(survey.currentPage?.name).toBe('three');

    // Page two disappears, so index 2 no longer exists.
    survey.setValue('gate', 'no');

    expect(survey.currentPageNo).toBe(1);
    expect(survey.currentPage?.name).toBe('three');
  });

  test('the move is announced, so a renderer is never left drawing nothing', () => {
    const survey = build(branching);
    survey.setValue('gate', 'yes');
    survey.setCurrentPageNo(2);

    let announced = 0;
    survey.onCurrentPageChanged.add(() => {
      announced += 1;
    });
    survey.setValue('gate', 'no');

    expect(announced).toBe(1);
  });

  test('parity/B7-trigger-skip: a skip trigger moves the respondent', () => {
    const survey = build({
      triggers: [{ type: 'skip', expression: "{gate} == 'skip'", gotoName: 'c' }],
      pages: [
        { name: 'one', elements: [{ type: 'text', name: 'gate' }] },
        { name: 'two', elements: [{ type: 'text', name: 'b' }] },
        { name: 'three', elements: [{ type: 'text', name: 'c' }] },
      ],
    });

    // Named by question, not by page: authors think "jump to this question".
    survey.setValue('gate', 'skip');
    expect(survey.currentPage?.name).toBe('three');
  });
});

describe('parity/E2-questions-on-page-mode', () => {
  test('standard leaves the authored pages alone', () => {
    const survey = threePages({ questionsOnPageMode: 'standard' });
    expect(survey.visiblePages.map((page) => page.name)).toEqual(['one', 'two', 'three']);
  });

  test('singlePage merges everything into one', () => {
    const survey = threePages({ questionsOnPageMode: 'singlePage' });

    expect(survey.pageCount).toBe(1);
    expect(survey.visiblePages[0]?.elements.map((element) => element.name)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(survey.isLastPage).toBe(true);
  });

  test('questionPerPage gives each question a page of its own', () => {
    const survey = threePages({ questionsOnPageMode: 'questionPerPage' });

    expect(survey.pageCount).toBe(3);
    expect(survey.visiblePages.map((page) => page.name)).toEqual(['a', 'b', 'c']);
  });

  test('questionPerPage flattens panels, since there is nowhere to put a group', () => {
    const survey = build({
      questionsOnPageMode: 'questionPerPage',
      pages: [
        {
          name: 'one',
          elements: [
            { type: 'text', name: 'a' },
            { type: 'panel', name: 'group', elements: [{ type: 'text', name: 'b' }] },
          ],
        },
      ],
    });

    expect(survey.visiblePages.map((page) => page.name)).toEqual(['a', 'b']);
  });

  test('singlePage keeps panels, because grouping is what a long page needs', () => {
    const survey = build({
      questionsOnPageMode: 'singlePage',
      pages: [
        {
          name: 'one',
          elements: [{ type: 'panel', name: 'group', elements: [{ type: 'text', name: 'b' }] }],
        },
      ],
    });

    expect(survey.visiblePages[0]?.elements.map((element) => element.type)).toEqual(['panel']);
  });

  test('a hidden question is absent from questionPerPage entirely', () => {
    const survey = build({
      questionsOnPageMode: 'questionPerPage',
      pages: [
        {
          name: 'one',
          elements: [
            { type: 'text', name: 'gate' },
            { type: 'text', name: 'maybe', visibleIf: '{gate} notempty' },
          ],
        },
      ],
    });

    expect(survey.pageCount).toBe(1);
    survey.setValue('gate', 'yes');
    expect(survey.visiblePages.map((page) => page.name)).toEqual(['gate', 'maybe']);
  });

  test('the layout is stable between reads, so a renderer does not remount', () => {
    const survey = threePages({ questionsOnPageMode: 'singlePage' });
    // Identity, not equality: React keys on it, and a fresh page every read would
    // throw away focus and every question's DOM on each render.
    expect(survey.visiblePages[0]).toBe(survey.visiblePages[0]);
  });

  test('the mode never edits the definition', () => {
    const survey = threePages({ questionsOnPageMode: 'singlePage' });
    expect(survey.pages.map((page) => page.name)).toEqual(['one', 'two', 'three']);
  });
});
