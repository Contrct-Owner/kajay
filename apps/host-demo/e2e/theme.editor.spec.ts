import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The theme editor, against the real demo — checklist M5.
 *
 * The live preview is the point of the row and it is *composition*: the demo calls
 * `themeVariables` on the edited JSON and hands the result to M3's `PreviewPanel`, which is
 * already the real `<Survey>`. So what changes on screen is the survey a respondent gets.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-theme').click();
});

function theme(page: Page): Locator {
  return page.getByRole('region', { name: 'Designer theme' });
}

test('parity/M5-theme-editing: editing a colour reaches the previewed survey', async ({ page }) => {
  const frame = theme(page).getByTestId('preview-frame');

  await theme(page).getByTestId('theme-palette.accent').fill('#118844');

  // The variable lands on the element the host put it on, which is what `themeVariables`
  // is for — and the survey inside inherits it.
  await expect(theme(page)).toHaveCSS('--kajay-color-accent', '#118844');
  await expect(frame).toBeVisible();
});

test('parity/M5-theme-editing: clearing a field puts the stylesheet default back', async ({
  page,
}) => {
  await theme(page).getByTestId('theme-cornerRadius').fill('16px');
  await expect(theme(page)).toHaveCSS('--kajay-color-accent', '#3355ff');

  await theme(page).getByTestId('theme-cornerRadius').fill('');

  // What a theme does not name, it does not set (I2). A blank would have set the variable
  // to nothing rather than leaving the stylesheet alone.
  await expect(theme(page)).not.toHaveCSS('--kajay-radius', '16px');
});

test('parity/M5-theme-file: a preset replaces the theme, and reset goes back', async ({ page }) => {
  await theme(page).getByTestId('theme-preset-dark').click();

  // Replaces rather than merges: the demo's own accent is gone, not blended with the
  // preset's.
  await expect(theme(page).getByTestId('theme-palette.accent')).not.toHaveValue('#3355ff');
  await expect(theme(page).getByTestId('theme-palette.text')).not.toHaveValue('');

  await theme(page).getByTestId('theme-reset').click();
  await expect(theme(page).getByTestId('theme-palette.accent')).toHaveValue('#3355ff');
});

test('parity/M5-theme-file: a theme goes out and comes back', async ({ page }) => {
  const download = page.waitForEvent('download');
  await theme(page).getByTestId('theme-export').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('theme.json');

  await theme(page).getByTestId('theme-import').setInputFiles({
    name: 'theme.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"name":"imported","palette":{"accent":"#aa0000"}}', 'utf8'),
  });

  await expect(theme(page).getByTestId('theme-palette.accent')).toHaveValue('#aa0000');
  await expect(theme(page)).toHaveCSS('--kajay-color-accent', '#aa0000');
});

test('parity/M5-theme-file: a file that is not a theme is refused, not applied', async ({
  page,
}) => {
  await theme(page).getByTestId('theme-import').setInputFiles({
    name: 'theme.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[1, 2, 3]', 'utf8'),
  });

  await expect(theme(page).getByTestId('theme-problem')).toContainText('must be a JSON object');
  // Applying it would have blanked every variable the survey had.
  await expect(theme(page).getByTestId('theme-palette.accent')).toHaveValue('#3355ff');
});

test('parity/M5-theme: no accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('[aria-label="Designer theme"]').analyze();

  expect(results.violations).toEqual([]);
});
