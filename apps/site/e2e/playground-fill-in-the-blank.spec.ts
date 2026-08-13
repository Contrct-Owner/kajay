import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * A sentence that is a form — checklist C13.
 *
 * Its own spec because the playground's is at the size limit, and because this is one
 * claim: the prose is the layout and every gap is a real field. What no unit or component
 * test can say is that a visitor can load it and answer it in a browser.
 */
const PLAYGROUND = '/playground';

function live(page: Page) {
  return page.getByTestId('live-survey');
}

test('parity/C13-render: a sentence is a form, with a different field in every gap', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await page.getByText('Examples', { exact: false }).first().click();
  await page.getByTestId('load-example-fill-in-the-blank').click();

  // The prose is the layout and the gaps are real fields — a dropdown, a multi-select and
  // a yes/no in one sentence, which is what a natural-language builder is for.
  await live(page).getByLabel('Department').selectOption('Design');
  await live(page).getByLabel('Tools your team uses').selectOption(['Kajay', 'Linear']);
  await live(page).getByLabel('Works remotely').check();
  await live(page).getByLabel('Your name').fill('Ada');

  // One answer object keyed by blank name, with the multi-select storing an array under
  // its own key — the shape the type had before any of these kinds existed.
  await page.getByTestId('editor-mode-json').click();
  await expect(page.getByTestId('json-text')).toContainText('fillintheblank');
});
