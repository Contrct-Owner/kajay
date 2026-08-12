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

/** A box's vertical centre, so two of them can be asked whether they share a line. */
function centre(box: { y: number; height: number } | null): number {
  return box === null ? Number.NaN : box.y + box.height / 2;
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

test('parity/P3-playground: on a phone the header keeps its arrangement', async ({ page }) => {
  await page.goto(PLAYGROUND);

  const title = await page.getByRole('heading', { name: 'Playground' }).boundingBox();
  const theme = await page.getByTestId('theme-toggle').boundingBox();
  const design = await page.getByTestId('editor-mode-design').boundingBox();
  const share = await page.getByTestId('share-link').boundingBox();

  // **The same three rows a desktop reader gets**, which is the whole reason the header has
  // no breakpoint in it: a `flex-wrap` row reflows into a different arrangement at every
  // width, so the phone got the theme toggle stranded on a line of its own and the mode
  // switch pushed up beside the share button. Asserting it here and at desktop is what
  // makes "the same at every width" a claim rather than a hope.
  expect(Math.abs(centre(title) - centre(theme))).toBeLessThan(6);
  expect(Math.abs(centre(design) - centre(share))).toBeLessThan(6);
  expect(centre(theme)).toBeLessThan(centre(share));

  // Each holding its own edge, on a viewport where there is barely room for both.
  expect(design?.x ?? 0).toBeLessThan(share?.x ?? 0);
  expect((share?.x ?? 0) + (share?.width ?? 0)).toBeGreaterThan((design?.x ?? 0) + 200);
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

test('parity/P3-playground: on a phone the actions stay reachable down a long survey', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  // Seeded through the JSON editor rather than by clicking the toolbox thirteen times: the
  // subject here is scrolling, so how the questions got there is setup, and one apply is
  // both faster and deterministic where a run of clicks is a run of chances to be flaky.
  // Thirteen questions is ~8.5 screens at this viewport — an ordinary survey, not an
  // extreme one.
  await page.getByTestId('editor-mode-json').click();
  await page.getByTestId('json-text').fill(
    JSON.stringify({
      pages: [
        {
          name: 'p1',
          elements: Array.from({ length: 13 }, (_, index) => ({
            type: 'radiogroup',
            name: `q${index}`,
            choices: ['Item 1', 'Item 2', 'Item 3'],
          })),
        },
      ],
    }),
  );
  await page.getByTestId('json-apply').click();
  await page.getByTestId('editor-mode-design').click();

  const actions = page.getByTestId('compact-actions');
  const viewportHeight = page.viewportSize()?.height ?? 0;
  await page.mouse.wheel(0, 2000);

  // Pinned to the bottom edge of the viewport, several screens below where the row used to
  // sit. `boundingBox` reports x/y/width/height, so the bottom edge is `y + height`.
  await expect
    .poll(async () => {
      const box = await actions.boundingBox();
      return box === null ? -1 : Math.round(box.y + box.height);
    })
    .toBe(viewportHeight);

  // **Still usable, not merely on screen.** The row used to sit statically above the canvas,
  // so reaching either button from the question you had scrolled to meant scrolling back to
  // the top and then finding your place again.
  await page.getByTestId('pane-toolbox').click();
  await expect(page.getByTestId('sheet-toolbox')).toBeVisible();
  await page.keyboard.press('Escape');

  // And it lets go at the end of the designer rather than floating over the live survey —
  // the scoping that comes free with `sticky` and would need a scroll listener without it.
  await live(page).scrollIntoViewIfNeeded();
  const livePane = await live(page).boundingBox();
  const parked = await actions.boundingBox();
  expect((parked?.y ?? 0) + (parked?.height ?? 0)).toBeLessThanOrEqual(livePane?.y ?? 0);
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
