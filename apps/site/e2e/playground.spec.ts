import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The playground — checklist P3.
 *
 * **Against the built SSR artifact**, not a dev server: `vite preview` serves what
 * TanStack Start emits, so the first paint here is server-rendered and P1 is under test
 * rather than asserted. A dev server would prove the components work; this proves the
 * deployment does.
 *
 * These scenarios assert the claims the row makes, in the row's own order: the panes are
 * one document, the JSON is the same document as the canvas, a link is the whole artefact,
 * and the two token systems move together.
 */
const PLAYGROUND = '/playground';

function canvas(page: Page) {
  return page.getByLabel('Editor');
}

function live(page: Page) {
  return page.getByTestId('live-survey');
}

test('parity/P3-playground: the page is served, the Creator is not', async ({ page }) => {
  const response = await page.goto(PLAYGROUND);
  const html = (await response?.text()) ?? '';

  // **The playground is deliberately client-only**, and the served document says so: a
  // shell, with none of the route in it. A design surface has to measure things before it
  // can draw them, so it waits for a DOM.
  expect(html).not.toContain('What is your name?');
  expect(html.length).toBeLessThan(8000);

  // So P1's server-rendered *survey* has no proof here. It is covered by
  // `parity/P1-server-rendering` at the unit level, and gets an end-to-end one when the
  // marketing page puts a real survey on a served route.
  await expect(live(page).getByText('What is your name?')).toBeVisible();
});

test('parity/P3-playground: the designer and the live survey are one document', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  await page.getByTestId('toolbox-rating').click();

  // Dropped on the canvas, answerable on the right, with nothing wired between them: both
  // panes come off one `CreatorWorkspace`, and M3's preview session watches the surface
  // itself. This is the claim the whole layout exists to make.
  await expect(canvas(page).getByTestId('select-rating1')).toBeVisible();
  await expect(live(page).getByRole('group', { name: /rating1/iu })).toBeVisible();
});

test('parity/P3-playground: answering the live survey never reaches what is being designed', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  // By label, which is how a respondent finds it. This scenario could not do that until
  // P7: the designer and the live survey are two parses of one definition, and both used
  // to emit `id="kajay-question-name"`, so every `<label for>` here resolved to the
  // designer's input.
  await live(page).getByLabel('What is your name?').fill('Ada');

  // The preview parses its own survey, so an answer is a *response* and cannot become part
  // of the definition. Switching to the JSON is the shortest way to see that it did not.
  await page.getByTestId('editor-mode-json').click();
  await expect(page.getByTestId('json-text')).not.toContainText('Ada');
});

test('parity/P3-playground: editing the JSON shows up on the canvas', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('editor-mode-json').click();

  const editor = page.getByTestId('json-text');
  await editor.fill(
    JSON.stringify({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'only' }] }] }),
  );
  await page.getByTestId('json-apply').click();
  await page.getByTestId('editor-mode-design').click();

  // One surface behind both views — M2's session applies through the same `applyEdit` K6's
  // undo stack wraps, so this is a view change rather than a document handover.
  await expect(canvas(page).getByTestId('select-only')).toBeVisible();
  await expect(canvas(page).getByTestId('select-name')).toHaveCount(0);
});

test('parity/P3-playground: a link is the whole artefact', async ({ page, context }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('toolbox-rating').click();
  await page.getByTestId('share-link').click();

  // Read from the address bar rather than the clipboard: clipboard *reads* need a
  // permission grant that says nothing about the feature, and the link the button copies is
  // the URL the page is already on.
  await expect(page).toHaveURL(/\?d=/u);
  const shared = page.url();

  // Opened in a *different tab* with no shared memory: nothing is stored server-side, so
  // the link carrying the definition is the only way this can work.
  const opened = await context.newPage();
  await opened.goto(shared);
  await expect(opened.getByTestId('live-survey')).toContainText('What is your name?');
  await expect(opened.getByLabel('Editor').getByTestId('select-rating1')).toBeVisible();
  await opened.close();
});

test('parity/P3-playground: a damaged link opens the playground rather than an error', async ({
  page,
}) => {
  await page.goto(`${PLAYGROUND}?d=not-base64-at-all`);

  // Chat clients truncate URLs. Somebody arriving at half of one wants a playground, not a
  // diagnosis of somebody else's paste — and the definition is the only thing lost.
  await expect(live(page).getByText('What is your name?')).toBeVisible();
});

test('parity/P3-playground: one toggle moves both token systems', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('theme-toggle').click();

  // The site's own tokens are shadcn's and the survey's are Kajay's — two systems, and a
  // host who switched only one would have a dark page with a white survey in it. That the
  // seam needs a host to do this deliberately is the finding; that it is one line is why
  // it is acceptable.
  await expect(page.locator('html')).toHaveClass(/dark/u);
  await expect(page.locator('html')).toHaveAttribute('data-kajay-theme', 'dark');
});
