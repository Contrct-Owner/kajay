/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Class overrides, layout and the text seam — checklist I4, I5 and I6.
 *
 * All three are about what reaches the DOM, and none of them can be seen from the model.
 * As with the theme suite, no stylesheet is loaded here: the claims are about the
 * attributes and the structure, and whether they *look* like anything is the host
 * demo's job.
 */
function build(page: Readonly<Record<string, unknown>>): SurveyModel {
  return parseSurvey({ pages: [{ name: 'p1', ...page }] }).survey;
}

const TWO_QUESTIONS = {
  colCount: 2,
  elements: [
    { type: 'text', name: 'first', title: 'First' },
    { type: 'text', name: 'second', title: 'Second' },
  ],
};

test('parity/I4-css-overrides: a host class is added to the built-in one', async () => {
  const screen = await render(
    <Survey
      model={build(TWO_QUESTIONS)}
      css={{ survey: 'tenant-survey', page: 'tenant-page', element: 'tenant-field' }}
    />,
  );

  // Added, never substituted: replacing them would take the shipped stylesheet with it
  // and leave a host that wanted one extra class reimplementing everything.
  const survey = screen.container.querySelector('form');
  expect(survey?.className).toBe('kajay-survey tenant-survey');
  expect(screen.container.querySelector('section')?.className).toBe('kajay-page tenant-page');
  expect(screen.container.querySelector('.kajay-element')?.className).toBe(
    'kajay-element tenant-field',
  );
});

test('parity/I4-css-overrides: a part nobody named is left alone', async () => {
  const screen = await render(<Survey model={build(TWO_QUESTIONS)} css={{ page: 'only-page' }} />);

  expect(screen.container.querySelector('form')?.className).toBe('kajay-survey');
});

test('parity/I5-layout: a page lays its elements out in columns', async () => {
  const screen = await render(<Survey model={build(TWO_QUESTIONS)} />);

  const page = screen.container.querySelector('section');
  // A variable rather than a class per count: an author may ask for any number, and a
  // stylesheet cannot enumerate them.
  expect(page?.style.getPropertyValue('--kajay-col-count')).toBe('2');
});

test('parity/I5-layout: startWithNewLine breaks the row', async () => {
  const screen = await render(
    <Survey
      model={build({
        colCount: 2,
        elements: [
          { type: 'text', name: 'first', title: 'First' },
          { type: 'text', name: 'second', title: 'Second', startWithNewLine: true },
        ],
      })}
    />,
  );

  const slots = screen.container.querySelectorAll('.kajay-element');
  // The element that wants the break carries it, rather than a break *element* in the
  // tree that means nothing to a screen reader.
  expect((slots[0] as HTMLElement).style.gridColumnStart).toBe('');
  expect((slots[1] as HTMLElement).style.gridColumnStart).toBe('1');
});

test('parity/I5-layout: a question may state its own width', async () => {
  const screen = await render(
    <Survey
      model={build({
        elements: [{ type: 'text', name: 'first', title: 'First', width: '12rem', minWidth: '6rem' }],
      })}
    />,
  );

  const slot = screen.container.querySelector('.kajay-element') as HTMLElement;
  expect(slot.style.width).toBe('12rem');
  expect(slot.style.minWidth).toBe('6rem');
});

test('parity/I5-layout: a hidden title is still the accessible name', async () => {
  const screen = await render(
    <Survey
      model={build({
        elements: [{ type: 'text', name: 'first', title: 'First', titleLocation: 'hidden' }],
      })}
    />,
  );

  // Hidden *visually* — the class carries that — while the label still names the input.
  // An input with no accessible name is unanswerable to anyone who cannot see the
  // column header or the sentence above it.
  await expect.element(screen.getByLabelText('First')).toBeInTheDocument();
  expect(
    (screen.container.querySelector('.kajay-element') as HTMLElement).dataset['titleLocation'],
  ).toBe('hidden');
});

test('parity/I6-text-seam: a host decides what authored prose becomes', async () => {
  const screen = await render(
    <Survey
      model={build({ elements: [{ type: 'text', name: 'first', title: '*First*' }] })}
      renderText={(text, where) =>
        where === 'title' ? <em data-rendered-by="host">{text.replaceAll('*', '')}</em> : text
      }
    />,
  );

  // A node, not an HTML string: a host that wants markup renders it themselves, with
  // their own sanitizer, and the library never inserts markup it did not build.
  await expect.element(screen.getByLabelText('First')).toBeInTheDocument();
  expect(screen.container.querySelector('[data-rendered-by="host"]')?.tagName).toBe('EM');
});

test('parity/I6-text-seam: without one, the text is the text', async () => {
  const screen = await render(
    <Survey model={build({ elements: [{ type: 'text', name: 'first', title: '*First*' }] })} />,
  );

  await expect.element(screen.getByLabelText('*First*')).toBeInTheDocument();
});
