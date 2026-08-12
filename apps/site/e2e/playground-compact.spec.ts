import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The playground on a phone — checklist P3.
 *
 * **A viewport override rather than a device descriptor**, deliberately: `devices['iPhone 13']`
 * carries `isMobile` and `hasTouch`, which Firefox refuses, and this suite runs in both
 * engines on purpose. Width is the whole subject here, and width is the part both engines
 * agree to emulate.
 *
 * The regression these scenarios exist for: the designer's sidebar track was a fixed 15rem
 * with no breakpoint, and the canvas track beside it was `minmax(0,1fr)`. At 375px that
 * left the canvas 75px and the sidebar 240px, so a question title wrapped to one character
 * per line — and because the canvas track was allowed to collapse rather than overflow,
 * nothing anywhere reported it. Every other scenario in this directory runs at a desktop
 * width, which is exactly why none of them noticed.
 */
const PLAYGROUND = '/playground';

// A phone, and a narrow one — below the 40rem the designer switches at, with room to spare.
test.use({ viewport: { width: 375, height: 812 } });

function canvas(page: Page) {
  return page.getByLabel('Editor');
}

function live(page: Page) {
  return page.getByTestId('live-survey');
}

test('parity/P3-playground: on a phone the canvas gets the width, not the panels', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await expect(canvas(page).getByTestId('select-name')).toBeVisible();

  const editor = await canvas(page).boundingBox();
  const surface = await page.locator('.kajay-designer').boundingBox();

  // **The claim is a ratio, not a pixel count**, so it survives a change of padding: the
  // design surface gets essentially all of the editor pane. Asserting `> 75` would have
  // passed at 76px, which is still one character per line.
  expect(surface?.width ?? 0).toBeGreaterThan((editor?.width ?? 0) * 0.95);

  // And the page does not scroll sideways. The old layout did not either — it silently
  // crushed a column instead — so this is the other half of the same claim.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('parity/P3-playground: on a phone the toolbox is a sheet that closes on a pick', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  // No sidebar at this width: the two panels are behind buttons, so the toolbox is not on
  // screen until it is asked for.
  await expect(page.getByTestId('sheet-toolbox')).toHaveCount(0);
  await page.getByTestId('pane-toolbox').click();
  await expect(page.getByTestId('sheet-toolbox')).toBeVisible();

  await page.getByTestId('toolbox-rating').click();

  // Closing on a pick is the point of picking: a sheet that stayed open would cover the
  // thing the designer just added, on the one screen size where it fills the viewport.
  await expect(page.getByTestId('sheet-toolbox')).toHaveCount(0);
  await expect(canvas(page).getByTestId('select-rating1')).toBeVisible();
  await expect(live(page).getByRole('group', { name: /rating1/iu })).toBeVisible();
});

test('parity/P3-playground: on a phone properties open on demand, not on selection', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await canvas(page).getByTestId('select-name').click();

  // **Selecting must not open the sheet**, and this is the scenario that pins it: adding a
  // question selects it, so an auto-opening panel would bury the canvas at the exact moment
  // the designer wanted to see what landed. Tempting, wrong, and cheap to regress.
  await expect(page.getByTestId('sheet-properties')).toHaveCount(0);

  await page.getByTestId('pane-properties').click();
  const sheet = page.getByTestId('sheet-properties');
  await expect(sheet).toBeVisible();

  // Editable, not merely present — a panel squeezed to nothing is still "visible".
  const title = sheet.locator('.kajay-properties__row[data-property="title"]').getByRole('textbox');
  await title.fill('Your name?');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // Escape closed the sheet and kept the edit: the sheet is a way of reaching the property
  // grid, not a transaction over it.
  await expect(canvas(page).getByText('Your name?')).toBeVisible();
});

test('parity/P3-playground: the sidebar comes back as soon as there is room for it', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await expect(page.getByTestId('pane-toolbox')).toBeVisible();
  await expect(page.locator('[data-slot="accordion"]')).toHaveCount(0);

  // 40rem exactly, which is where the arithmetic in `WIDE_ENOUGH` says a 15rem sidebar
  // starts paying for itself. Asserted at the boundary rather than well past it: a
  // breakpoint nobody tests at the edge is a breakpoint that drifts.
  await page.setViewportSize({ width: 640, height: 812 });
  await expect(page.locator('[data-slot="accordion"]')).toBeVisible();

  // One tree at a time, which is the reason this is measured in JavaScript rather than
  // written as a `sm:` utility: both rendered at once would make every `getByTestId` in
  // this directory ambiguous.
  await expect(page.getByTestId('toolbox-rating')).toHaveCount(1);
});
