/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * A theme applied at runtime — checklist I2.
 *
 * The renderer's whole part in theming is this: put a map of custom properties on one
 * element and let them inherit. The map is computed by `@kajay/themes`, which this
 * package is not allowed to import — so the tests hand over a plain object, exactly as a
 * host writing its own variables would.
 *
 * What is *not* proven here is that the variables restyle anything, because this suite
 * deliberately loads no stylesheet: that half belongs to the host demo, which imports
 * the real one. Here the claim is that the values arrive and stay scoped.
 */
function build(): SurveyModel {
  return parseSurvey({
    title: 'Themed',
    pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Who are you?' }] }],
  }).survey;
}

function variableOn(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

test('parity/I2-theme: the variables reach everything inside the survey', async () => {
  const screen = await render(
    <Survey model={build()} theme={{ '--kajay-color-accent': 'rgb(255, 0, 0)' }} />,
  );

  // Read from the *input*, not from the element the variables were set on: inheritance
  // is the mechanism, and a test that checked the wrapper would prove only that React
  // sets a style attribute.
  const input = screen.getByLabelText('Who are you?').element();
  expect(variableOn(input, '--kajay-color-accent')).toBe('rgb(255, 0, 0)');
});

test('parity/I2-theme: no theme sets nothing at all', async () => {
  const screen = await render(<Survey model={build()} />);

  // Whatever the stylesheet says stays said. A renderer that wrote its own values when
  // no theme was given would make the shipped defaults unoverridable.
  const input = screen.getByLabelText('Who are you?').element();
  expect(variableOn(input, '--kajay-color-accent')).toBe('');
});

test('parity/I2-theme: two surveys on a page are themed separately', async () => {
  const screen = await render(
    <>
      <Survey model={build()} theme={{ '--kajay-radius': '0px' }} />
      <Survey model={build()} theme={{ '--kajay-radius': '12px' }} />
    </>,
  );

  // Scoped to the survey rather than set on `:root`, which is what makes a preview
  // beside a form, or two embedded surveys on one page, possible at all.
  const inputs = screen.container.querySelectorAll('.kajay-question__input');
  expect(variableOn(inputs[0] as Element, '--kajay-radius')).toBe('0px');
  expect(variableOn(inputs[1] as Element, '--kajay-radius')).toBe('12px');
});
