import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Drag and drop against the real demo — checklist K2.
 *
 * The pointer half lives here because here the mouse is a real mouse: `setPointerCapture`
 * needs a live pointer, and a synthesised `pointerdown` has none. The keyboard half is a
 * browser test, and it is the half that decides whether this is operable at all.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

function surfaceOf(page: Page): Locator {
  return page.getByRole('region', { name: 'Design surface' });
}

/**
 * The canvas itself, not the whole panel around it.
 *
 * Scoped, because K4 put the page navigator in the same region and its pages carry the
 * same position marker the canvas elements do — deliberately, since one gesture reorders
 * both. `[data-element-index="1"]` inside the region therefore means two things.
 */
function canvasOf(page: Page): Locator {
  return surfaceOf(page).locator('.kajay-designer');
}

/** The order of the elements on the canvas, read off the adorners. */
async function orderOn(page: Page): Promise<readonly string[]> {
  const labels = await canvasOf(page)
    .locator('[data-element-index] .kajay-designer__select')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')?.replace('Select ', '') ?? ''),
    );
  return labels;
}

/**
 * Drags from one place to another with a real mouse.
 *
 * The destination is measured **after the press**, not before. Reading both boxes up
 * front looks tidier and is wrong: scrolling the destination into view moves the source,
 * so the press lands at coordinates that stopped being true a moment earlier. The
 * toolbox and the canvas are far enough apart on the demo page for that to matter.
 *
 * The extra move before the destination is what starts the drag at all. A press is also
 * how a designer focuses a handle before using the keyboard, so nothing begins until the
 * pointer has actually travelled.
 */
async function dragOnto(page: Page, from: Locator, to: Locator, at = 0.5): Promise<void> {
  const start = await pointIn(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  const end = await pointIn(to, at);
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

/**
 * A point down an element, in the coordinates `page.mouse` uses.
 *
 * Scrolled into view first, and the box read *after*. `boundingBox` reports viewport
 * coordinates and does not scroll — unlike `click()`, which does it for you — so the
 * designer sitting far down the demo page meant every drag was aimed at empty space
 * below the fold, and every one of them silently did nothing.
 */
async function pointIn(locator: Locator, at = 0.5): Promise<{ x: number; y: number }> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height * at };
}

test('parity/K2-drag: an item from the toolbox lands where it was dropped', async ({ page }) => {
  await dragOnto(
    page,
    page.getByTestId('toolbox-comment'),
    canvasOf(page).locator('[data-element-index="0"]'),
  );

  // A real question, wired: it went through `parseSurvey` like every other one, so it
  // has a name nothing else has taken and the host's saved definition contains it.
  const order = await orderOn(page);
  expect(order[0]).toBe('comment1');
  await expect(page.getByTestId('surface-json')).toContainText('comment1');
  await expect(page.getByTestId('surface-selected')).toHaveText('Selected comment1.');
});

test('parity/K2-drag: an element is moved by its handle', async ({ page }) => {
  const surface = surfaceOf(page);
  expect(await orderOn(page)).toEqual(['draftName', 'draftTier', 'draftScore']);

  await dragOnto(
    page,
    surface.getByRole('button', { name: 'Move draftName' }),
    canvasOf(page).locator('[data-element-index="2"]'),
    0.9,
  );

  // Dropped low on the last element, so it lands *after* it. The canvas is two columns
  // wide, where "past the halfway point downwards" would say nothing useful — the slot
  // is the nearest centre and then which side of it, which reads the same in a column
  // as in a row.
  expect(await orderOn(page)).toEqual(['draftTier', 'draftScore', 'draftName']);
});

test('parity/K2-drag: a two-column canvas is aimed left and right', async ({ page }) => {
  const surface = surfaceOf(page);
  const target = canvasOf(page).locator('[data-element-index="1"]');

  const start = await pointIn(surface.getByRole('button', { name: 'Move draftName' }));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  // Well to the right of draftTier's centre, and level with it: the demo page is
  // `colCount: 2`, so this element sits *beside* draftName rather than below it.
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  // "Past the halfway point downwards" would have said nothing here — the pointer never
  // went down. Which side of the nearest centre is decided along whichever axis it is
  // further out on, so the same code reads as above/below in a column and left/right in
  // a row without being told which it is looking at.
  expect(await orderOn(page)).toEqual(['draftTier', 'draftName', 'draftScore']);
});

test('parity/K2-drag: pressing a handle without moving is not a drag', async ({ page }) => {
  const surface = surfaceOf(page);
  const handle = surface.getByRole('button', { name: 'Move draftTier' });
  const at = await pointIn(handle);

  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();

  // Pressing a handle is also how a designer focuses it before using the keyboard. If
  // that began a placement, every such press would announce something grabbed and
  // instantly abandoned — a sentence in the live region for a thing that never happened.
  expect(await orderOn(page)).toEqual(['draftName', 'draftTier', 'draftScore']);
  await expect(surface.locator('.kajay-designer__announcement')).toBeEmpty();
  // The press did do one thing, and it is the right one: pressing an element selects it.
  await expect(page.getByTestId('surface-selected')).toHaveText('Selected draftTier.');
});

test('parity/K2-drag: the drop indicator shows where it would land', async ({ page }) => {
  const surface = surfaceOf(page);
  const handle = surface.getByRole('button', { name: 'Move draftName' });
  const target = canvasOf(page).locator('[data-element-index="2"]');

  const start = await pointIn(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  const end = await pointIn(target);
  await page.mouse.move(end.x, end.y, { steps: 8 });

  // Mid-drag: an indicator, and nothing moved. A Creator drag previews and commits once
  // (ADR-0009 decision 4), because applying each step would re-parse the survey and
  // rebuild the canvas under the pointer.
  await expect(canvasOf(page).locator('[data-drop-before="true"]')).toHaveCount(1);
  expect(await orderOn(page)).toEqual(['draftName', 'draftTier', 'draftScore']);

  // Dropped on the middle of the last element, so it lands *before* it — the indicator
  // was showing exactly where it went.
  await page.mouse.up();
  expect(await orderOn(page)).toEqual(['draftTier', 'draftName', 'draftScore']);
});

test('parity/K2-indicator: nothing is promised where nothing would happen', async ({ page }) => {
  const handle = surfaceOf(page).getByRole('button', { name: 'Move draftName' });
  const own = canvasOf(page).locator('[data-element-index="0"]');

  const start = await pointIn(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  const end = await pointIn(own);
  await page.mouse.move(end.x, end.y, { steps: 8 });

  // Hovering the position it already occupies. The model would refuse this drop, so
  // drawing a line there would be the interaction promising a move it is about to
  // decline. The keyboard never reaches this state — the arrows step over it — so a
  // pointer is the only thing that can find it.
  await expect(canvasOf(page).locator('[data-drop-before]')).toHaveCount(0);
  await expect(page.getByTestId('drop-at-end')).toBeHidden();

  await page.mouse.up();
  expect(await orderOn(page)).toEqual(['draftName', 'draftTier', 'draftScore']);
});

test('parity/K2-toolbox: clicking an item is the whole interaction', async ({ page }) => {
  await page.getByTestId('toolbox-comment').click();

  // The keyboard path, and the reason there is no aim-then-confirm mode to discover:
  // a click appends, and the element's own grab-and-move puts it where it belongs.
  const order = await orderOn(page);
  expect(order.at(-1)).toBe('comment1');
});
