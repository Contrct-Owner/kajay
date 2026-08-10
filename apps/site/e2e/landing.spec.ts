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

  // **Waited for, because this is the one scenario that interacts with server-rendered
  // markup.** Everything else on the site that a test clicks is client-only and therefore
  // cannot exist before it works; the hero is the opposite — it is in the document the
  // server sent, so it is *clickable* a moment before it is *live*. A click that lands in
  // that window checks the radio in the DOM, reaches no model, and fires no `visibleIf`,
  // which is exactly the failure CI produced while three local runs passed: the race is
  // real everywhere and only lost on a machine under load.
  //
  // Nothing weaker recovers it. Retrying the interaction cannot: `check()` is a no-op once
  // the input is checked, so the retry never dispatches anything, and clicking the radio
  // again would *clear* the answer rather than repeat it — a selected radio re-picked is
  // how §C8 lets a respondent take an answer back.
  await page.waitForLoadState('networkidle');

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

test('parity/P8-landing: the component-map claim matches the renderer API', async ({ page }) => {
  await page.goto('/');

  const example = page.getByTestId('survey-components-example');
  await expect(example).toContainText(
    "import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents'",
  );
  await expect(example).toContainText('components={KAJAY_SURVEY_COMPONENTS}');
  await expect(example).not.toContainText('Select');
  await expect(page.getByText('Button, Input, Textarea, Checkbox and Radio')).toBeVisible();
  await expect(page.getByText(/Kajay draws every control through your design system/u)).toHaveCount(0);
});

test('parity/P8-landing: it gives visitors a working installation path', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('availability')).toContainText('Kajay 1.0 is available now');
  await expect(page.getByTestId('availability')).toContainText(
    'npm install @kajay/core @kajay/react @kajay/themes',
  );
  await expect(page.getByRole('link', { name: 'runtime quickstart' })).toHaveAttribute(
    'href',
    '/docs/quickstart/runtime',
  );
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

test('parity/P13-sharing: the page says what it is to something that never runs it', async ({
  page,
  request,
}) => {
  const html = (await (await page.goto('/'))?.text()) ?? '';

  // **None of this is for the browser.** A link pasted into Slack, a search result, a
  // preview card: each renders from the head of the document the server sent, having run
  // none of the page. The site had none of it, which for a library whose entire
  // distribution is somebody sharing a link meant every share rendered as a bare URL.
  for (const tag of [
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'name="twitter:card" content="summary_large_image"',
    'rel="canonical"',
  ]) {
    expect(html).toContain(tag);
  }

  // The card has to be a raster image and has to exist. Clients that render one — Slack,
  // iMessage, Discord — do not render SVG, and a card that 404s is the same as no card at
  // all except that it looks like a mistake.
  const card = await request.get('/og.png');
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toContain('image/png');

  // Crawlable, and pointed at a map of the site rather than left to guess.
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap: https://kajay.io/sitemap.xml');

  // The map is *generated* from the same manifests the documentation is built from, so it
  // cannot fall behind the pages it lists — most of which nobody wrote by hand either.
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toContain('xml');
  const urls = (await sitemap.text()).match(/<loc>/gu)?.length ?? 0;
  expect(urls).toBeGreaterThan(100);
});
