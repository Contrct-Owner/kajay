import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Placement, with the shipped stylesheet — checklist K2 and P12.
 *
 * Its own file rather than more of P3's, because these are not claims about the playground:
 * the playground is simply the one place in this repository where the Creator runs with the
 * real CSS and a real mouse. Every scenario here is one the package's own browser suite
 * *cannot* make — where a placeholder ends up on screen, whether the page reflows around
 * it, whether the copy under the pointer tracks a pointer, and whether anything moves at
 * all — because reflow and motion are entirely the stylesheet's work and that suite loads
 * none.
 */
const PLAYGROUND = '/playground';

function canvas(page: Page) {
  return page.getByLabel('Editor');
}

/**
 * The drop placeholder — checklist K2, with the shipped stylesheet.
 *
 * These are the scenarios the package's own browser suite cannot run: the reflow *is* the
 * indicator, and reflow is entirely the stylesheet's work — a suite that loads no CSS can
 * prove where the placeholder went in the tree and nothing about where it went on screen.
 * The mouse here is a real mouse, so the pointer capture that carries a drag is under test
 * rather than stubbed.
 */
async function dragTo(
  page: Page,
  handle: string,
  target: string,
  at: number,
  across = 0.5,
): Promise<void> {
  const dropOn = canvas(page).locator(`[data-element-slot="${target}"]`);

  // **Scrolled into view first, because a pointer cannot leave the viewport.** The default
  // 1280×720 puts the last question's lower edge at y=737, so aiming at 90% of its height
  // meant aiming seventeen pixels past the bottom of the window — at nothing. Chromium
  // tolerated the out-of-bounds move and Firefox did not, which is how a scenario that had
  // been quietly aiming off-screen since it was written finally said so.
  await dropOn.scrollIntoViewIfNeeded();

  const grip = (await canvas(page).getByTestId(handle).boundingBox())!;
  const onto = (await dropOn.boundingBox())!;
  const bottom = page.viewportSize()?.height ?? 0;
  const aim = onto.y + onto.height * at;
  // Named rather than left to time out. A drag that misses is fifteen seconds of a locator
  // waiting for a placeholder that was never going to appear, and nothing saying why.
  expect(aim, 'the drag target must be inside the viewport').toBeLessThan(bottom);
  expect(grip.y, 'the drag handle must be inside the viewport').toBeLessThan(bottom);

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  // In steps, because one jump is one `pointermove` and a drag that only ever reports its
  // destination would pass while every intermediate aim was broken.
  await page.mouse.move(onto.x + onto.width * across, aim, { steps: 8 });
}

/**
 * Waits for the page to come to rest.
 *
 * Positions are only meaningful once nothing is still moving to them: a box measured
 * mid-settle is where an element is *passing through*, and asserting on one is a test that
 * races an animation it did not know about.
 */
async function atRest(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.kajay-designer [data-element-slot]')]
        .flatMap((node) => node.getAnimations())
        .every((animation) => animation.id !== 'kajay-settle' || animation.playState !== 'running'),
  );
}

test('parity/K2-placeholder: the drop opens the space it would take', async ({ page }) => {
  await page.goto(PLAYGROUND);
  const notes = canvas(page).locator('[data-element-slot="notes"]');
  const before = (await notes.boundingBox())!;

  await dragTo(page, 'move-name', 'notes', 0.9);
  await atRest(page);

  // Two halves of one claim, and neither is worth much alone: the placeholder has a real
  // box at the end of the list, and the question being carried has given its own box up —
  // so what is on screen mid-drag is the page the drop is about to produce rather than
  // that page plus a ghost of the one before it.
  const placeholder = canvas(page).getByTestId('drop-placeholder');
  await expect(placeholder).toBeVisible();
  expect((await placeholder.boundingBox())!.height).toBeGreaterThan(20);
  expect((await notes.boundingBox())!.y).toBeLessThan(before.y);

  await page.mouse.up();
  await expect(canvas(page).getByTestId('drop-placeholder')).toHaveCount(0);
  await expect(canvas(page).locator('[data-element-slot]').last()).toHaveAttribute(
    'data-element-slot',
    'name',
  );
});

test('parity/K2-placeholder: in two columns it takes a cell, not a row', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('editor-mode-json').click();
  await page.getByTestId('json-text').fill(
    JSON.stringify({
      pages: [
        {
          name: 'p1',
          // The layout the old indicator could not describe. A horizontal rule between two
          // rows says nothing about which of two side-by-side cells a drop belongs in, and
          // the end-of-list marker spanned every column — so it pointed at the whole row
          // whichever half was meant.
          colCount: 2,
          elements: [
            { type: 'text', name: 'a', title: 'A' },
            { type: 'text', name: 'b', title: 'B' },
            { type: 'text', name: 'c', title: 'C' },
            { type: 'text', name: 'd', title: 'D' },
          ],
        },
      ],
    }),
  );
  await page.getByTestId('json-apply').click();
  await page.getByTestId('editor-mode-design').click();

  // The *left* quarter of the last cell. Which axis decides is a question about the layout:
  // these two are on one row, so the list runs across here and the horizontal midpoint is
  // the one that means anything — the vertical rule that reads a column correctly would
  // make "before d" unreachable without leaving the row.
  await dragTo(page, 'move-a', 'd', 0.5, 0.25);
  await atRest(page);

  const placeholder = (await canvas(page).getByTestId('drop-placeholder').boundingBox())!;
  const surface = (await canvas(page).locator('.kajay-designer').boundingBox())!;
  const neighbour = (await canvas(page).locator('[data-element-slot="d"]').boundingBox())!;

  // A cell: about half the surface wide, and sharing a row with the element it landed
  // beside rather than sitting above it. Both assertions fail against a full-width bar,
  // which is what every version of this before it drew.
  expect(placeholder.width).toBeLessThan(surface.width * 0.75);
  expect(Math.abs(placeholder.y - neighbour.y)).toBeLessThan(8);
  expect(placeholder.x).toBeLessThan(neighbour.x);

  // And the other half of the same cell is the other side of it. Both boxes are measured
  // again, because the first aim is what put `d` where it is: a placeholder that takes a
  // cell moves everything after it, so a position captured before the move is a position
  // nothing is at any more.
  await page.mouse.move(neighbour.x + neighbour.width * 0.8, neighbour.y + neighbour.height / 2);
  await atRest(page);
  const moved = (await canvas(page).locator('[data-element-slot="d"]').boundingBox())!;
  const after = (await canvas(page).getByTestId('drop-placeholder').boundingBox())!;
  expect(after.x).toBeGreaterThan(moved.x);
  expect(Math.abs(after.y - moved.y)).toBeLessThan(8);
  await page.mouse.up();
});

test('parity/K2-ghost: what is being carried follows a real pointer', async ({ page }) => {
  await page.goto(PLAYGROUND);
  const ghost = canvas(page).getByTestId('drag-ghost');

  await dragTo(page, 'move-name', 'notes', 0.9);
  await atRest(page);

  // The question itself, drawn by its own renderer at the width it had — not a word
  // standing in for it. A canvas exists so a designer works on what they can see, and a
  // drag was the one moment the thing they were working on became a label.
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText('What is your name?');
  await expect(ghost.locator('input')).toHaveCount(1);
  const first = (await ghost.boundingBox())!;
  const carried = (await canvas(page).locator('[data-testid="drop-placeholder"]').boundingBox())!;
  expect(Math.abs(first.width - carried.width)).toBeLessThan(2);

  // Moved again, to somewhere with the *same* drop target: the ghost has to track the
  // pointer rather than the aim, or it would sit still through every move that does not
  // happen to change which slot is active — which is most of them.
  const notes = (await canvas(page).locator('[data-element-slot="notes"]').boundingBox())!;
  await page.mouse.move(notes.x + notes.width * 0.2, notes.y + notes.height * 0.95, { steps: 4 });
  const second = (await ghost.boundingBox())!;
  expect(second.x).toBeLessThan(first.x - 20);

  // **Hanging from where it was grabbed**, not with a corner snapped to the cursor. The
  // grip is at the element's left edge, so the pointer stays a grip's width inside the copy
  // for the whole drag — measured on the press, because by the first move the pointer has
  // left the element and an offset taken then is the distance to wherever it went.
  const pointer = { x: notes.x + notes.width * 0.2, y: notes.y + notes.height * 0.95 };
  expect(pointer.x - second.x).toBeGreaterThan(0);
  expect(pointer.x - second.x).toBeLessThan(60);
  expect(Math.abs(pointer.y - second.y)).toBeLessThan(60);

  await page.mouse.up();
  await expect(ghost).toBeHidden();
});

/**
 * Settling — checklist K2's motion.
 *
 * Only here, and for the reason the placeholder's own visual claims are only here: whether
 * anything moves is decided by the stylesheet, and the package's browser suite loads none.
 * A long duration is injected so the assertion is about whether an animation exists rather
 * than about whether the assertion won a race with it.
 */
const SLOW_SETTLE = '.kajay-designer { --kajay-settle-duration: 2s; }';

function settling(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('.kajay-designer [data-element-slot]')]
        .flatMap((node) => node.getAnimations())
        .filter((animation) => animation.id === 'kajay-settle').length,
  );
}

test('parity/K2-settle: the page moves into its new arrangement', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.addStyleTag({ content: SLOW_SETTLE });

  await dragTo(page, 'move-name', 'notes', 0.9);

  // A placeholder that takes a cell moves everything after it. Without this the page
  // teleports on every aim: a different arrangement each time the pointer crosses a
  // midpoint, and nothing to say what became what.
  expect(await settling(page)).toBeGreaterThan(0);
  await page.mouse.up();
});

test('parity/K2-settle: a host turns it off by saying so', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.addStyleTag({ content: '.kajay-designer { --kajay-settle-duration: 0; }' });

  await dragTo(page, 'move-name', 'notes', 0.9);

  // Motion is an offer, not an imposition ([ADR-0022](../../docs/adr/0022-design-system-primitives.md)):
  // the duration is a custom property, an unset one reads as zero, and zero skips the
  // measuring as well as the animating. The drop still lands — only the motion is gone.
  expect(await settling(page)).toBe(0);
  await page.mouse.up();
  await expect(canvas(page).locator('[data-element-slot]').last()).toHaveAttribute(
    'data-element-slot',
    'name',
  );
});

test('parity/K2-settle: reduced motion is the reader\'s answer, not the host\'s', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PLAYGROUND);
  await page.addStyleTag({ content: SLOW_SETTLE });

  await dragTo(page, 'move-name', 'notes', 0.9);

  // Asked in the adapter rather than left to a media query in the stylesheet, and the
  // distinction is the whole point: duration and easing are the host's to choose, and this
  // is not one of theirs. Somebody who has told their system they want less motion has
  // already answered, and a host who forgets the query must not be able to overrule them —
  // which is exactly what this scenario sets up, with a two-second duration asked for.
  expect(await settling(page)).toBe(0);
  await page.mouse.up();
});
