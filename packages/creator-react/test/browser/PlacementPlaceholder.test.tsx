/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';
import { DesignSurfacePanel, ToolboxPanel, useDesignerPlacement } from '@kajay/creator-react';
import { userEvent } from 'vitest/browser';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'plan', title: 'Which plan?' },
        { type: 'text', name: 'why', title: 'Why?' },
      ],
    },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function Harness({ designed }: { readonly designed: DesignSurface }): ReactElement {
  const placement = useDesignerPlacement(designed);
  return (
    <>
      <ToolboxPanel toolbox={new Toolbox()} getItemProps={placement.getItemProps} />
      <DesignSurfacePanel surface={designed} placement={placement} />
    </>
  );
}

/**
 * The placeholder — checklist K2's indicator, rebuilt.
 *
 * These are the *structural* claims: which container the placeholder joins, where in it,
 * what it says, and that the element standing aside is still the element it was. The
 * claim they cannot make is the visual one — that the page reflows around it — because
 * no stylesheet is loaded here and reflow is entirely the stylesheet's work. That belongs
 * to the playground E2E, where the shipped CSS is.
 */
function placedOrder(container: HTMLElement): readonly string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-element-slot], [data-testid="drop-placeholder"]',
    ),
  ).map((node) => node.dataset['elementSlot'] ?? `<${node.dataset['dropIndex'] ?? '?'}>`);
}

test('parity/K2-placeholder: it joins the container it would land in, at the right place', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');

  // A sibling of the slots rather than a child of one, which is the whole point: a
  // container here is a grid whose items are the slots, so only something the container
  // lays out itself can take a cell — and only something with a cell can show a drop
  // landing *beside* an element rather than merely between two rows.
  expect(placedOrder(screen.container)).toEqual(['who', 'plan', '<2>', 'why']);
});

test('parity/K2-placeholder: the element standing aside keeps the handle driving the drag', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = screen.getByRole('button', { name: 'Move who' });
  const node = handle.element();

  await handle.click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');

  // Withdrawn by attribute, never by unmounting. Taking the element out of the tree is the
  // obvious way to take it out of the layout and it would end the gesture: this node is
  // holding the pointer capture that a drag is being delivered through, and React would
  // have destroyed it. Node identity is the only assertion that can tell the two apart.
  expect(screen.container.querySelector('[data-withdrawn="true"] [data-element-slot="who"]'))
    .not.toBeNull();
  expect(screen.getByRole('button', { name: 'Move who' }).element()).toBe(node);
});

test('parity/K2-placeholder: it reserves the room the element being carried needs', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  // Measured after the element is selected, because that is the state it is in when the
  // grab happens — selecting it opens the action row and makes it taller. The size that
  // matters is the one the element has at the moment it is picked up.
  await screen.getByRole('button', { name: 'Move who' }).click();
  const carried = screen.container.querySelector<HTMLElement>('[data-element-slot="who"]')!;
  const height = carried.getBoundingClientRect().height;

  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');

  // Measured at the grab, before anything stood aside. Measuring later would measure an
  // element that has already given up its box, and the placeholder would reserve nothing —
  // so the page would settle into a layout the drop does not produce and jump on commit.
  const placeholder = screen.container.querySelector<HTMLElement>(
    '[data-testid="drop-placeholder"]',
  )!;
  expect(placeholder.style.getPropertyValue('--kajay-placeholder-height')).toBe(`${height}px`);
  expect(height).toBeGreaterThan(0);
});

test('parity/K2-placeholder: a toolbox drag holds a place for the thing it would add', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const item = screen.getByTestId('toolbox-rating').element() as HTMLElement;
  const target = screen.container.querySelector<HTMLElement>('[data-element-slot="plan"]')!;
  const rect = target.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    pointerId: 88,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height * 0.1,
  };
  Object.defineProperty(item, 'setPointerCapture', { value: (): undefined => undefined });

  item.dispatchEvent(new PointerEvent('pointerdown', pointer));
  item.dispatchEvent(new PointerEvent('pointermove', pointer));

  // Nothing is withdrawn, because a new element is not anywhere yet — and the placeholder
  // says what it is holding room for, which is the one thing a designer dragging from the
  // toolbox cannot otherwise see: the canvas has no copy of it to look at.
  await expect.element(screen.getByTestId('drop-placeholder')).toHaveTextContent('Rating');
  expect(screen.container.querySelectorAll('[data-withdrawn="true"]')).toHaveLength(0);
  expect(placedOrder(screen.container)).toEqual(['who', '<1>', 'plan', 'why']);
});
