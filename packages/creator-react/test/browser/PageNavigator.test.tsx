/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { DesignSurfacePanel, PageNavigatorPanel, useDesignerPlacement } from '@kajay/creator-react';
import { userEvent } from '@vitest/browser/context';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/** Page management — checklist K4. */
const THREE: SurveyDefinition = {
  pages: [
    { name: 'p1', title: 'Getting started', elements: [{ type: 'text', name: 'who' }] },
    { name: 'p2', elements: [{ type: 'text', name: 'why' }] },
    { name: 'p3', elements: [] },
  ],
};

function surface(definition: SurveyDefinition = THREE): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function Harness({ designed }: { readonly designed: DesignSurface }): ReactElement {
  const placement = useDesignerPlacement(designed);
  return (
    <>
      <PageNavigatorPanel surface={designed} placement={placement} />
      <DesignSurfacePanel surface={designed} placement={placement} />
    </>
  );
}

function pageOrder(designed: DesignSurface): readonly string[] {
  return designed.pages.map((page) => page.name);
}

test('parity/K4-navigate: a page is opened by clicking it', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByTestId('go-to-p2').click();

  // The question on the new page is drawn by the real renderer, same as K3's.
  expect(designed.page?.name).toBe('p2');
  await expect.element(screen.getByLabelText('why', { exact: true })).toBeInTheDocument();
});

test('parity/K4-navigate: the open page says so, not only in colour', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  // `aria-current` — which page is open is the most important thing this list says,
  // and it has to survive being read aloud.
  await expect.element(screen.getByTestId('go-to-p1')).toHaveAttribute('aria-current', 'page');
  await screen.getByTestId('go-to-p2').click();
  await expect.element(screen.getByTestId('go-to-p2')).toHaveAttribute('aria-current', 'page');
  expect(screen.getByTestId('go-to-p1').element().getAttribute('aria-current')).toBeNull();
});

test('parity/K4-navigate: a page with no title is listed by its name', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  // A page's title is genuinely optional — a page without one renders without one for a
  // respondent (E1). A blank row here would be unreachable by name for anybody
  // navigating by voice or by screen reader.
  await expect.element(screen.getByTestId('go-to-p1')).toHaveTextContent('Getting started');
  await expect.element(screen.getByTestId('go-to-p2')).toHaveTextContent('p2');
});

test('parity/K4-add-page: adding one opens it', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByTestId('add-page').click();

  expect(pageOrder(designed)).toEqual(['p1', 'p2', 'p3', 'page1']);
  await expect.element(screen.getByTestId('go-to-page1')).toHaveAttribute('aria-current', 'page');
});

test('parity/K4-remove-page: deleting the open page lands on its neighbour', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  await screen.getByTestId('go-to-p2').click();

  await screen.getByTestId('remove-p2').click();

  expect(pageOrder(designed)).toEqual(['p1', 'p3']);
  expect(designed.page?.name).toBe('p3');
});

test('parity/K4-remove-page: the last one can go, and the canvas says so', async () => {
  const designed = surface({ pages: [{ name: 'only', elements: [] }] });
  const screen = await render(<Harness designed={designed} />);

  await screen.getByTestId('remove-only').click();

  // Refusing would mean a designer cannot delete a page without first adding a
  // replacement — and this is the state every new survey starts in.
  expect(pageOrder(designed)).toEqual([]);
  await expect.element(screen.getByRole('status')).toHaveTextContent('no pages yet');
});

test('parity/K4-reorder-pages: grab, move, drop — the same keys as a question', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByTestId('move-page-p1').click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{ }');

  // Space grabs, arrows move, space drops. Reordering pages needed no second
  // implementation, because a slot names its list.
  expect(pageOrder(designed)).toEqual(['p2', 'p1', 'p3']);
});

test('parity/K4-reorder-pages: escape abandons and changes nothing', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByTestId('move-page-p1').click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{End}');
  await userEvent.keyboard('{Escape}');

  expect(pageOrder(designed)).toEqual(['p1', 'p2', 'p3']);
});

test('parity/K4-reorder-pages: dragging a page leaves the canvas alone', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  // p3 aimed at the *start* of the page list, which is slot 0 — deliberately a number
  // the canvas also has an element at. An assertion whose two lists could not collide
  // would pass however the indicator was computed, and one did: this test survived a
  // mutant that dropped the check entirely.
  await screen.getByTestId('move-page-p3').click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{Home}');

  expect(screen.container.querySelectorAll('.kajay-pages [data-drop-before]')).toHaveLength(1);
  expect(screen.container.querySelectorAll('.kajay-designer [data-drop-before]')).toHaveLength(0);
});

test('parity/K4-reorder-pages: dragging a question leaves the page list alone', async () => {
  const designed = surface({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'who' },
          { type: 'text', name: 'why' },
          { type: 'text', name: 'when' },
        ],
      },
      { name: 'p2', elements: [] },
      { name: 'p3', elements: [] },
    ],
  });
  const screen = await render(<Harness designed={designed} />);

  // The mirror of the test above, and needed for the same reason: one placement drives
  // both lists, so each indicator has to check that the slot is aimed at *its* list.
  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');

  expect(screen.container.querySelectorAll('.kajay-designer [data-drop-before]')).toHaveLength(1);
  expect(screen.container.querySelectorAll('.kajay-pages [data-drop-before]')).toHaveLength(0);
});

test('parity/K4-page-adorner: the page has a title editor of its own', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByTestId('select-page-p1').click();
  await screen.getByLabelText('Title of page p1').fill('Before we begin');

  // A page is a selectable thing in its own right, not just the container its questions
  // arrived in — and the editor sits beside the heading rather than over it, K3's
  // decision applied to the one element K3 could not select.
  expect(designed.selected?.getPropertyValue('name')).toBe('p1');
  await expect.element(screen.getByTestId('go-to-p1')).toHaveTextContent('Before we begin');
});
