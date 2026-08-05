import { expect, test } from '@playwright/test';

test('documentation home and runtime quickstart are server-rendered', async ({ page }) => {
  const home = await page.goto('/docs');
  expect((await home?.text()) ?? '').toContain('Kajay documentation');

  const quickstart = await page.goto('/docs/quickstart/runtime');
  const html = (await quickstart?.text()) ?? '';
  expect(html).toContain('Render your first survey');
  expect(html).toContain('Define the survey');
  await expect(page.getByRole('combobox', { name: 'Search documentation' })).toBeVisible();
});

test('preview posture never offers an unavailable installation command', async ({ page }) => {
  await page.goto('/docs/quickstart/runtime');

  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Kajay packages are not published yet.')).toBeVisible();
  await expect(page.getByText(/npm install/iu)).toHaveCount(0);
  await expect(page.getByText(/pnpm add/iu)).toHaveCount(0);
});

test('expression and validation guides are reachable as consumer pages', async ({ page }) => {
  await page.goto('/docs/surveys/expressions');
  await expect(page.getByRole('heading', { name: 'Expressions and conditional logic' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Try an expression' })).toBeVisible();

  await page.goto('/docs/surveys/validation');
  await expect(page.getByRole('heading', { name: 'Validation', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add application and server rules' })).toBeVisible();
});

test('Creator documentation is part of the same catalog', async ({ page }) => {
  await page.goto('/docs/quickstart/creator');

  await expect(page.getByRole('heading', { name: 'Embed the Creator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create a controlled Creator' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Load and save definitions' })).toBeVisible();
});

test('generated definition and API detail routes resolve through the reference registry', async ({
  page,
}) => {
  await page.goto('/docs/reference/definition-types/text');
  await expect(page.getByRole('heading', { name: 'text definition' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Definition shape' })).toBeVisible();

  await page.goto('/docs/reference/api/core/parse-survey');
  await expect(page.getByRole('heading', { name: 'parseSurvey' })).toBeVisible();
  await expect(page.getByText('@kajay/core', { exact: true })).toBeVisible();
});

test('canonical expression reference includes the interactive evaluator', async ({ page }) => {
  await page.goto('/docs/reference/expression-language');

  await expect(page.getByLabel('Expression', { exact: true })).toBeVisible();
  await page.getByLabel('Expression', { exact: true }).fill('{amount} * 2');
  await expect(page.getByText('Canonical form')).toBeVisible();
  await expect(page.locator('#operator-add')).toBeVisible();
});

test('search supports keyboard selection and navigation', async ({ page }) => {
  await page.goto('/docs');
  const search = page.getByRole('combobox', { name: 'Search documentation' });

  await search.fill('parseSurvey');
  await expect(page.getByRole('listbox')).toBeVisible();
  await search.press('ArrowDown');
  const active = page.locator('[role="option"][aria-selected="true"]');
  await expect(active).toBeVisible();
  const destination = await active.getAttribute('href');
  if (destination === null) {
    throw new Error('The active documentation search result has no destination.');
  }
  const expectedUrl = new URL(destination, page.url()).toString();
  await search.press('Enter');
  await expect(page).toHaveURL(expectedUrl);
});

test('mobile navigation exposes the complete catalog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs/integration/file-handling');

  const disclosure = page.getByText('Browse documentation', { exact: true });
  await expect(disclosure).toBeVisible();
  await disclosure.click();
  const navigation = page.getByRole('navigation', { name: 'Mobile documentation' });
  await expect(navigation.getByRole('link', { name: 'Render your first survey' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Embed the Creator' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Reference', exact: true })).toBeVisible();
});

test('unknown documentation routes render an accessible recovery state', async ({ page }) => {
  await page.goto('/docs/not-a-real-page');

  await expect(page.getByRole('heading', { name: 'Documentation page not found' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Try another route');
  await expect(page.getByRole('link', { name: 'Return to documentation home' })).toBeVisible();
});

test('the landing page exposes Docs in primary navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Docs' }).click();

  await expect(page).toHaveURL(/\/docs$/u);
  await expect(page.getByRole('heading', { name: 'Kajay documentation' })).toBeVisible();
});

test('inline elements keep word boundaries in consumer prose', async ({ page }) => {
  await page.goto('/docs');
  const documentationLinks = await page
    .getByRole('navigation', { name: 'Documentation' })
    .getByRole('link')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => href !== null))]);

  const failures = (await Promise.all(documentationLinks.map(async (href) => {
    const inspectedPage = await page.context().newPage();
    try {
      await inspectedPage.goto(href);
      const joinedWords = await inspectedPage
        .locator('main p > :is(a, code), main li > :is(a, code)')
        .evaluateAll((nodes) => nodes.flatMap((node) => {
          const before = node.previousSibling?.nodeType === Node.TEXT_NODE
            ? node.previousSibling.textContent ?? ''
            : '';
          const after = node.nextSibling?.nodeType === Node.TEXT_NODE
            ? node.nextSibling.textContent ?? ''
            : '';
          const inlineText = node.textContent ?? '';
          const label = node.nodeName.toLocaleLowerCase('en-US');
          return [
            /[\p{L}\p{N}]$/u.test(before) && /^[\p{L}\p{N}]/u.test(inlineText)
              ? `${before.slice(-18)}<${label}>${inlineText}</${label}>`
              : undefined,
            /[\p{L}\p{N}]$/u.test(inlineText) && /^[\p{L}\p{N}]/u.test(after)
              ? `<${label}>${inlineText}</${label}>${after.slice(0, 18)}`
              : undefined,
          ].filter((value): value is string => value !== undefined);
        }));
      return joinedWords.map((value) => `${href}: ${value}`);
    } finally {
      await inspectedPage.close();
    }
  }))).flat();

  expect(failures).toEqual([]);
});
