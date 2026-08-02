import { ExpressionQuestion, HtmlElement, ImageElement, parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(
  elements: readonly Readonly<Record<string, unknown>>[],
  extra: Readonly<Record<string, unknown>> = {},
): Survey {
  return parseSurvey({ ...extra, pages: [{ name: 'p1', elements }] }, createTestRegistry())
    .survey;
}

function expressionQuestion(survey: Survey, name = 'total'): ExpressionQuestion {
  const question = survey.getQuestionByName(name);
  if (!(question instanceof ExpressionQuestion)) {
    throw new TypeError('expected an expression question');
  }
  return question;
}

describe('parity/C12-display-elements', () => {
  test('html and image hold no answer and are not questions', () => {
    const survey = build([
      { type: 'html', name: 'intro', html: '<p>Welcome</p>' },
      { type: 'image', name: 'logo', imageLink: 'https://example.com/logo.png' },
      { type: 'text', name: 'q' },
    ]);

    // Not by a check that remembers to skip them — they were never in the set.
    expect(survey.questions.map((question) => question.name)).toEqual(['q']);
    expect(survey.data).toEqual({});
  });

  test('a display element cannot be required, because the property does not exist on it', () => {
    const survey = build([{ type: 'html', name: 'intro', html: '<p>Hi</p>', isRequired: true }]);
    const [diagnostic] = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ type: 'html', name: 'i', isRequired: true }] }] },
      createTestRegistry(),
    ).diagnostics;

    // `isRequired` lives on `question`, and `html` is not one. The property survives
    // the round trip as an unknown, which is ADR-0002's rule, but nothing acts on it.
    expect(diagnostic?.code).toBe('unknown-property');
    expect(survey.validation.validateCurrentPage()).toBe(true);
  });

  test('display elements take part in conditional logic like anything else on a page', () => {
    const survey = build([
      { type: 'text', name: 'trigger' },
      { type: 'html', name: 'intro', html: '<p>Hi</p>', visibleIf: '{trigger} notempty' },
    ]);
    const intro = survey.pages[0]?.elements.find((element) => element.name === 'intro');

    expect(intro?.isVisible).toBe(false);
    survey.setValue('trigger', 'x');
    expect(intro?.isVisible).toBe(true);
  });

  test('an image describes itself, or says nothing at all', () => {
    const survey = build([
      { type: 'image', name: 'logo', imageLink: 'a.png', altText: 'Our logo' },
      { type: 'image', name: 'banner', imageLink: 'b.png', title: 'A banner' },
      { type: 'image', name: 'spacer', imageLink: 'c.png' },
    ]);
    const alt = (name: string): string => {
      const element = survey.pages[0]?.elements.find((candidate) => candidate.name === name);
      return element instanceof ImageElement ? element.altText : 'not an image';
    };

    expect(alt('logo')).toBe('Our logo');
    expect(alt('banner')).toBe('A banner');
    // Empty, not the element name: an undescribed image is decorative and should be
    // skipped, while one announced as "spacer" is noise read aloud.
    expect(alt('spacer')).toBe('');
  });

  test('markup is carried verbatim; what to do about it is the renderer’s decision', () => {
    const survey = build([{ type: 'html', name: 'intro', html: '<p onclick="x()">Hi</p>' }]);
    const intro = survey.pages[0]?.elements[0];
    expect(intro instanceof HtmlElement && intro.html).toBe('<p onclick="x()">Hi</p>');
  });
});

describe('parity/C12-expression-question', () => {
  test('the value is computed and reaches data like any other answer', () => {
    const survey = build([
      { type: 'text', name: 'price', inputType: 'number' },
      { type: 'text', name: 'quantity', inputType: 'number' },
      { type: 'expression', name: 'total', expression: '{price} * {quantity}' },
    ]);
    survey.setValue('price', 10);
    survey.setValue('quantity', 3);

    expect(survey.data['total']).toBe(30);
  });

  test('it is recomputed rather than yielding to whatever was written over it', () => {
    const survey = build([
      { type: 'text', name: 'price', inputType: 'number' },
      { type: 'expression', name: 'total', expression: '{price} * 2' },
    ]);
    survey.setValue('price', 10);
    // A `defaultValueExpression` would stop here, because a respondent has "typed over"
    // it. An expression question has nothing to type over.
    survey.setValue('total', 999);
    survey.setValue('price', 20);

    expect(survey.data['total']).toBe(40);
  });

  test('a malformed expression writes nothing rather than a wrong answer', () => {
    const survey = build([{ type: 'expression', name: 'total', expression: '{price} * (((' }]);
    expect(survey.data['total']).toBeUndefined();
  });

  test('displayStyle formats the result without changing it', () => {
    const survey = build([
      { type: 'text', name: 'price', inputType: 'number' },
      {
        type: 'expression',
        name: 'total',
        expression: '{price} * 2',
        displayStyle: 'currency',
        currency: 'EUR',
      },
    ]);
    survey.setValue('price', 20);

    // The stored value stays a number — an expression reading it must not have to
    // parse a currency symbol back out.
    expect(survey.data['total']).toBe(40);
    expect(expressionQuestion(survey).displayValue).toBe('€40.00');
  });

  test('format wraps the result, and composes with the style', () => {
    const survey = build([
      { type: 'text', name: 'price', inputType: 'number' },
      {
        type: 'expression',
        name: 'total',
        expression: '{price}',
        displayStyle: 'percent',
        format: 'You scored {0}',
      },
    ]);
    survey.setValue('price', 0.75);
    expect(expressionQuestion(survey).displayValue).toBe('You scored 75%');
  });

  test('an unanswered expression shows nothing rather than "undefined"', () => {
    const survey = build([{ type: 'expression', name: 'total', expression: '{missing}' }]);
    expect(expressionQuestion(survey).displayValue).toBe('');
  });

  test('a date is written as an ISO day, not a locale date', () => {
    const survey = build([
      { type: 'text', name: 'start', inputType: 'date' },
      {
        type: 'expression',
        name: 'total',
        expression: '{start}',
        displayStyle: 'date',
      },
    ]);
    survey.setValue('start', '2026-06-15');
    // `toLocaleDateString` would drag both a locale and a timezone into the output, and
    // a computed date that reads differently abroad is a bug nobody can reproduce.
    expect(expressionQuestion(survey).displayValue).toBe('2026-06-15');
  });
});
