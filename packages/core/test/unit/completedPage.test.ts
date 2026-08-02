import { parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

function oneQuestion(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return build({
    ...extra,
    pages: [{ name: 'p1', elements: [{ type: 'text', name: 'name' }] }],
  });
}

describe('parity/E5-survey-state', () => {
  test('a survey with a page to answer is running', () => {
    expect(oneQuestion().status.state).toBe('running');
  });

  test('completing it is a state, not only a flag', () => {
    const survey = oneQuestion();
    survey.complete();
    expect(survey.status.state).toBe('completed');
  });

  test('a survey with nothing visible says so rather than showing an empty form', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          visibleIf: '{ready} = true',
          elements: [{ type: 'text', name: 'name' }],
        },
      ],
    });
    expect(survey.status.state).toBe('empty');

    survey.setValue('ready', true);
    expect(survey.status.state).toBe('running');
  });

  test('loading is the host telling the survey, because the survey cannot know', () => {
    const survey = oneQuestion();
    survey.status.setLoading(true);
    expect(survey.status.state).toBe('loading');

    survey.status.setLoading(false);
    expect(survey.status.state).toBe('running');
  });

  test('loading outranks everything, because nothing else is settled yet', () => {
    const survey = oneQuestion();
    survey.complete();
    survey.status.setLoading(true);
    // Saving the results, say. Announcing the ending while the host is still working
    // says the survey is done when it may yet fail.
    expect(survey.status.state).toBe('loading');
  });

  test('every transition is announced, and a repeat is not a transition', () => {
    const survey = oneQuestion();
    const seen: string[] = [];
    survey.onStateChanged.add((event) => seen.push(event.state));

    survey.status.setLoading(true);
    survey.status.setLoading(true);
    survey.status.setLoading(false);
    survey.complete();

    expect(seen).toEqual(['loading', 'running', 'completed']);
  });
});

describe('parity/E5-completed-html', () => {
  test('the author decides what the ending says', () => {
    const survey = oneQuestion({ completedHtml: '<p>All done.</p>' });
    expect(survey.status.completedHtml).toBe('<p>All done.</p>');
  });

  test('nothing authored is empty, so the renderer supplies its own words', () => {
    // Not a default sentence in the model: it would serialize into the definition and
    // pin the wording of every survey to English.
    expect(oneQuestion().status.completedHtml).toBe('');
  });

  test('the first condition that holds wins, and the plain markup is the fallback', () => {
    const survey = oneQuestion({
      completedHtml: '<p>Thanks.</p>',
      completedHtmlOnCondition: [
        { expression: '{name} = "Ada"', html: '<p>Thanks, Ada.</p>' },
        { expression: '{name} notempty', html: '<p>Thanks, stranger.</p>' },
      ],
    });
    expect(survey.status.completedHtml).toBe('<p>Thanks.</p>');

    survey.setValue('name', 'Grace');
    expect(survey.status.completedHtml).toBe('<p>Thanks, stranger.</p>');

    // Both hold now. Order decides, which is why this is a list and not a set.
    survey.setValue('name', 'Ada');
    expect(survey.status.completedHtml).toBe('<p>Thanks, Ada.</p>');
  });

  test('a broken condition selects nothing rather than everything', () => {
    const survey = oneQuestion({
      completedHtml: '<p>Thanks.</p>',
      completedHtmlOnCondition: [{ expression: '{name} ===', html: '<p>Never.</p>' }],
    });
    // Showing a respondent the wrong ending is worse than showing them the default one.
    expect(survey.status.completedHtml).toBe('<p>Thanks.</p>');
  });

  test('the authored markup round-trips whatever the conditions currently say', () => {
    const survey = oneQuestion({
      completedHtml: '<p>Thanks.</p>',
      completedHtmlOnCondition: [{ expression: '{name} notempty', html: '<p>Thanks, you.</p>' }],
    });
    survey.setValue('name', 'Ada');
    expect(survey.status.completedHtml).toBe('<p>Thanks, you.</p>');

    // The effective value never leaks into the definition — the same division
    // `isRequired` makes between what was authored and what applies (ADR-0002).
    const definition = serializeSurvey(survey) as Record<string, unknown>;
    expect(definition['completedHtml']).toBe('<p>Thanks.</p>');
    // No `type`: the collection declares one element type, so writing it on every
    // entry would be noise the reader has to skip.
    expect(definition['completedHtmlOnCondition']).toEqual([
      { expression: '{name} notempty', html: '<p>Thanks, you.</p>' },
    ]);
  });
});

describe('parity/B6-calculated-values-in-completed-html', () => {
  test('a placeholder resolves against the answers', () => {
    const survey = oneQuestion({ completedHtml: '<p>Thanks, {name}.</p>' });
    survey.setValue('name', 'Ada');
    expect(survey.status.completedHtml).toBe('<p>Thanks, Ada.</p>');
  });

  test('and against a calculated value, which is the half of B6 that was unprovable', () => {
    const survey = build({
      completedHtml: '<p>You answered {answered} of 2.</p>',
      calculatedValues: [{ name: 'answered', expression: 'count({first}, {second})' }],
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'text', name: 'first' },
            { type: 'text', name: 'second' },
          ],
        },
      ],
    });
    survey.setValue('first', 'yes');

    // Not `includeIntoResult`, so it is not in `data` — and still readable here. What a
    // completed page says is a different question from what gets submitted.
    expect(survey.data['answered']).toBeUndefined();
    expect(survey.status.completedHtml).toBe('<p>You answered 1 of 2.</p>');
  });

  test('an unanswered placeholder disappears rather than printing its own name', () => {
    const survey = oneQuestion({ completedHtml: '<p>Thanks, {name}.</p>' });
    expect(survey.status.completedHtml).toBe('<p>Thanks, .</p>');
  });

  test('a list reads as a list', () => {
    const survey = build({
      completedHtml: '<p>You picked {topics}.</p>',
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'checkbox', name: 'topics', choices: ['ts', 'go'] }],
        },
      ],
    });
    survey.setValue('topics', ['ts', 'go']);
    expect(survey.status.completedHtml).toBe('<p>You picked ts, go.</p>');
  });

  test('an answer is escaped before it lands in markup', () => {
    const survey = oneQuestion({ completedHtml: '<p>Thanks, {name}.</p>' });
    // The template is the author's and is meant to be markup. The value is the
    // respondent's and is never trusted — dropped in raw, this is stored XSS on the
    // completed page of every survey that greets someone by name.
    survey.setValue('name', '<img src=x onerror="alert(1)">');
    expect(survey.status.completedHtml).toBe(
      '<p>Thanks, &lt;img src=x onerror=&quot;alert(1)&quot;&gt;.</p>',
    );
  });

  test('the loading and empty markup take placeholders on the same terms', () => {
    const survey = oneQuestion({
      loadingHtml: '<p>Fetching {name}…</p>',
      emptyHtml: '<p>Nothing for {name} yet.</p>',
    });
    survey.setValue('name', 'Ada');
    expect(survey.status.loadingHtml).toBe('<p>Fetching Ada…</p>');
    expect(survey.status.emptyHtml).toBe('<p>Nothing for Ada yet.</p>');
  });
});
