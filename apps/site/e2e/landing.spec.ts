import { expect, test } from '@playwright/test';

/**
 * The landing page — checklist P8.
 *
 * The scenarios worth having here are the ones a marketing page can get *wrong*: a claim
 * the product cannot back, an instruction that fails, or a demonstration that turns out to
 * be a picture. None of them are about wording.
 */
test('parity/P8-landing: the survey in the hero is server-rendered', async ({ page }) => {
  const response = await page.goto('/');
  const html = (await response?.text()) ?? '';

  // **This is what makes P1 an end-to-end claim.** The renderer was broken under server
  // rendering and was fixed with a unit proof; the playground is client-only so it could
  // never watch that. Here the questions are in the document the server sent, before any
  // React has run — so if the renderer stops surviving the server, this page goes blank
  // in CI rather than in somebody's production build.
  expect(html).toContain('What are you building?');
  expect(html).toContain('A product with a survey in it');
});

test('parity/P8-landing: the hero survey is a real one, not a picture', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('hero-survey');

  // The second question is `visibleIf` the first, so it cannot be on screen yet.
  await expect(hero.getByText('What has to work on day one?')).toBeHidden();

  await hero.getByLabel('A product with a survey in it').check();

  // Logic ran in the page. A screenshot cannot do this, which is the argument for putting
  // the real thing on the page rather than an image of it.
  await expect(hero.getByText('What has to work on day one?')).toBeVisible();
});

test('parity/P8-landing: the hero survey is drawn with the site’s own components', async ({
  page,
}) => {
  await page.goto('/');

  // `data-slot` is shadcn's marker, and the page's own buttons carry it too. The claim in
  // the headline is that these are the same components; this is that claim as an assertion.
  const control = page.getByTestId('hero-survey').locator('[data-slot]').first();
  await expect(control).toBeVisible();
});

test('parity/P8-landing: it does not tell anyone to install something that is not there', async ({
  page,
}) => {
  await page.goto('/');

  // The packages are private, unlicensed and the scope is unclaimed. A page whose first
  // instruction fails is worse than a page with one fewer button, so the page says so and
  // offers the playground instead.
  await expect(page.getByTestId('availability')).toContainText('not published yet');
  await expect(page.getByText('npm install')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open the playground' })).toBeVisible();
});

test('parity/P8-landing: the playground is one click away', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Open the playground' }).click();

  await expect(page).toHaveURL(/\/playground/u);
  await expect(page.getByTestId('live-survey')).toBeVisible();
});

test('parity/P8-landing: the designer is shown running, not described', async ({ page }) => {
  await page.goto('/');

  // The section was a paragraph, which failed this row's own standard — the hero
  // demonstrates the survey half and the designer half was asserted. A drag-and-drop
  // canvas is the one claim a screenshot cannot make.
  const demo = page.getByTestId('designer-demo');
  await expect(demo.getByTestId('select-company')).toBeVisible();
  await expect(demo.getByTestId('toolbox-rating')).toBeVisible();

  await demo.getByTestId('toolbox-rating').click();
  await expect(demo.getByTestId('select-rating1')).toBeVisible();
});

test('parity/P8-landing: the survey is served and the designer is not', async ({ page }) => {
  const html = (await (await page.goto('/'))?.text()) ?? '';

  // Two halves, two answers, and the difference is real rather than an oversight. A survey
  // is content and belongs in the document the server sent — P1 made that possible. A
  // design surface measures before it draws, so there is nothing a server render would be
  // right about.
  expect(html).toContain('What are you building?');
  expect(html).not.toContain('data-testid="designer-demo"');
  await expect(page.getByTestId('designer-demo')).toBeVisible();
});
