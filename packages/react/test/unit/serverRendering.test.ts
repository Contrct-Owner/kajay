import { parseSurvey } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { Survey } from '@kajay/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

/**
 * A survey rendered on a server — checklist P1.
 *
 * **A unit test rather than a browser one, and that is not a compromise.** Server rendering
 * is defined by the *absence* of a DOM: `renderToString` builds a string and touches no
 * document, so running it in the browser project would test the one environment where the
 * bug cannot happen. The guidelines ban jsdom because a fake DOM proves nothing about a
 * real one; this is the opposite case, where no DOM is the point.
 *
 * The defect this locks down failed **silently**. React does not warn about a missing
 * server snapshot — it throws, catches, and reverts the whole page to client rendering, so
 * the only visible symptom is a first paint that is empty and a page no crawler can read.
 * Nothing in ninety-four unit files or forty-four browser files could have seen it, because
 * every one of them renders in a browser.
 */
const FEEDBACK: SurveyDefinition = {
  title: 'Customer feedback',
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'email', title: 'Your email address' },
        { type: 'radiogroup', name: 'tier', title: 'Which plan?', choices: ['Free', 'Pro'] },
        { type: 'comment', name: 'notes', title: 'Anything else?' },
      ],
    },
  ],
};

function render(definition: SurveyDefinition, data?: Readonly<Record<string, unknown>>): string {
  const { survey } = parseSurvey(definition);
  if (data !== undefined) {
    survey.setData(data);
  }
  return renderToString(createElement(Survey, { model: survey }));
}

describe('parity/P1-server-rendering', () => {
  test('a survey renders to markup with no DOM at all', () => {
    const html = render(FEEDBACK);

    // The whole claim in three assertions: the questions are *in the response*, so the
    // first paint is the survey rather than an empty div, and a crawler reading the page
    // without running scripts sees the form.
    expect(html).toContain('Your email address');
    expect(html).toContain('Which plan?');
    expect(html).toContain('<input');
  });

  test('every choice is in the server response, not filled in by the client', () => {
    const html = render(FEEDBACK);

    // A choice list is generated from the model, so it is the part most likely to be
    // deferred to the client by accident.
    expect(html).toContain('Free');
    expect(html).toContain('Pro');
  });

  test('answers the host already has are rendered, not left blank', () => {
    const html = render(FEEDBACK, { email: 'someone@example.com' });

    // Save-and-resume (E6) is the common case for a server-rendered survey: the host has
    // the response already and the first paint should show it. A server snapshot that
    // returned a placeholder rather than the real value would pass the test above and
    // fail this one.
    expect(html).toContain('someone@example.com');
  });

  test('a completed survey renders its completed page on the server', () => {
    const { survey } = parseSurvey(FEEDBACK);
    survey.complete();

    const html = renderToString(createElement(Survey, { model: survey }));

    // `useSurveyStatus` is the hook that threw first, and status is the one piece of state
    // where a wrong server answer draws an entirely different page rather than a wrong
    // value inside the right one.
    expect(html).toContain('kajay-survey--completed');
  });

  test('a survey with no pages renders its empty state rather than throwing', () => {
    expect(() => renderToString(createElement(Survey, { model: parseSurvey({}).survey }))).not.toThrow();
  });
});
