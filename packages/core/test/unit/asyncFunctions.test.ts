import { createDefaultFunctionRegistry, parseSurvey } from '@kajay/core';
import type { FunctionRegistry, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * A host's own lookup, registered exactly as a host would register one.
 *
 * It records what it was asked, so a test can prove the cache does its job — which is
 * not an optimisation here but the thing that stops re-evaluation calling for ever.
 */
function servedPostcodes(asked: string[]): FunctionRegistry {
  const functions = createDefaultFunctionRegistry();
  functions.registerAsync('isserved', async (args) => {
    const postcode = String(args[0] ?? '');
    asked.push(postcode);
    await Promise.resolve();
    return postcode.startsWith('SW');
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
            { type: 'text', name: 'postcode' },
            { type: 'text', name: 'delivery', visibleIf: 'isServed({postcode})' },
          ],
        },
      ],
    },
    createTestRegistry(),
    { functions },
  ).survey;
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('parity/B2-async-functions', () => {
  test('an answer that arrives later still drives the logic', async () => {
    const asked: string[] = [];
    const survey = build(servedPostcodes(asked));
    survey.setValue('postcode', 'SW1');

    // Nothing yet: the evaluator cannot await inside a dependency transaction, so the
    // first pass sees an unanswered question and the rule re-runs when it is answered.
    expect(survey.getQuestionByName('delivery')?.isVisible).toBe(false);

    await flush();
    expect(survey.getQuestionByName('delivery')?.isVisible).toBe(true);
  });

  test('the same question is asked once, however often it is evaluated', async () => {
    const asked: string[] = [];
    const survey = build(servedPostcodes(asked));
    survey.setValue('postcode', 'SW1');
    await flush();
    // Anything that re-runs the rules: the re-evaluation the answer itself triggered
    // has already happened by now.
    survey.setValue('postcode', 'SW1');
    await flush();

    // Two argument sets, two calls, and no more. Without the cache this is where it
    // loops: every re-evaluation would start the call again, and every call would
    // trigger another re-evaluation.
    //
    // The empty one is the survey's first evaluation, before anybody answered. Every
    // asynchronous function is asked once at startup with whatever its arguments are
    // then, which is worth a host knowing: a lookup that costs something should return
    // early for an argument it cannot use.
    expect(asked).toEqual(['', 'SW1']);
  });

  test('different arguments are different questions', async () => {
    const asked: string[] = [];
    const survey = build(servedPostcodes(asked));
    survey.setValue('postcode', 'SW1');
    await flush();
    survey.setValue('postcode', 'EH1');
    await flush();

    expect(asked).toEqual(['', 'SW1', 'EH1']);
    expect(survey.getQuestionByName('delivery')?.isVisible).toBe(false);
  });

  test('a lookup that throws is reported against the rule that made it', async () => {
    const functions = createDefaultFunctionRegistry();
    functions.registerAsync('isserved', () => Promise.reject(new Error('lookup exploded')));
    const survey = build(functions);
    survey.setValue('postcode', 'SW1');
    await flush();

    const errors = survey.logicDiagnostics.expressionErrors;
    expect(errors.map((error) => error.code)).toContain('function-failed');
    expect(errors[0]?.message).toContain('lookup exploded');
    // `visibleIf` fails open, so a broken rule the respondent cannot fix does not hide
    // a question from them.
    expect(survey.getQuestionByName('delivery')?.isVisible).toBe(true);
  });

  test('a failed lookup is not retried on every evaluation', async () => {
    const asked: string[] = [];
    const functions = createDefaultFunctionRegistry();
    functions.registerAsync('isserved', (args) => {
      asked.push(String(args[0] ?? ''));
      return Promise.reject(new Error('lookup exploded'));
    });
    const survey = build(functions);
    survey.setValue('postcode', 'SW1');
    await flush();
    survey.setValue('postcode', 'SW1');
    await flush();

    // Asked once per argument set and not again. A failure is an answer too, as far as
    // not asking goes — otherwise a broken endpoint becomes a request storm, and every
    // re-evaluation would start another one.
    expect(asked).toEqual(['', 'SW1']);
  });

  test('one namespace: a name cannot be both, in either order', () => {
    // An expression writes `isServed(...)` either way, so one name meaning two things
    // depending on which was registered first is a bug waiting for whichever the
    // evaluator happens to check first.
    const asyncFirst = createDefaultFunctionRegistry();
    asyncFirst.registerAsync('isserved', () => Promise.resolve(true));
    expect(() => {
      asyncFirst.register('isServed', () => true);
    }).toThrow(/already registered/u);

    const syncFirst = createDefaultFunctionRegistry();
    syncFirst.register('isserved', () => true);
    expect(() => {
      syncFirst.registerAsync('isServed', () => Promise.resolve(true));
    }).toThrow(/already registered/u);

    expect(asyncFirst.has('ISSERVED')).toBe(true);
    expect(asyncFirst.getNames()).toContain('isserved');
  });

  test('a clone carries the asynchronous registrations too', () => {
    const functions = createDefaultFunctionRegistry();
    functions.registerAsync('isserved', () => Promise.resolve(true));
    expect(functions.clone().isAsync('isserved')).toBe(true);
  });
});
