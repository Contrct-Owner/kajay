/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Where focus goes as a page arrives, which only a browser can answer.
 *
 * Off by default on purpose: on a long page, focusing the first field drops a screen
 * reader user past the page title and any instructions above it. The tests below prove
 * both halves of that decision, because a default nobody checks is a default that drifts.
 */
function build(extra: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    ...extra,
    pages: [
      { name: 'p1', elements: [{ type: 'text', name: 'first', title: 'First' }] },
      { name: 'p2', elements: [{ type: 'text', name: 'second', title: 'Second' }] },
    ],
  }).survey;
}

test('parity/E10-autofocus: nothing takes focus unless the definition asks', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('First')).not.toHaveFocus();
});

test('parity/E10-autofocus: the first question takes focus, and again on the next page', async () => {
  const model = build({ autoFocusFirstQuestion: true });
  const screen = await render(<Survey model={model} />);

  await expect.element(screen.getByLabelText('First')).toHaveFocus();

  await screen.getByRole('button', { name: 'Next' }).click();
  // On arrival, not on every render: keyed on the page, or focus would be yanked back
  // to the first field on every keystroke.
  await expect.element(screen.getByLabelText('Second')).toHaveFocus();
});
