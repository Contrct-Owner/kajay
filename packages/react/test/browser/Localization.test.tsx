/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Localization in the DOM — checklist J1 and J2.
 *
 * The model's resolution is proved in the unit suite. What is left is the half only a
 * renderer can be wrong about: that a switch re-renders everything at once, and that
 * the library's own words go through the dictionary rather than being written into JSX.
 */
function build(): SurveyModel {
  return parseSurvey({
    locale: 'en',
    title: { default: 'Feedback', fr: 'Commentaires' },
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'who', title: { default: 'Your name', fr: 'Votre nom' } },
        ],
      },
      { name: 'p2', elements: [{ type: 'text', name: 'more', title: 'More' }] },
    ],
  }).survey;
}

test('parity/J1-locale-switch: a switch re-renders every string at once', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);

  await expect.element(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
  await expect.element(screen.getByLabelText('Your name')).toBeInTheDocument();

  survey.setLocale('fr');

  // The title, the question label and the button all move together — one subscription
  // at the survey root, because a locale switch changes every string there is.
  await expect.element(screen.getByRole('heading', { name: 'Commentaires' })).toBeInTheDocument();
  await expect.element(screen.getByLabelText('Votre nom')).toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument();
});

test('parity/J2-ui-strings: the library speaks the survey language', async () => {
  const survey = build();
  survey.setLocale('de');
  const screen = await render(<Survey model={survey} />);

  await expect.element(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
});

test('parity/J2-ui-strings: a host may reword one string and keep the rest', async () => {
  const survey = build();
  survey.strings.register('en', { nextPage: 'Onwards' });
  const screen = await render(<Survey model={survey} />);

  await expect.element(screen.getByRole('button', { name: 'Onwards' })).toBeInTheDocument();
  // Registering merges; the fifty strings the host did not mention are untouched.
  await expect.element(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
});

test('parity/J2-ui-strings: a validation message arrives in the same language', async () => {
  const survey = parseSurvey({
    locale: 'fr',
    pages: [
      {
        name: 'p1',
        elements: [{ type: 'text', name: 'who', title: 'Nom', isRequired: true }],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={survey} />);

  await screen.getByRole('button', { name: 'Terminer' }).click();

  await expect
    .element(screen.getByText('Cette question exige une réponse.'))
    .toBeInTheDocument();
});

test('parity/J3-rtl: an Arabic survey reads right to left', async () => {
  const survey = parseSurvey({
    locale: 'ar',
    pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'الاسم' }] }],
  }).survey;
  const screen = await render(<Survey model={survey} />);

  // A `dir` attribute and nothing else: the browser mirrors the layout, reorders
  // bidirectional text and flips the logical CSS properties the stylesheet uses.
  const scope = screen.container.querySelector('.kajay-theme');
  expect(scope).toHaveAttribute('dir', 'rtl');
  // And the input inherits it, which is what makes typing Arabic behave.
  expect(getComputedStyle(screen.getByLabelText('الاسم').element()).direction).toBe('rtl');
});

test('parity/J3-rtl: switching language switches direction with it', async () => {
  const survey = build();
  const screen = await render(<Survey model={survey} />);
  expect(screen.container.querySelector('.kajay-theme')).toHaveAttribute('dir', 'ltr');

  survey.setLocale('he');

  // Polled on the scope element rather than on any one string: `dir` is what changes,
  // and it lives on the wrapper the whole survey inherits from.
  await expect
    .poll(() => screen.container.querySelector('.kajay-theme')?.getAttribute('dir'))
    .toBe('rtl');
});

test('parity/J3-rtl: two surveys on a page may read different ways', async () => {
  const rtl = parseSurvey({
    locale: 'he',
    pages: [{ name: 'p1', elements: [{ type: 'text', name: 'a', title: 'A' }] }],
  }).survey;
  const screen = await render(
    <>
      <Survey model={build()} />
      <Survey model={rtl} />
    </>,
  );

  // Scoped to the survey rather than set on the document: the page around it is the
  // host's, and a survey embedded in an English page may still be in Hebrew.
  const scopes = screen.container.querySelectorAll('.kajay-theme');
  expect(scopes[0]).toHaveAttribute('dir', 'ltr');
  expect(scopes[1]).toHaveAttribute('dir', 'rtl');
});
