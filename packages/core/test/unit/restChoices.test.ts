import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { ChoiceFetcher, SelectQuestion, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(
  definition: Readonly<Record<string, unknown>>,
  fetchJson?: ChoiceFetcher,
): Survey {
  return parseSurvey(
    definition,
    createTestRegistry(),
    fetchJson === undefined ? {} : { fetchJson },
  ).survey;
}

function select(survey: Survey, name: string): SelectQuestion {
  const question = survey.getQuestionByName(name);
  if (question === undefined) {
    throw new TypeError(`no question named ${name}`);
  }
  return question as SelectQuestion;
}

const countries = [
  { id: 'uk', label: 'United Kingdom' },
  { id: 'fr', label: 'France' },
];

function restDefinition(url: string): Readonly<Record<string, unknown>> {
  return {
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'region' },
          {
            type: 'dropdown',
            name: 'country',
            choicesByUrl: url,
            choicesPath: 'data.items',
            choicesValueName: 'id',
            choicesTitleName: 'label',
          },
        ],
      },
    ],
  };
}

describe('parity/B10-rest-choices', () => {

  test('loads choices, extracting the configured path and field names', async () => {
    const survey = build(restDefinition('https://example.test/countries'), () =>
      Promise.resolve({ data: { items: countries } }),
    );
    await Promise.resolve();

    const question = select(survey, 'country');
    expect(question.visibleChoices.map((c) => c.value)).toEqual(['uk', 'fr']);
    expect(question.visibleChoices.map((c) => c.text)).toEqual(['United Kingdom', 'France']);
  });

  test('a bare array of scalars is a legitimate response', async () => {
    const survey = build(
      {
        pages: [
          {
            name: 'p1',
            elements: [{ type: 'dropdown', name: 'q', choicesByUrl: 'https://example.test/a' }],
          },
        ],
      },
      () => Promise.resolve(['x', 'y']),
    );
    await Promise.resolve();
    expect(select(survey, 'q').visibleChoices.map((c) => c.value)).toEqual(['x', 'y']);
  });

  test('a {question} placeholder makes the answer a real dependency', async () => {
    const requested: string[] = [];
    const survey = build(restDefinition('https://example.test/{region}/countries'), (url) => {
      requested.push(url);
      return Promise.resolve({ data: { items: countries } });
    });
    await Promise.resolve();

    survey.setValue('region', 'emea');
    await Promise.resolve();

    // Re-fetched because the URL interpolates an answer that changed.
    expect(requested).toContain('https://example.test/emea/countries');
  });

  test('a placeholder value is URL-encoded', async () => {
    const requested: string[] = [];
    const survey = build(restDefinition('https://example.test/{region}'), (url) => {
      requested.push(url);
      return Promise.resolve({ data: { items: [] } });
    });
    survey.setValue('region', 'a b&c');
    await Promise.resolve();
    expect(requested).toContain('https://example.test/a%20b%26c');
  });

  test('a repeated URL is served from cache without fetching again', async () => {
    let calls = 0;
    const survey = build(restDefinition('https://example.test/{region}/countries'), () => {
      calls += 1;
      return Promise.resolve({ data: { items: countries } });
    });
    await Promise.resolve();

    survey.setValue('region', 'emea');
    await Promise.resolve();
    const afterFirst = calls;

    survey.setValue('region', 'apac');
    await Promise.resolve();
    survey.setValue('region', 'emea');
    await Promise.resolve();

    // apac was new; going back to emea reused the cached response.
    expect(calls).toBe(afterFirst + 1);
  });

  test('a failed load is reported and leaves the authored list in place', async () => {
    const survey = build(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              {
                type: 'dropdown',
                name: 'q',
                choices: ['fallback'],
                choicesByUrl: 'https://example.test/boom',
              },
            ],
          },
        ],
      },
      () => Promise.reject(new Error('network down')),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(select(survey, 'q').visibleChoices.map((c) => c.value)).toEqual(['fallback']);
    expect(survey.choiceErrors.join(' ')).toMatch(/network down/u);
  });

  test('a response that is not an array at the path is reported', async () => {
    const survey = build(restDefinition('https://example.test/x'), () =>
      Promise.resolve({ data: { items: 'not an array' } }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(survey.choiceErrors.join(' ')).toMatch(/did not return an array/u);
  });

  test('without a fetcher the survey says so rather than failing silently', () => {
    const survey = build(restDefinition('https://example.test/x'));
    expect(survey.choiceErrors.join(' ')).toMatch(/No choice fetcher is configured/u);
  });

  test('the URL round-trips; loaded choices never do', async () => {
    const registry = createTestRegistry();
    const survey = parseSurvey(restDefinition('https://example.test/c'), registry, {
      fetchJson: () => Promise.resolve({ data: { items: countries } }),
    }).survey;
    await Promise.resolve();

    const serialized = JSON.stringify(serializeSurvey(survey, registry));
    expect(serialized).toContain('"choicesByUrl":"https://example.test/c"');
    expect(serialized).not.toContain('United Kingdom');
  });
});

