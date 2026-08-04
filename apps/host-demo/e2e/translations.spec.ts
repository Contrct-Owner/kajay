import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The translation editor, against the real demo — checklist M4.
 *
 * The demo wires a pretend translation service and its own CSV import/export, which is the
 * seam working as intended: the library hands over a rectangle of strings and reads one
 * back, and what a host does with it is theirs.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-translations').click();
});

function panel(page: Page): Locator {
  return page.getByRole('region', { name: 'Designer translations' });
}

test('parity/M4-translations: every string in the survey has a row', async ({ page }) => {
  // Found by walking the registry, so a question's title and a *choice item's* text are
  // both here without anything naming either.
  await expect(
    panel(page).getByTestId('translation-cell-survey/pages/p1/elements/draftName/title-default'),
  ).toHaveValue('Draft: applicant name');
  await expect(
    panel(page).getByTestId('translation-cell-survey/pages/p1/elements/draftTier/choices/bronze/text-default'),
  ).toBeVisible();
});

test('parity/M4-translations: a translation reaches the definition', async ({ page }) => {
  await panel(page).getByTestId('add-locale').fill('fr');
  await panel(page).getByTestId('add-locale-button').click();

  await panel(page)
    .getByTestId('translation-cell-survey/pages/p1/elements/draftName/title-fr')
    .fill('Nom du candidat');

  await page.getByTestId('tab-json').click();
  await expect(page.getByRole('region', { name: 'Designer JSON' }).getByLabel('Survey definition')).toHaveValue(
    /Nom du candidat/u,
  );
});

test('parity/M4-machine-translation: it fills the empty cells through the host seam', async ({
  page,
}) => {
  await panel(page).getByTestId('add-locale').fill('de');
  await panel(page).getByTestId('add-locale-button').click();
  await panel(page).getByTestId('translate-target').selectOption('de');

  await panel(page).getByTestId('translate-button').click();

  await expect(panel(page).getByTestId('translations-report')).toContainText(/Filled \d+ strings/u);
  await expect(
    panel(page).getByTestId('translation-cell-survey/pages/p1/elements/draftName/title-de'),
  ).toHaveValue('[de] Draft: applicant name');
});

test('parity/M4-translation-sheet: a CSV goes out and comes back in', async ({ page }) => {
  await panel(page).getByTestId('add-locale').fill('fr');
  await panel(page).getByTestId('add-locale-button').click();

  const download = page.waitForEvent('download');
  await panel(page).getByTestId('export-csv').click();
  const file = await download;

  // Back in with one cell changed, which is exactly what a translator sends back.
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  expect(text).toContain('survey/pages/p1/elements/draftName/title');

  await panel(page).getByTestId('import-csv').setInputFiles({
    name: 'translations.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'key,fr\r\nsurvey/pages/p1/elements/draftName/title,Nom du candidat\r\nsurvey/pages/p1/elements/gone/title,Parti\r\n',
      'utf8',
    ),
  });

  // What landed *and* what no longer exists — a count with no mention of the rest is how a
  // survey ships with a language nobody notices is missing strings.
  await expect(panel(page).getByTestId('import-report')).toContainText('Imported 1 strings.');
  await expect(panel(page).getByTestId('import-report')).toContainText('1 no longer exist');
  await expect(
    panel(page).getByTestId('translation-cell-survey/pages/p1/elements/draftName/title-fr'),
  ).toHaveValue('Nom du candidat');
});

test('parity/M4-translations: no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('[aria-label="Designer translations"]')
    .analyze();

  expect(results.violations).toEqual([]);
});
