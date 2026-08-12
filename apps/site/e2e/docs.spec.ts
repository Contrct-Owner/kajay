import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('documentation home and runtime quickstart are server-rendered', async ({ page }) => {
  const home = await page.goto('/docs');
  expect((await home?.text()) ?? '').toContain('Kajay documentation');

  const quickstart = await page.goto('/docs/quickstart/runtime');
  const html = (await quickstart?.text()) ?? '';
  expect(html).toContain('Render your first survey');
  expect(html).toContain('Define the survey');
  await expect(page.getByRole('combobox', { name: 'Search documentation' })).toBeVisible();
});

test('runtime quickstart gives the published installation command', async ({ page }) => {
  await page.goto('/docs/quickstart/runtime');

  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Install Kajay 1.x')).toBeVisible();
  await expect(page.getByText('npm install @kajay/core @kajay/react @kajay/themes')).toBeVisible();
});

test('.NET quickstart and generated API are first-class documentation routes', async ({ page }) => {
  await page.goto('/docs/quickstart/dotnet');

  await expect(page.getByRole('heading', { name: 'Run Kajay in .NET' })).toBeVisible();
  await expect(page.getByText('dotnet add package Kajay.Core --version 1.0.0')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Response Snapshots' })).toBeVisible();

  await page.goto('/docs/reference/api/kajay-core/survey-definition');
  await expect(page.getByRole('heading', { name: 'SurveyDefinition' })).toBeVisible();
  await expect(page.getByText('Kajay.Core', { exact: true })).toBeVisible();
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

test('the MCP guide documents the public read-only contract', async ({ page }) => {
  await page.goto('/docs/integration/model-context-protocol');

  await expect(page.getByRole('heading', { name: 'Use Kajay docs over MCP' })).toBeVisible();
  await expect(page.getByText('https://kajay.io/mcp', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('search_kajay_docs', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Know the read-only boundary' })).toBeVisible();
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
  await expect(navigation.getByRole('link', { name: 'Run Kajay in .NET' })).toBeVisible();
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
  // **Declared slow, which triples the timeout.** Not a workaround: this scenario loads
  // the complete documentation catalog, and the suite's 30s default is the budget for
  // scenarios that load one. Measured at 3.3s in Chromium and 13.2s in Firefox inside the
  // full suite — comfortable, but the same measurement on a loaded CI runner has historically
  // come out around twice the local figure, which puts the honest headroom at nothing. The
  // number of pages is the coverage, so the budget is what should move.
  test.slow();

  await page.goto('/docs');
  const documentationLinks = await page
    .getByRole('navigation', { name: 'Documentation' })
    .getByRole('link')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => href !== null))]);

  // **A fresh page per link, four at a time.** Both halves of that are load-bearing, and
  // each was learned by breaking the other.
  //
  // Not the whole catalog at once, which is what this did originally: with two workers both
  // engines could be doing it together, so one `vite preview` had dozens of pages waiting
  // on it. Alone the scenario took 2.7s; inside the full suite it took 25-40s of its 30s
  // budget and was the suite's only reliable failure.
  //
  // But not one page walked through the catalog either, which is what replaced it. That
  // fixed the load and broke Firefox: the site is a client-routed application, so a page
  // that has just loaded is still hydrating and settling its router, and navigating it
  // again mid-flight aborts the pending load — `NS_BINDING_ABORTED`. Fresh
  // pages never hit it because a new page has no previous route to interrupt.
  //
  // Four keeps that property and caps the concurrency, which is what the load needed.
  const failures = (await batched(documentationLinks, 4, (href) =>
    joinedWordsOn(page, href),
  )).flat();

  expect(failures).toEqual([]);
});

/**
 * Every item through `work`, at most `size` of them in flight.
 *
 * Folded rather than looped because each batch must wait for the one before it, which is
 * the entire point — and a `for` loop saying so reads to the linter as parallelism somebody
 * forgot to write.
 */
function batched<Item, Result>(
  items: readonly Item[],
  size: number,
  work: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const batches = Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
  return batches.reduce<Promise<Result[]>>(
    async (soFar, batch) => [
      ...(await soFar),
      ...(await Promise.all(batch.map((item) => work(item)))),
    ],
    Promise.resolve([]),
  );
}

/**
 * Inline elements on one documentation page that have grown into the word beside them.
 *
 * On a page of its own, closed afterwards. Reusing the caller's is what produced the
 * Firefox aborts described above: this navigates, and a page that is still settling the
 * route it was last given does not survive being sent somewhere else.
 */
async function joinedWordsOn(opener: Page, href: string): Promise<string[]> {
  const page = await opener.context().newPage();
  try {
    await page.goto(href);
    const joinedWords = await page
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
    await page.close();
  }
}
