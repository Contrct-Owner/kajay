import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { ParseResult } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/**
 * A survey whose only page is conditioned on a host value, alongside an ordinary
 * question so the two scopes can be told apart.
 */
function build(options: Readonly<Record<string, unknown>> = {}): ParseResult {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'tier' },
            { type: 'text', name: 'upgrade', visibleIf: '{$tier} = "gold"' },
          ],
        },
      ],
    },
    createTestRegistry(),
    options,
  );
}

describe('parity/B12-host-value-scope', () => {
  test('an expression reads a value the host supplied', () => {
    const { survey } = build({ values: { tier: 'gold' } });

    expect(survey.getQuestionByName('upgrade')?.isVisible).toBe(true);
  });

  test('a structured value is descended into, like any other object', () => {
    const { survey } = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'q', visibleIf: '{$profile.plan.tier} = "gold"' },
            ],
          },
        ],
      },
      createTestRegistry(),
      { values: { profile: { plan: { tier: 'gold' }, seats: 40 } } },
    );

    // Descent is `createPathResolver`'s, not the scope's: a host value holding an object
    // gets exactly the treatment an answer holding one already got.
    expect(survey.getQuestionByName('q')?.isVisible).toBe(true);
  });

  test('the two scopes are separate: an answer never shadows a host value', () => {
    const { survey } = build({ values: { tier: 'gold' } });
    survey.setValue('tier', 'bronze');

    // `{$tier}` is still the host's. A question of the same name is a different name.
    expect(survey.getQuestionByName('upgrade')?.isVisible).toBe(true);
  });

  test('and a host value never answers for a question', () => {
    const { survey } = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [
              { type: 'text', name: 'tier' },
              { type: 'text', name: 'q', visibleIf: '{tier} = "gold"' },
            ],
          },
        ],
      },
      createTestRegistry(),
      { values: { tier: 'gold' } },
    );

    // The sigil is tested first, so the unsigiled reference cannot reach the host scope.
    expect(survey.getQuestionByName('q')?.isVisible).toBe(false);
  });

  test('a host value is not in the response', () => {
    const { survey } = build({ values: { tier: 'gold' } });
    survey.setValue('tier', 'bronze');

    // Structurally, not by a filter on the way out: it was never in the answer store, so
    // there is nothing for `data` or a snapshot to exclude.
    expect(survey.data).toEqual({ tier: 'bronze' });
    expect(survey.progress.data).toEqual({ tier: 'bronze' });
    // Keys rather than values: the snapshot carries each answer in its typed envelope
    // (ADR-0034), and what this test is about is which names are there at all.
    expect(Object.keys(survey.createSnapshot().data)).toEqual(['tier']);
  });

  test('a name the host did not supply is a warning, not an error', () => {
    const { diagnostics } = build();

    // Warning, where an undeclared endpoint is an error: an endpoint absent at parse
    // dooms the fetch, but a host value may legitimately be supplied later.
    expect(diagnostics).toEqual([
      {
        severity: 'warning',
        code: 'undeclared-host-value',
        message:
          '"visibleIf" on "text" reads "$tier", which no host value supplies. Pass it ' +
          'as the values option, or set it before the expression is evaluated.',
        path: '/pages/0/elements/1/visibleIf',
      },
    ]);
  });

  test('and it reads as unanswered rather than as an empty string', () => {
    const { survey } = build();

    // `undefined` is what every operator already treats as an unanswered question, so
    // an absent host value needs no third state — and the condition simply does not hold.
    expect(survey.getQuestionByName('upgrade')?.isVisible).toBe(false);
  });

  test('a value the host deliberately left undefined is not nagged about', () => {
    const { diagnostics } = build({ values: { tier: undefined } });

    // Declared and absent is a different thing from never mentioned, and a diagnostic
    // that could not tell them apart would nag about a deliberate choice.
    expect(diagnostics).toEqual([]);
  });

  test('a reference inside a string literal is not a reference', () => {
    const { diagnostics } = parseSurvey(
      {
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'q', visibleIf: '"{$tier}" = "x"' }] },
        ],
      },
      createTestRegistry(),
      {},
    );

    // Read from the AST rather than by scanning text, which is the whole reason to pay
    // for a parse here.
    expect(diagnostics).toEqual([]);
  });

  test('an element named into the scope is an error', () => {
    const { diagnostics } = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ type: 'text', name: '$tier' }] }] },
      createTestRegistry(),
      {},
    );

    // Error, not warning: resolution tests the sigil first, so this question is
    // unreachable from every expression in the survey rather than merely confusing.
    expect(diagnostics).toEqual([
      {
        severity: 'error',
        code: 'reserved-name-sigil',
        message:
          '"text" is named "$tier", but "$" is reserved for the host-value scope. ' +
          'Expressions cannot reach an element with this name; rename it.',
        path: '/pages/0/elements/0/name',
      },
    ]);
  });

  test('and the offending name is kept rather than rewritten', () => {
    const { survey } = parseSurvey(
      { pages: [{ name: 'p1', elements: [{ type: 'text', name: '$tier' }] }] },
      createTestRegistry(),
      {},
    );

    // A parser that quietly renamed an element would break every response already
    // recorded against it, and the round trip is a fixed point by ADR-0002.
    expect(survey.getQuestionByName('$tier')?.name).toBe('$tier');
  });

  test('the template round-trips; the value the host supplied never does', () => {
    const { survey } = build({ values: { tier: 'gold' } });
    const serialized = serializeSurvey(survey) as { pages: { elements: { visibleIf?: string }[] }[] };

    // What was authored, not what it resolved to — or a definition promoted to another
    // environment would carry this one's host context with it.
    expect(serialized.pages[0]?.elements[1]?.visibleIf).toBe('{$tier} = "gold"');
    expect(JSON.stringify(serialized)).not.toContain('gold"}');
  });

  test('a completed page reads the host scope, not just the answers', () => {
    const { survey } = parseSurvey(
      {
        completedHtml: 'Thank you, {$tier} customer on the {plan} plan.',
        pages: [{ name: 'p1', elements: [{ type: 'text', name: 'plan' }] }],
      },
      createTestRegistry(),
      { values: { tier: 'gold' } },
    );
    survey.setValue('plan', 'pro');
    survey.complete();

    // A scope that worked in conditions and rendered blank in prose would be the harder
    // half of the feature to trust.
    expect(survey.status.completedHtml).toBe('Thank you, gold customer on the pro plan.');
  });

  test('a host reference in a template descends, like it does in an expression', () => {
    const { survey } = parseSurvey(
      { completedHtml: 'Plan: {$profile.plan.tier}', pages: [{ name: 'p1', elements: [] }] },
      createTestRegistry(),
      { values: { profile: { plan: { tier: 'gold' } } } },
    );
    survey.complete();

    // Parsed by `parseReferencePath`, the same reader an expression goes through, so the
    // syntax cannot come to mean two things.
    expect(survey.status.completedHtml).toBe('Plan: gold');
  });

  test('and what it resolves to is escaped, because the value is not the author’s', () => {
    const { survey } = parseSurvey(
      { completedHtml: '<p>{$note}</p>', pages: [{ name: 'p1', elements: [] }] },
      createTestRegistry(),
      { values: { note: '<img src=x onerror=alert(1)>' } },
    );
    survey.complete();

    // The template is the author's markup; a value dropped into it is not, whoever
    // supplied it — a host value is often derived from respondent data.
    expect(survey.status.completedHtml).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    );
  });

  test('the loading and empty pages read it too', () => {
    const { survey } = parseSurvey(
      {
        loadingHtml: 'Loading for {$tier}',
        emptyHtml: 'Nothing for {$tier}',
        pages: [],
      },
      createTestRegistry(),
      { values: { tier: 'gold' } },
    );

    // One resolver behind all three, so none of them can drift from the others.
    expect(survey.status.emptyHtml).toBe('Nothing for gold');
    survey.status.setLoading(true);
    expect(survey.status.loadingHtml).toBe('Loading for gold');
  });

  test('a conditional ending reads it as well as the default one', () => {
    const { survey } = parseSurvey(
      {
        completedHtml: 'Default for {$tier}',
        completedHtmlOnCondition: [{ expression: '{$tier} = "gold"', html: 'Premium: {$tier}' }],
        pages: [{ name: 'p1', elements: [] }],
      },
      createTestRegistry(),
      { values: { tier: 'gold' } },
    );
    survey.complete();

    // The ending is chosen by an expression reading the scope and then filled from it,
    // so both halves of a conditional ending see the same values.
    expect(survey.status.completedHtml).toBe('Premium: gold');
  });

  test('an answer placeholder is still looked up by flat name', () => {
    const { survey } = parseSurvey(
      { completedHtml: 'Value: {a.b}', pages: [{ name: 'p1', elements: [] }] },
      createTestRegistry(),
      {},
    );
    survey.setValue('a.b', 'kept');
    survey.complete();

    // Deliberately untouched: an answer written under a key containing a dot would
    // start resolving to nothing the day templates began splitting them, and the answer
    // scope has that history to protect where the host scope does not.
    expect(survey.status.completedHtml).toBe('Value: kept');
  });

  test('every expression property is covered, because the registry says which they are', () => {
    const { survey, diagnostics } = parseSurvey(
      {
        pages: [
          {
            name: 'p1',
            elements: [{ type: 'text', name: 'q', defaultValueExpression: '{$seats}' }],
          },
        ],
        calculatedValues: [{ name: 'doubled', expression: '{$seats} * 2' }],
      },
      createTestRegistry(),
      { values: { seats: 40 } },
    );

    // `isExpression` is the registry's answer, so a property declared later is covered
    // by declaring itself rather than by being remembered in the diagnostics walk.
    expect(diagnostics).toEqual([]);
    expect(survey.getValue('q')).toBe(40);
    expect(survey.evaluate('{doubled}').value).toBe(80);
  });
});
