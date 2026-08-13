import { createDefaultFunctionRegistry, parseSurvey } from '@kajay/core';
import type { FunctionRegistry, Survey } from '@kajay/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * A host lookup whose answer the test controls, and which records every real call.
 *
 * It returns early for an argument it cannot use, which is what B2 tells hosts to do:
 * every asynchronous function is called once at startup with whatever its arguments are
 * then, and a lookup that costs something should not pay for that call.
 */
function quoting(asked: string[], answer: () => Promise<unknown>): FunctionRegistry {
  const functions = createDefaultFunctionRegistry();
  functions.registerAsync('quote', (args) => {
    const sku = String(args[0] ?? '');
    if (sku.length === 0) {
      return Promise.resolve();
    }
    asked.push(sku);
    return answer();
  });
  return functions;
}

function build(functions: FunctionRegistry): Survey {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'sku' },
            { type: 'text', name: 'offer', visibleIf: 'quote({sku}) > 100' },
          ],
        },
      ],
    },
    createTestRegistry(),
    { functions },
  ).survey;
}

function isVisible(survey: Survey, name: string): boolean {
  return survey.getQuestionByName(name)?.isVisible ?? false;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('parity/B12-async-invalidation', () => {
  test('a cached result is asked for again after invalidation', async () => {
    const asked: string[] = [];
    let price = 50;
    const survey = build(quoting(asked, () => Promise.resolve(price)));
    survey.setValue('sku', 'widget');
    await vi.waitFor(() => {
      expect(asked).toEqual(['widget']);
    });
    expect(isVisible(survey, 'offer')).toBe(false);

    price = 500;
    survey.invalidateAsyncResults();
    await vi.waitFor(() => {
      expect(isVisible(survey, 'offer')).toBe(true);
    });

    // The cache is permanent by design, which is right until the world its answers
    // describe moves. Without this there is no way to say it has.
    expect(asked).toEqual(['widget', 'widget']);
  });

  test('a failure is retried, which nothing else could make happen', async () => {
    const asked: string[] = [];
    let failing = true;
    const survey = build(
      quoting(asked, () => (failing ? Promise.reject(new Error('down')) : Promise.resolve(500))),
    );
    survey.setValue('sku', 'widget');
    await vi.waitFor(() => {
      expect(asked).toHaveLength(1);
    });
    expect(isVisible(survey, 'offer')).toBe(false);

    failing = false;
    survey.invalidateAsyncResults();
    await vi.waitFor(() => {
      expect(isVisible(survey, 'offer')).toBe(true);
    });

    // A rejection is recorded and never retried, so a lookup that failed once stays
    // failed for the life of the survey. This is the only way back.
    expect(asked).toEqual(['widget', 'widget']);
  });

  test('nothing is asked again while the answer has not moved', async () => {
    const asked: string[] = [];
    const survey = build(quoting(asked, () => Promise.resolve(50)));
    survey.setValue('sku', 'widget');
    await vi.waitFor(() => {
      expect(asked).toHaveLength(1);
    });

    survey.setValue('sku', 'widget');
    await vi.advanceTimersByTimeAsync(0);

    // The cache still does its real job: without it each re-evaluation restarts the
    // call and each call triggers another re-evaluation.
    expect(asked).toEqual(['widget']);
  });

  test('naming a function discards only that function', async () => {
    const asked: string[] = [];
    const functions = quoting(asked, () => Promise.resolve(50));
    const stockAsked: string[] = [];
    functions.registerAsync('stock', (args) => {
      const sku = String(args[0] ?? '');
      if (sku.length === 0) {
        return Promise.resolve();
      }
      stockAsked.push(sku);
      return Promise.resolve(1);
    });
    const survey = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'sku' },
              { type: 'text', name: 'a', visibleIf: 'quote({sku}) > 100' },
              { type: 'text', name: 'b', visibleIf: 'stock({sku}) > 0' },
            ],
          },
        ],
      },
      createTestRegistry(),
      { functions },
    ).survey;
    survey.setValue('sku', 'widget');
    await vi.waitFor(() => {
      expect(asked).toHaveLength(1);
      expect(stockAsked).toHaveLength(1);
    });

    survey.invalidateAsyncResults('quote');
    await vi.waitFor(() => {
      expect(asked).toHaveLength(2);
    });

    // A host that knows its quote service moved should not have to discard an
    // eligibility check that did not.
    expect(asked).toEqual(['widget', 'widget']);
    expect(stockAsked).toEqual(['widget']);
  });

  test('a reply already in flight cannot install itself after an invalidation', async () => {
    const asked: string[] = [];
    let release!: (value: unknown) => void;
    const first = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    let answer = (): Promise<unknown> => first;
    const survey = build(quoting(asked, () => answer()));
    survey.setValue('sku', 'widget');
    await vi.waitFor(() => {
      expect(asked).toHaveLength(1);
    });

    // The world moves while the first request is still outstanding.
    answer = () => Promise.resolve(500);
    survey.invalidateAsyncResults();
    await vi.waitFor(() => {
      expect(asked).toHaveLength(2);
    });
    // ...and only now does the superseded request answer, with the stale price.
    release(50);
    await vi.advanceTimersByTimeAsync(0);

    // It answers a question nobody is asking any more. Installing it would leave the
    // survey showing the value the host invalidated, with nothing left to correct it.
    expect(isVisible(survey, 'offer')).toBe(true);
  });
});
