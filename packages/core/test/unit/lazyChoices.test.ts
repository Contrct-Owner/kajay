import { parseSurvey } from '@kajay/core';
import type { ChoicePageRequest, DropdownQuestion } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';
import { CITIES, choiceTexts as texts, paged } from '../support/FakeChoiceDirectory.js';

describe('parity/C5-lazy-loading', () => {
  test('the first page is asked for as soon as the question exists', async () => {
    const { question, directory } = paged();
    expect(directory.asked).toEqual([{ questionName: 'city', skip: 0, take: 3, filter: '' }]);
    // Waiting is a state a renderer can show, not a gap it has to guess at.
    expect(question.isLoadingChoices).toBe(true);

    await directory.reply();
    expect(texts(question)).toEqual(['Aberdeen', 'Bristol', 'Cardiff']);
    expect(question.isLoadingChoices).toBe(false);
    expect(question.hasMoreChoices).toBe(true);
  });

  test('the next page is added to the list rather than replacing it', async () => {
    const { question, directory } = paged();
    await directory.reply();

    question.loadMoreChoices();
    expect(directory.asked.at(-1)).toEqual({
      questionName: 'city',
      // From where the list got to. Asking from zero again would re-fetch what the
      // respondent is already looking at.
      skip: 3,
      take: 3,
      filter: '',
    });
    await directory.reply();

    expect(texts(question)).toEqual(['Aberdeen', 'Bristol', 'Cardiff', 'Dundee', 'Exeter', 'Falmouth']);
  });

  test('a short page is not the end of the list unless the host says so', async () => {
    const asked: ChoicePageRequest[] = [];
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              {
                type: 'dropdown',
                name: 'city',
                choicesLazyLoadEnabled: true,
                choicesLazyLoadPageSize: 3,
              },
            ],
          },
        ],
      },
      createTestRegistry(),
      {
        loadChoicePage: (request) => {
          asked.push(request);
          // One match for a page of three. A host filtering server-side can legitimately
          // return fewer than asked for and still have plenty behind it.
          return Promise.resolve({ items: [{ value: 'Aberdeen' }], hasMore: true });
        },
      },
    ).survey;
    const question = survey.getQuestionByName('city');
    if (question?.type !== 'dropdown') {
      throw new TypeError('expected a dropdown');
    }
    const dropdown = question as DropdownQuestion;
    // The resolved loader promise was observed by the pager before construction returned.
    await Promise.resolve();

    // Inferring the end from a short page would stop the list here, several pages early.
    expect(dropdown.hasMoreChoices).toBe(true);
    dropdown.loadMoreChoices();
    expect(asked).toHaveLength(2);
  });

  test('the end of the list is what the host says it is, not a short page', async () => {
    const { question, directory } = paged();
    await directory.reply();
    question.loadMoreChoices();
    await directory.reply();
    question.loadMoreChoices();
    await directory.reply();

    expect(texts(question)).toHaveLength(CITIES.length);
    expect(question.hasMoreChoices).toBe(false);
    // And there is nothing left to ask for, so asking does nothing.
    question.loadMoreChoices();
    expect(directory.asked).toHaveLength(3);
  });

  test('a second request does not start while one is outstanding', () => {
    const { question, directory } = paged();
    question.loadMoreChoices();
    question.loadMoreChoices();
    // A respondent leaning on the control, or a scroll handler firing per pixel.
    expect(directory.asked).toHaveLength(1);
  });

  test('a page that fails to arrive leaves the list usable', async () => {
    const { survey, question, directory } = paged();
    await directory.fail('Network down');

    // Not stuck loading: a spinner that never stops is a list nobody can read or get
    // past — the same failure the async validators had.
    expect(question.isLoadingChoices).toBe(false);
    expect(survey.choiceErrors).toEqual([
      'Loading choices for "city" failed: Network down',
    ]);
    // And still retryable, because a page that did not arrive is not the end.
    expect(question.hasMoreChoices).toBe(true);
    question.loadMoreChoices();
    expect(directory.asked).toHaveLength(2);
  });

  test('a question that pages without a loader says so instead of hanging', () => {
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [{ type: 'dropdown', name: 'city', choicesLazyLoadEnabled: true }],
          },
        ],
      },
      createTestRegistry(),
    ).survey;

    expect(survey.choiceErrors).toEqual([
      '"city" loads its choices lazily, so the survey needs a page loader. Pass one as the loadChoicePage option.',
    ]);
  });

  test('paging is announced, so a renderer redraws when a page lands', async () => {
    const { survey, question, directory } = paged();
    const before = survey.logicVersion;
    await directory.reply();

    expect(survey.logicVersion).toBeGreaterThan(before);
    expect(texts(question)).toHaveLength(3);
  });

  test('a rebuild of the rules keeps the pages already loaded', async () => {
    const { survey, question, directory } = paged();
    await directory.reply();

    // Rules are rebuilt whole whenever the tree changes. A pager rebuilt with them
    // would throw away the page the respondent is looking at and ask for it again.
    survey.refreshLogic();

    expect(directory.asked).toHaveLength(1);
    expect(texts(question)).toEqual(['Aberdeen', 'Bristol', 'Cardiff']);
    expect(question.hasMoreChoices).toBe(true);
  });

  test('the special choices still belong to the question, not to a page', async () => {
    const { question, directory } = paged({ showOtherItem: true, placeholder: 'Pick a city' });
    await directory.reply();

    // `other` is the definition's, so it sits after whatever has been loaded rather
    // than arriving in the middle of a page.
    expect(texts(question).at(-1)).toBe('Other');
    expect(question.placeholder).toBe('Pick a city');
  });
});
