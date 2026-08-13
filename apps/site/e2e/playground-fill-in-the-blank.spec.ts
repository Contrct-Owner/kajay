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

test('parity/C13-inline-styling: the gaps sit in the line rather than breaking it', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await page.getByText('Examples', { exact: false }).first().click();
  await page.getByTestId('load-example-fill-in-the-blank').click();

  // Measured in a real browser with the stylesheet loaded, which is the only place these
  // claims are true or false: the component suite deliberately loads no stylesheet, so
  // every one of these defects was invisible to it.
  const sentence = live(page).locator('.kajay-fillintheblank');
  const boxes = await sentence.locator('input, select').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { label: node.getAttribute('aria-label'), height: Math.round(rect.height), width: Math.round(rect.width) };
    }),
  );

  // One height for the text field, the dropdown and the multi-select. They are three
  // native controls whose defaults differ by a few pixels, which reads as a wobble.
  const controls = boxes.filter((box) => box.label !== 'Works remotely');
  const heights = [...new Set(controls.map((box) => box.height))];
  expect(heights).toHaveLength(1);

  // A gap is as wide as what it is for. Every one used to be twenty characters — the
  // browser's default — so a two-digit seat count claimed as much room as a full name.
  const seats = boxes.find((box) => box.label === 'Seats');
  const name = boxes.find((box) => box.label === 'Your name');
  expect(seats?.width).toBeLessThan(name?.width ?? 0);

  // Nothing computed yet still holds its place: empty, the span collapsed to nothing and
  // the sentence read "which is  seat-months a year", which a reader takes for a typo.
  const computed = sentence.locator('.kajay-fillintheblank__computed');
  await expect(computed).toBeEmpty();
  const dormant = await computed.evaluate((node) => node.getBoundingClientRect().width);
  expect(dormant).toBeGreaterThan(0);

  // And it is the answer once there is one, in the run of the prose.
  await live(page).getByLabel('Seats').fill('12');
  await expect(computed).toHaveText('144');
});
