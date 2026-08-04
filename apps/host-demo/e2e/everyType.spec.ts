import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The overall acceptance scenario, end to end — checklist N5.
 *
 * Build a survey covering every type in the Creator, render it, answer it, submit it, and
 * find the definition unchanged when the designer comes back to it. The headless proof
 * makes the exhaustive claims and the browser proof makes the rendering one; what only
 * this can show is that the **loop closes** — through the same component, in one page, the
 * way a host has it.
 *
 * It reuses N1's embedded Creator rather than adding a second one. Two Creators on a page
 * is a demo artefact this application has been bitten by twice (M3, N1), and this row does
 * not need a third.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('toggle-embed').click();
  await page.getByTestId('load-every-type').click();
});

function embed(page: Page): Locator {
  return page.getByRole('region', { name: 'Embedded creator' });
}

/** One element's own corner of the page, wherever it is being drawn. */
function slot(page: Page, name: string): Locator {
  return embed(page).locator(`[data-element-slot="${name}"]`);
}

/**
 * The element names in the survey the demo just built, read out of the host's own state.
 *
 * Derived rather than listed, for the reason the whole row is: this scenario must cover
 * whatever the toolbox holds on the day it runs, and a list written here would go stale
 * the first time somebody registered a type.
 */
async function elementNames(page: Page): Promise<readonly string[]> {
  const json = await embed(page).getByTestId('embed-value').textContent();
  const definition = JSON.parse(json ?? '{}') as {
    pages?: readonly { elements?: readonly { name: string }[] }[];
  };
  const names = (definition.pages?.[0]?.elements ?? []).map((element) => element.name);
  expect(names.length).toBeGreaterThan(15);
  return names;
}

/** Every element the host's state names is adorned on the canvas, by that name. */
async function expectAllOnCanvas(page: Page): Promise<void> {
  const names = await elementNames(page);
  await Promise.all(
    names.map((name) => expect(embed(page).getByTestId(`select-${name}`)).toBeVisible()),
  );
}

test('parity/N5-round-trip: every type the toolbox offers is on the canvas', async ({ page }) => {
  await expectAllOnCanvas(page);
  // The dispatcher's own answer for a type it cannot draw. A missing renderer is invisible
  // to the model — the survey parses, the definition round-trips, the answers land — so
  // this is the only place the difference shows.
  await expect(embed(page).locator('.kajay-question--unsupported')).toHaveCount(0);
});

test('parity/N5-round-trip: the survey renders, is answered and submits', async ({ page }) => {
  await embed(page).getByTestId('creator-tab-preview').click();
  await expect(embed(page).getByTestId('preview-frame')).toBeVisible();
  await expect(embed(page).locator('.kajay-question--unsupported')).toHaveCount(0);

  // A designer who dropped one of everything and changed nothing can answer it. Before this
  // row they could not: the toolbox created every choice question with no choices, so the
  // radio group below had a label and nothing under it.
  //
  // Addressed by slot rather than by `.first()`. Twenty-one questions on one page is
  // precisely the situation where "the first radio" is not the one you meant — here it was
  // the image picker's, which is a radio group too.
  await slot(page, 'text1').getByRole('textbox').fill('An answer typed in the preview');
  await slot(page, 'radiogroup1').getByRole('radio', { name: 'Item 2' }).check();
  await embed(page).getByRole('button', { name: 'Complete' }).click();

  await expect(embed(page).locator('.kajay-survey--completed')).toBeVisible();
});

test('parity/N5-round-trip: the definition comes back into the Creator unchanged', async ({
  page,
}) => {
  const before = await embed(page).getByTestId('embed-value').textContent();

  await embed(page).getByTestId('creator-tab-preview').click();
  await expect(embed(page).getByTestId('preview-frame')).toBeVisible();
  await slot(page, 'text1').getByRole('textbox').fill('Answered, then abandoned');
  await embed(page).getByRole('button', { name: 'Complete' }).click();
  await expect(embed(page).locator('.kajay-survey--completed')).toBeVisible();
  await embed(page).getByTestId('creator-tab-design').click();

  // **A response is not an edit.** M3 made the preview parse its own survey for exactly
  // this: answering questions in it must leave the document alone, or a designer trying
  // their own form would be writing test data into what they ship.
  await expect(embed(page).getByTestId('embed-value')).toHaveText(before ?? '');
  await expectAllOnCanvas(page);
});

test('parity/N5-round-trip: what came back is still editable', async ({ page }) => {
  await embed(page).getByTestId('creator-tab-preview').click();
  await expect(embed(page).getByTestId('preview-frame')).toBeVisible();
  await embed(page).getByTestId('creator-tab-design').click();

  await embed(page).getByTestId('select-matrix1').click();

  // Unchanged JSON is not the same claim as a usable document. A matrix is the type this
  // has to be asked of: it is the one the canvas could not draw at all until this row —
  // `<Survey>` supplied the renderer registry to questions that contain questions and the
  // designer did not, so a matrix on a canvas threw.
  await expect(embed(page).getByTestId('property-matrix1-title')).toBeVisible();
  await embed(page).getByLabel('Title of matrix1').fill('How strongly do you agree?');
  await expect(embed(page).getByTestId('embed-value')).toContainText(
    'How strongly do you agree?',
  );
});
