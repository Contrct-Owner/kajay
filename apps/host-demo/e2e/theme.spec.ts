import { expect, test } from '@playwright/test';
import { gotoLogicShowcase } from './support/navigate.js';

/**
 * Theming — checklist §I — against the stylesheet the library actually ships.
 *
 * This is the half the rendering-integration suite cannot prove: it loads no CSS on
 * purpose, so it can show the variables arriving and staying scoped but not that they
 * restyle anything. The demo imports `@kajay/themes/styles.css`, so here a theme change
 * has to move real pixels.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/I1-tokens: the shipped stylesheet styles the survey', async ({ page }) => {
  const survey = page.locator('form.kajay-survey');
  // Not the browser default: the stylesheet is loaded and the tokens are in force.
  await expect(survey).toHaveCSS('border-radius', '8px');
});

test('parity/I2-theme: switching a theme restyles the survey at runtime', async ({ page }) => {
  const survey = page.locator('form.kajay-survey');
  const light = await survey.evaluate((element) => getComputedStyle(element).backgroundColor);

  await page.getByLabel('Theme').selectOption('dark');

  const dark = await survey.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(dark).not.toBe(light);
  // The variable itself, so the assertion says which token did the work rather than
  // which colour happened to come out.
  await expect(survey).toHaveCSS('background-color', 'rgb(18, 22, 31)');
});

test('parity/I3-presets: panelless takes the frames away', async ({ page }) => {
  // The first page has no groups to un-frame, and the showcase's one appears only once
  // a plan is chosen — its `visibleIf` is the point of that page.
  await gotoLogicShowcase(page);
  await page.getByLabel('paid').check();
  const panel = page.locator('fieldset.kajay-panel').first();
  await expect(panel).toHaveCSS('border-top-width', '1px');

  await page.getByLabel('Theme').selectOption('panelless');

  // The mode is two lengths, not a flag: no rule in the stylesheet knows it exists.
  await expect(panel).toHaveCSS('border-top-width', '0px');
  await expect(panel).toHaveCSS('padding-top', '0px');
});

test('parity/I4-css-overrides', async ({ page }) => {
  // The host's class and the library's, on the same element. The demo's stylesheet
  // styles the first; the shipped one styles the second.
  const survey = page.locator('form.kajay-survey');
  await expect(survey).toHaveClass('kajay-survey host-demo__survey');
  await expect(survey).toHaveCSS('box-shadow', 'rgba(16, 24, 40, 0.1) 0px 1px 3px 0px');
});

test('parity/I5-layout', async ({ page }) => {
  const first = page.locator('[data-element-slot="fullName"]');
  const email = page.locator('[data-element-slot="email"]');

  // Two columns, and the answers that fit side by side do. Measured rather than
  // asserted from a class: the grid is the claim.
  const firstBox = await first.boundingBox();
  const emailBox = await email.boundingBox();
  if (firstBox === null || emailBox === null) {
    throw new Error('expected both elements to be laid out');
  }
  // `fullName` asked for a row of its own; `email` sits in the second column beside the
  // element before it.
  expect(emailBox.x).toBeGreaterThan(firstBox.x);
  expect(emailBox.y).toBeLessThan(firstBox.y + firstBox.height + emailBox.height);
});

test('parity/I6-text-seam', async ({ page }) => {
  // The host turned `*…*` into a real element. Nothing in the library parsed anything.
  await expect(page.locator('.kajay-question__title em').first()).toBeVisible();
});

test('parity/I2-theme: the theme is scoped to the survey, not the page', async ({ page }) => {
  await page.getByLabel('Theme').selectOption('dark');

  // The demo's own chrome around the survey is untouched: a survey themes itself and
  // nothing else, which is what lets one live inside a host page that has its own look.
  await expect(page.locator('.host-demo__panel').first()).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
});
