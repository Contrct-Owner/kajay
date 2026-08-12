/// <reference types="@vitest/browser/matchers" />
// **In the host application, because that is where the two halves meet.** The assembly
// lives in `@kajay/creator-react` and its layout lives in `@kajay/themes`, and neither
// package may depend on the other — the seam is deliberate and this test does not get to
// bend it. The reference application already depends on both, which makes it the only
// place the pair can be looked at together, and "what a host who renders the default
// assembly with our stylesheet actually gets" is the question it exists to answer.
//
// Here rather than in the end-to-end suite, where the site's other stylesheet claims live,
// because the site composes its *own* designer out of the pieces (ADR-0021) and never
// renders this assembly on a route. There is nothing for Playwright to point at.
//
// The claims are geometric because the bug was. The panel is a modal `<dialog>`, whose
// containing block is the viewport rather than anything it sits inside, so it takes the
// user agent's `content-box` unless told otherwise — and with `inline-size: 100%` that
// meant 100% *plus* padding and border: 390px of viewport holding a 424px panel, close
// button off the right edge, bottom 34px past its own height cap. Nothing in the DOM said
// so, and no assertion about markup would have caught it.
import '@kajay/themes/styles.css';
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';
import { page } from 'vitest/browser';
import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

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

test('parity/N1-compact: the panel fits the phone it opens on', async () => {
  await page.viewport(PHONE.width, PHONE.height);
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);
  await screen.getByTestId('open-toolbox').click();

  const panel = screen.container.ownerDocument.querySelector('[data-testid="panel-toolbox"]');
  const box = panel?.getBoundingClientRect();

  // Inside the viewport on both edges. It was 424px wide on a 390px screen, and the close
  // button was the part hanging off.
  expect(box?.left).toBeGreaterThanOrEqual(0);
  expect(Math.round(box?.right ?? 0)).toBeLessThanOrEqual(PHONE.width);

  // Anchored to the bottom, which is where a thumb is — `margin-block-start: auto` on a
  // dialog the user agent would otherwise centre.
  expect(Math.round(box?.bottom ?? 0)).toBe(PHONE.height);

  // And capped, so the top of the canvas stays visible behind it. A panel filling the
  // screen reads as a page you navigated to rather than something over what you were doing.
  expect(box?.height ?? 0).toBeLessThan(PHONE.height * 0.9);

  // The close button is reachable, not merely present: it was rendered the whole time it
  // was off the edge.
  const close = screen.getByTestId('panel-toolbox-close');
  await expect.element(close).toBeVisible();
  const closeBox = (await close.element()).getBoundingClientRect();
  expect(Math.round(closeBox.right)).toBeLessThanOrEqual(PHONE.width);
});

test('parity/N1-compact: the action bar sticks to the bottom of what is scrolling', async () => {
  await page.viewport(PHONE.width, PHONE.height);
  const screen = await render(<SurveyCreator value={BASIC} registry={registry()} />);

  const actions = screen.container.querySelector('.kajay-creator__actions');

  // Sticky rather than fixed: it pins to the bottom of whatever scrolls and lets go where
  // the designer ends, so a Creator embedded halfway down a host's page leaves no bar
  // floating over the rest of it. Fixed would have to be told about a host's layout, which
  // is the one thing an embedded component cannot know.
  expect(getComputedStyle(actions as Element).position).toBe('sticky');

  // Opaque, or the survey scrolls through it.
  expect(getComputedStyle(actions as Element).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
});
