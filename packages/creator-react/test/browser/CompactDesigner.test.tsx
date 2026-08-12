/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';
import { page } from 'vitest/browser';
import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The default assembly when three columns will not fit — checklist N1.
 *
 * **The suite's stated viewport is a desktop one** (see `vitest.config.ts`), which is what
 * makes these scenarios possible to write at all: a test about the narrow layout has to ask
 * for a narrow window, and one that inherited whatever the runner picked would be a test
 * about nothing in particular. Every test here restores the desktop width afterwards, so
 * the file cannot leave a narrow window behind for whatever runs next.
 *
 * What this replaces: below 60rem the assembly used to stack its three panels, and stacking
 * put the toolbox *first*. A designer on a phone opened their survey and found thirty
 * question types where it should have been, then scrolled past all of them to reach it.
 */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

afterEach(async () => {
  await page.viewport(DESKTOP.width, DESKTOP.height);
});

test('parity/N1-compact: a narrow window gets the canvas, not the toolbox', async () => {
  await page.viewport(PHONE.width, PHONE.height);
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  // The survey is there to be worked on, and neither panel is in the way of it.
  await expect.element(screen.getByTestId('select-who')).toBeInTheDocument();

  // **Shown, not merely present.** The panels stay mounted inside their closed dialogs, so
  // asserting they are absent would be asserting the wrong thing — a closed `<dialog>` is
  // `display: none` by the user agent's own rule, which takes it out of the layout, out of
  // the tab order and out of the accessibility tree. That is what "not in the way" means
  // here, and it is what a designer experiences.
  await expect.element(screen.getByTestId('toolbox-comment')).not.toBeVisible();
  await expect.element(screen.getByTestId('open-toolbox')).toBeVisible();
  await expect.element(screen.getByTestId('open-properties')).toBeVisible();
});

test('parity/N1-compact: the toolbox opens as a modal panel and shuts on a pick', async () => {
  await page.viewport(PHONE.width, PHONE.height);
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  await screen.getByTestId('open-toolbox').click();
  const panel = screen.container.querySelector<HTMLDialogElement>(
    '[data-testid="panel-toolbox"]',
  );

  // **Modal, not merely visible.** `showModal()` is what brings the focus trap, Escape and
  // the inert background; a dialog React rendered with an `open` attribute would look
  // identical and have none of them. `:modal` is the only thing that tells them apart.
  expect(panel?.matches(':modal')).toBe(true);

  await screen.getByTestId('toolbox-comment').click();

  // Shut, because the point of picking is to see what landed — and it did land.
  expect(panel?.open).toBe(false);
  await expect.element(screen.getByTestId('select-comment1')).toBeInTheDocument();
});

test('parity/N1-compact: properties open from the element, and stay open while editing', async () => {
  await page.viewport(PHONE.width, PHONE.height);
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  // From the question itself — the affordance a compact layout otherwise loses, since a
  // button in a bar is about "the selection" while a designer is looking at one thing.
  await screen.getByTestId('select-who').click();
  await screen.getByTestId('actions-who').click();
  await screen.getByTestId('properties-who').click();

  const panel = screen.container.querySelector<HTMLDialogElement>(
    '[data-testid="panel-properties"]',
  );
  expect(panel?.matches(':modal')).toBe(true);

  // Editing properties is a run of changes against one element, so unlike the toolbox this
  // panel does not shut after each. One that did would be unusable.
  const title = screen.getByRole('textbox', { name: 'Title of who' });
  await title.fill('Your full name');
  expect(panel?.open).toBe(true);
});

test('parity/N1-compact: a desktop window still gets three panels beside each other', async () => {
  await page.viewport(DESKTOP.width, DESKTOP.height);
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  // The layout this has always had, unchanged — and no compact chrome anywhere near it.
  await expect.element(screen.getByTestId('toolbox-comment')).toBeInTheDocument();
  await expect.element(screen.getByTestId('select-who')).toBeInTheDocument();
  expect(screen.container.querySelector('.kajay-properties')).not.toBeNull();
  expect(screen.container.querySelector('[data-testid="open-toolbox"]')).toBeNull();

  // And no "Properties" in the element's menu, because the grid is already on screen: an
  // item that reopened what you are looking at is a second way to do nothing.
  await screen.getByTestId('select-who').click();
  await screen.getByTestId('actions-who').click();
  expect(screen.container.querySelector('[data-testid="properties-who"]')).toBeNull();
});
