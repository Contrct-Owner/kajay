import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The playground — checklist P3.
 *
 * **Against the built SSR artifact**, not a dev server: `vite preview` serves what
 * TanStack Start emits, so the first paint here is server-rendered and P1 is under test
 * rather than asserted. A dev server would prove the components work; this proves the
 * deployment does.
 *
 * These scenarios assert the claims the row makes, in the row's own order: the panes are
 * one document, the JSON is the same document as the canvas, a link is the whole artefact,
 * and the two token systems move together.
 */
const PLAYGROUND = '/playground';

function canvas(page: Page) {
  return page.getByLabel('Editor');
}

function live(page: Page) {
  return page.getByTestId('live-survey');
}

test('parity/P3-playground: the page is served, the Creator is not', async ({ page }) => {
  const response = await page.goto(PLAYGROUND);
  const html = (await response?.text()) ?? '';

  // **The playground is deliberately client-only**, and the served document says so: a
  // shell, with none of the route in it. A design surface has to measure things before it
  // can draw them, so it waits for a DOM.
  expect(html).not.toContain('What is your name?');
  expect(html.length).toBeLessThan(8000);

  // So P1's server-rendered *survey* has no proof here. It is covered by
  // `parity/P1-server-rendering` at the unit level, and gets an end-to-end one when the
  // marketing page puts a real survey on a served route.
  await expect(live(page).getByText('What is your name?')).toBeVisible();
});

test('parity/P3-playground: the designer and the live survey are one document', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  await page.getByTestId('toolbox-rating').click();

  // Dropped on the canvas, answerable on the right, with nothing wired between them: both
  // panes come off one `CreatorWorkspace`, and M3's preview session watches the surface
  // itself. This is the claim the whole layout exists to make.
  await expect(canvas(page).getByTestId('select-rating1')).toBeVisible();
  await expect(live(page).getByRole('group', { name: /rating1/iu })).toBeVisible();
});

test('parity/P3-playground: answering the live survey never reaches what is being designed', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);

  // By label, which is how a respondent finds it. This scenario could not do that until
  // P7: the designer and the live survey are two parses of one definition, and both used
  // to emit `id="kajay-question-name"`, so every `<label for>` here resolved to the
  // designer's input.
  await live(page).getByLabel('What is your name?').fill('Ada');

  // The preview parses its own survey, so an answer is a *response* and cannot become part
  // of the definition. Switching to the JSON is the shortest way to see that it did not.
  await page.getByTestId('editor-mode-json').click();
  await expect(page.getByTestId('json-text')).not.toContainText('Ada');
});

test('parity/P3-playground: editing the JSON shows up on the canvas', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('editor-mode-json').click();

  const editor = page.getByTestId('json-text');
  await editor.fill(
    JSON.stringify({ pages: [{ name: 'p1', elements: [{ type: 'text', name: 'only' }] }] }),
  );
  await page.getByTestId('json-apply').click();
  await page.getByTestId('editor-mode-design').click();

  // One surface behind both views — M2's session applies through the same `applyEdit` K6's
  // undo stack wraps, so this is a view change rather than a document handover.
  await expect(canvas(page).getByTestId('select-only')).toBeVisible();
  await expect(canvas(page).getByTestId('select-name')).toHaveCount(0);
});

test('parity/P3-playground: a link is the whole artefact', async ({ page, context }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('toolbox-rating').click();
  await page.getByTestId('share-link').click();

  // Read from the address bar rather than the clipboard: clipboard *reads* need a
  // permission grant that says nothing about the feature, and the link the button copies is
  // the URL the page is already on.
  await expect(page).toHaveURL(/\?d=/u);
  const shared = page.url();

  // Opened in a *different tab* with no shared memory: nothing is stored server-side, so
  // the link carrying the definition is the only way this can work.
  const opened = await context.newPage();
  await opened.goto(shared);
  await expect(opened.getByTestId('live-survey')).toContainText('What is your name?');
  await expect(opened.getByLabel('Editor').getByTestId('select-rating1')).toBeVisible();
  await opened.close();
});

test('parity/P3-playground: a damaged link opens the playground rather than an error', async ({
  page,
}) => {
  await page.goto(`${PLAYGROUND}?d=not-base64-at-all`);

  // Chat clients truncate URLs. Somebody arriving at half of one wants a playground, not a
  // diagnosis of somebody else's paste — and the definition is the only thing lost.
  await expect(live(page).getByText('What is your name?')).toBeVisible();
});

test('parity/P3-playground: one toggle moves both token systems', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('theme-toggle').click();

  // The site's own tokens are shadcn's and the survey's are Kajay's — two systems, and a
  // host who switched only one would have a dark page with a white survey in it. That the
  // seam needs a host to do this deliberately is the finding; that it is one line is why
  // it is acceptable.
  await expect(page.locator('html')).toHaveClass(/dark/u);
  await expect(page.locator('html')).toHaveAttribute('data-kajay-theme', 'dark');
});

test('parity/P3-playground: pages can be added and switched between', async ({ page }) => {
  await page.goto(PLAYGROUND);

  // Arranging the pieces by hand means arranging *all* of them. The playground shipped
  // without the page navigator, so there was no way to add a page — a gap in the
  // reference application rather than in the library, and invisible until somebody
  // looked for the button.
  await canvas(page).getByTestId('add-page').click();

  // Named `page1` by `uniqueName`, not `p2` — the seeded page's name is the site's, and
  // the Creator does not try to guess a series from it.
  await expect(canvas(page).getByTestId('go-to-page1')).toBeVisible();

  // The new page is the one being designed, and it is empty: a designer adds a page in
  // order to put something on it, and one that appeared somewhere off-screen would need
  // finding first.
  await expect(canvas(page).getByTestId('select-name')).toHaveCount(0);

  await canvas(page).getByTestId('go-to-p1').click();
  await expect(canvas(page).getByTestId('select-name')).toBeVisible();
});

test('parity/P3-playground: undo is on screen, not only on the keyboard', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await page.getByTestId('toolbox-rating').click();
  await expect(canvas(page).getByTestId('select-rating1')).toBeVisible();

  await canvas(page).getByRole('button', { name: 'Undo' }).click();

  // K6 bound Ctrl+Z as well, and a Creator that only had the shortcut would be one most
  // people never discovered they could undo in.
  await expect(canvas(page).getByTestId('select-rating1')).toHaveCount(0);
});

test('parity/P3-playground: the sidebar scrolls without taking the canvas with it', async ({
  page,
}) => {
  await page.goto(PLAYGROUND);
  await canvas(page).getByTestId('select-name').click();

  const sidebar = page.getByTestId('pane-properties').locator('xpath=ancestor::*[@data-slot="accordion"]');
  const before = await canvas(page).getByTestId('select-name').boundingBox();
  await sidebar.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const after = await canvas(page).getByTestId('select-name').boundingBox();

  // Reaching a property near the bottom used to mean scrolling the page, which scrolled
  // the canvas away — so a designer was editing something they could no longer see.
  expect(after?.y).toBe(before?.y);
});

test('parity/P3-playground: the page says how to start', async ({ page }) => {
  await page.goto(PLAYGROUND);

  // The subtitle described the layout and left the one thing nobody arrives knowing unsaid:
  // that clicking a type is how anything happens. A demonstration nobody can start is a
  // screenshot.
  // Not `getByRole('banner')`: a `<header>` inside `<main>` is not a landmark, which is
  // correct HTML and a thing worth getting wrong only once.
  await expect(page.getByText('Click a question type to add it')).toBeVisible();
});

test('parity/P3-playground: it says what it did unasked', async ({ page }) => {
  await page.goto(PLAYGROUND);
  await canvas(page).getByTestId('select-name').click();
  // Copy and Paste live in P4's overflow menu now, which is why the adorner stopped
  // overflowing the canvas.
  await canvas(page).getByTestId('actions-name').click();
  await page.getByTestId('copy-name').click();
  await canvas(page).getByTestId('actions-name').click();
  await page.getByTestId('paste-name').click();

  // P6 built the announcement channel and this page dropped every one on the floor, so the
  // application demonstrating ADR-0023 was the one place staying silent. A paste that
  // renumbers a name is exactly the case: the designer goes looking for `name`.
  await expect(page.getByRole('status')).toContainText('Names already in use were renumbered');
});

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
  const grip = (await canvas(page).getByTestId(handle).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  const onto = (await canvas(page).locator(`[data-element-slot="${target}"]`).boundingBox())!;
  // In steps, because one jump is one `pointermove` and a drag that only ever reports its
  // destination would pass while every intermediate aim was broken.
  await page.mouse.move(onto.x + onto.width * across, onto.y + onto.height * at, { steps: 8 });
}

test('parity/K2-placeholder: the drop opens the space it would take', async ({ page }) => {
  await page.goto(PLAYGROUND);
  const notes = canvas(page).locator('[data-element-slot="notes"]');
  const before = (await notes.boundingBox())!;

  await dragTo(page, 'move-name', 'notes', 0.9);

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
