import { parseSurvey } from '@kajay/core';
import type { Diagnostic, SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function diagnose(
  template: unknown,
  blanks: readonly Record<string, unknown>[],
): readonly Diagnostic[] {
  const definition = {
    pages: [
      { name: 'p1', elements: [{ type: 'fillintheblank', name: 'geography', template, blanks }] },
    ],
  } as unknown as SurveyDefinition;
  return parseSurvey(definition, createTestRegistry(), {}).diagnostics;
}

const CODES = (diagnostics: readonly Diagnostic[]): readonly string[] =>
  diagnostics.map((diagnostic) => diagnostic.code);

describe('parity/C13-diagnostics', () => {
  test('a well-formed sentence reports nothing', () => {
    expect(diagnose('The capital is [[capital]].', [{ type: 'text', name: 'capital' }])).toEqual([]);
  });

  test('a blank nobody declared is an error', () => {
    const [reported] = diagnose('The capital is [[capital]].', []);

    // Error rather than warning: there is nothing to draw, so the renderer skips it and
    // the respondent silently loses a question the author thought they asked.
    expect(reported).toEqual({
      severity: 'error',
      code: 'undeclared-blank',
      message:
        '"geography" positions a blank named "capital", which its blanks do not declare. '
        + 'Add it, or remove the marker.',
      path: '/geography',
    });
  });

  test('a declared blank the sentence never positions is a warning', () => {
    const [reported] = diagnose('Only [[capital]].', [{ type: 'text', name: 'capital' }, { type: 'text', name: 'currency' }]);

    // A respondent never sees it, so nothing they do is affected — but it is almost
    // always a renamed marker, and saying so costs an author nothing.
    expect(reported?.severity).toBe('warning');
    expect(reported?.code).toBe('unpositioned-blank');
  });

  test('a translation may move a blank, which is the whole point', () => {
    const reported = diagnose(
      {
        default: 'The capital is [[capital]]',
        de: '[[capital]] ist die Hauptstadt',
      },
      [{ type: 'text', name: 'capital' }],
    );

    // Word order moves between languages. Set equality, not sequence equality.
    expect(reported).toEqual([]);
  });

  test('a translation that renames a blank is an error', () => {
    const [reported] = diagnose(
      { default: 'The capital is [[capital]]', fr: 'La capitale est [[capitale]]' },
      [{ type: 'text', name: 'capital' }],
    );

    // The answer keys would depend on the language the respondent happened to read, and
    // a response recorded in French would carry a key no other locale produces.
    expect(reported).toEqual({
      severity: 'error',
      code: 'locale-blank-mismatch',
      message:
        '"geography" names different blanks in "fr" than in its default template. '
        + 'A translation may move a blank but not rename, add or drop one.',
      path: '/geography',
    });
  });

  test('a translation that drops a blank is an error', () => {
    const codes = CODES(
      diagnose({ default: '[[a]] and [[b]]', de: 'nur [[a]]' }, [{ type: 'text', name: 'a' }, { type: 'text', name: 'b' }]),
    );

    expect(codes).toContain('locale-blank-mismatch');
  });

  test('a translation that invents a blank is an error', () => {
    const codes = CODES(
      diagnose({ default: 'just [[a]]', de: '[[a]] und [[b]]' }, [{ type: 'text', name: 'a' }, { type: 'text', name: 'b' }]),
    );

    // Reported even though `b` is declared: the default sentence never asks for it, so a
    // German respondent would answer a question nobody else was asked.
    expect(codes).toContain('locale-blank-mismatch');
  });

  test('the default wording is what the declarations are measured against', () => {
    const codes = CODES(
      diagnose({ default: 'just [[a]]', de: '[[a]] und [[b]]' }, [{ type: 'text', name: 'a' }, { type: 'text', name: 'b' }]),
    );

    // `b` is declared and the default never positions it, so the unpositioned warning
    // stands alongside the mismatch rather than being masked by it.
    expect(codes).toContain('unpositioned-blank');
  });

  test('brackets that name nothing are prose, and report nothing', () => {
    expect(diagnose('see [[1]] and [[bad name]]', [])).toEqual([]);
  });

  test('every fill-in-the-blank in the survey is walked, not just the first', () => {
    const definition = {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'fillintheblank', name: 'first', template: '[[x]]', blanks: [] },
            { type: 'fillintheblank', name: 'second', template: '[[y]]', blanks: [] },
          ],
        },
      ],
    } as unknown as SurveyDefinition;

    const reported = parseSurvey(definition, createTestRegistry(), {}).diagnostics;

    expect(reported.map((diagnostic) => diagnostic.path)).toEqual(['/first', '/second']);
  });
});
