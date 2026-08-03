import { expect, test } from '@playwright/test';

/**
 * Localization against the real demo — checklist J1 and J2.
 *
 * What the unit and browser suites cannot show: that an author's translations and the
 * library's own words switch together, from one control, in a survey whose definition
 * came through the public parsing seam — and that the definition still carries every
 * translation afterwards.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/J1-locale-switch', async ({ page }) => {
  const language = page.getByLabel('Language');
  await expect(page.getByLabel(/What is your name\?/u)).toBeVisible();

  await language.selectOption('fr');

  // The author's title and the library's button, in one switch.
  await expect(page.getByLabel(/Quel est votre nom \?/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suivant' })).toBeVisible();

  await language.selectOption('de');
  await expect(page.getByLabel(/Wie heißen Sie\?/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible();
});

test('parity/J1-localized-round-trip', async ({ page }) => {
  await page.getByLabel('Language').selectOption('fr');

  const canonical = page.getByTestId('canonical-json');
  // Read in French, still bilingual on the page that shows what would be saved. A model
  // that resolved on the way in would have thrown the other three languages away.
  await expect(canonical).toContainText('Quel est votre nom ?');
  await expect(canonical).toContainText('Wie heißen Sie?');
  // And the definition still opens in English: which language a respondent switched to
  // is not part of it.
  await expect(canonical).toContainText('"locale": "en"');
  await expect(page.getByTestId('round-trip-status')).toHaveText('Round-trip is a fixed point');
});

test('parity/J2-ui-strings', async ({ page }) => {
  await page.getByLabel('Language').selectOption('fr');
  await page.getByRole('button', { name: 'Suivant' }).click();

  // Scoped to the form: the canonical-JSON panel below it quite correctly contains the
  // same sentence, because that is where the translation is stored.
  const form = page.locator('form.kajay-survey');
  // The author translated this message; the library would have supplied its own.
  await expect(form.getByText('Nous avons besoin d’un nom pour vous appeler.')).toBeVisible();
});

test('parity/J2-ui-strings: a host may add a language the library does not ship', async ({
  page,
}) => {
  await page.getByLabel('Language').selectOption('cy');

  // Registered by the demo, not shipped by `@kajay/core` — the mechanism the row is
  // actually about.
  await expect(page.getByRole('button', { name: 'Nesaf' })).toBeVisible();
  // And a partial translation is usable rather than broken: what Welsh does not name
  // falls back to English rather than to nothing.
  await expect(page.getByRole('heading', { name: 'Kajay demo' })).toBeVisible();
});

test('parity/J3-rtl', async ({ page }) => {
  const survey = page.locator('.kajay-theme');
  await expect(survey).toHaveAttribute('dir', 'ltr');

  await page.getByLabel('Language').selectOption('ar');

  // Nothing in the demo asked for this: the direction is derived from the language.
  await expect(survey).toHaveAttribute('dir', 'rtl');

  // And against the stylesheet the library actually ships, the mirroring is real —
  // the row header's text now starts on the right, because the rule says `start` and
  // the browser resolved it the other way.
  const label = page.getByLabel(/What is your name\?|ما اسمك/u).first();
  await expect(label).toHaveCSS('direction', 'rtl');
});
