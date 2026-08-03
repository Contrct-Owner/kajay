import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import {
  answerRequiredQuestionTypes,
  gotoLogicShowcase,
  gotoQuestionTypes,
} from './support/navigate.js';

/**
 * Automated accessibility checks — checklist J5.
 *
 * Every page of the demo, which between them draw every question type the library has.
 * Scoped to the survey itself: the panels of diagnostic JSON around it are the demo's
 * own scaffolding, and failing this suite for the demo's chrome would train everyone to
 * ignore it.
 *
 * **axe is a floor, not a ceiling.** It catches contrast, names, roles and structure —
 * about a third of what WCAG asks for. What it cannot check is whether the survey is
 * *operable*, which is why `keyboard.spec.ts` beside this walks the hard question types
 * with nothing but a keyboard.
 */
async function violations(page: Page): Promise<readonly { id: string; nodes: number }[]> {
  const results = await new AxeBuilder({ page })
    .include('.kajay-theme')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((violation: Result) => ({
    id: violation.id,
    nodes: violation.nodes.length,
  }));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity/J5-axe: page one, the conditional-logic chain', async ({ page }) => {
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: page two, panels and triggers', async ({ page }) => {
  await gotoLogicShowcase(page);
  // With the conditional panel open, so the nested-panel markup is checked too.
  await page.getByLabel('paid').check();
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: page three, every question type', async ({ page }) => {
  await gotoQuestionTypes(page);
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: a page showing its errors', async ({ page }) => {
  // The state a respondent is most likely to need help in, and the one where an
  // unlabelled or unassociated message does the most damage.
  await page.getByRole('button', { name: 'Next' }).click();
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: the preview and the completed page', async ({ page }) => {
  await gotoQuestionTypes(page);
  await answerRequiredQuestionTypes(page);
  await page.getByRole('button', { name: 'Complete' }).click();

  await expect(page.getByRole('heading', { name: 'Check your answers' })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: right to left', async ({ page }) => {
  // The direction is where contrast and reading order most easily come apart, and it is
  // not a state anybody looks at while developing in English.
  await page.getByLabel('Language').selectOption('ar');
  expect(await violations(page)).toEqual([]);
});

test('parity/J5-axe: the dark theme', async ({ page }) => {
  // Contrast is a property of the palette, so the check has to run once per shipped
  // theme rather than once per survey.
  await page.getByLabel('Theme').selectOption('dark');
  expect(await violations(page)).toEqual([]);
});
