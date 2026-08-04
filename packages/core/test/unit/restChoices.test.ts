import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { ChoiceFetcher, SelectQuestion, Survey } from '@kajay/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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

function choiceValues(survey: Survey, name: string): readonly unknown[] {
  return select(survey, name).visibleChoices.map((choice) => choice.value);
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

    await vi.waitFor(() => {
      expect(choiceValues(survey, 'country')).toEqual(['uk', 'fr']);
    });
    expect(select(survey, 'country').visibleChoices.map((c) => c.text)).toEqual([
      'United Kingdom',
      'France',
    ]);
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

    await vi.waitFor(() => {
      expect(choiceValues(survey, 'q')).toEqual(['x', 'y']);
    });
  });

  test('a {question} placeholder makes the answer a real dependency', async () => {
    const requested: string[] = [];
    const survey = build(restDefinition('https://example.test/{region}/countries'), (url) => {
      requested.push(url);
      return Promise.resolve({ data: { items: countries } });
    });

    survey.setValue('region', 'emea');

    // Re-fetched because the URL interpolates an answer that changed.
    await vi.waitFor(() => {
      expect(requested).toContain('https://example.test/emea/countries');
    });
  });

  test('a placeholder value is URL-encoded', async () => {
    const requested: string[] = [];
    const survey = build(restDefinition('https://example.test/{region}'), (url) => {
      requested.push(url);
      return Promise.resolve({ data: { items: [] } });
    });

    survey.setValue('region', 'a b&c');

    await vi.waitFor(() => {
      expect(requested).toContain('https://example.test/a%20b%26c');
    });
  });

  test('a repeated URL is served from cache without fetching again', async () => {
    let calls = 0;
    // Each URL answers with itself, so a test can tell *which* response landed rather
    // than only that some response did.
    const survey = build(restDefinition('https://example.test/{region}/countries'), (url) => {
      calls += 1;
      return Promise.resolve({ data: { items: [{ id: url, label: url }] } });
    });

    survey.setValue('region', 'emea');
    await vi.waitFor(() => {
      expect(choiceValues(survey, 'country')).toEqual(['https://example.test/emea/countries']);
    });
    const afterEmea = calls;

    survey.setValue('region', 'apac');
    await vi.waitFor(() => {
      expect(choiceValues(survey, 'country')).toEqual(['https://example.test/apac/countries']);
    });
    expect(calls).toBe(afterEmea + 1);

    // Going back reuses the cached response, and does so within the settle: no await.
    survey.setValue('region', 'emea');
    expect(choiceValues(survey, 'country')).toEqual(['https://example.test/emea/countries']);
    expect(calls).toBe(afterEmea + 1);
  });

  test('a slower obsolete request cannot replace choices from the latest URL', async () => {
    const responses = new Map<string, (payload: unknown) => void>();
    const settled = new Set<string>();
    const survey = build(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'region' },
              { type: 'dropdown', name: 'country', choicesByUrl: '{region}' },
            ],
          },
        ],
      },
      (url) => {
        const response = new Promise<unknown>((resolve) => {
          responses.set(url, resolve);
        });
        return response.then((payload) => {
          settled.add(url);
          return payload;
        });
      },
    );

    survey.setValue('region', 'request-a');
    survey.setValue('region', 'request-b');

    responses.get('request-b')?.(['newest']);
    await vi.waitFor(() => {
      expect(choiceValues(survey, 'country')).toEqual(['newest']);
    });

    responses.get('request-a')?.(['obsolete']);
    await vi.waitFor(() => {
      expect(settled).toContain('request-a');
    });
    expect(choiceValues(survey, 'country')).toEqual(['newest']);
  });

  test('a response cannot install itself after its URL source is removed', async () => {
    let resolveResponse: ((payload: unknown) => void) | undefined;
    let responseSettled = false;
    const survey = build(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              {
                type: 'dropdown',
                name: 'country',
                choices: ['authored'],
                choicesByUrl: 'request',
              },
            ],
          },
        ],
      },
      () => {
        const response = new Promise<unknown>((resolve) => {
          resolveResponse = resolve;
        });
        return response.then((payload) => {
          responseSettled = true;
          return payload;
        });
      },
    );

    select(survey, 'country').setPropertyValue('choicesByUrl', '');
    survey.refreshLogic();
    if (resolveResponse === undefined) {
      throw new TypeError('expected the URL source to start a request');
    }
    resolveResponse(['obsolete']);
    await vi.waitFor(() => {
      expect(responseSettled).toBe(true);
    });

    expect(choiceValues(survey, 'country')).toEqual(['authored']);
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

    await vi.waitFor(() => {
      expect(survey.choiceErrors.join(' ')).toMatch(/network down/u);
    });
    expect(choiceValues(survey, 'q')).toEqual(['fallback']);
  });

  test('a response that is not an array at the path is reported', async () => {
    const survey = build(restDefinition('https://example.test/x'), () =>
      Promise.resolve({ data: { items: 'not an array' } }),
    );

    await vi.waitFor(() => {
      expect(survey.choiceErrors.join(' ')).toMatch(/did not return an array/u);
    });
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

    // Waiting for the load matters: serializing before it arrives would prove nothing.
    await vi.waitFor(() => {
      expect(choiceValues(survey, 'country')).toEqual(['uk', 'fr']);
    });

    const serialized = JSON.stringify(serializeSurvey(survey, registry));
    expect(serialized).toContain('"choicesByUrl":"https://example.test/c"');
    expect(serialized).not.toContain('United Kingdom');
  });
});
