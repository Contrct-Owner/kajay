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
    // A real drag reports the button holding it, and the adapter now checks: a move with
    // no button down is how it recognises a release that landed somewhere it could not see.
    buttons: 1,
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

/**
 * The ghost — what the pointer is carrying.
 *
 * Structural again: that it is the question rather than a word standing for one, that the
 * copy does not collide with the original, that a keyboard drag summons none, and that it
 * is measurable before the drag it is going to follow. That it *tracks* the pointer is the
 * playground's, where a real mouse produces real coordinates.
 */
test('parity/K2-ghost: a pointer drag carries the question itself', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = screen.getByRole('button', { name: 'Move who' }).element() as HTMLElement;
  const target = screen.container.querySelector<HTMLElement>('[data-element-slot="why"]')!;
  const rect = target.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    // A real drag reports the button holding it, and the adapter now checks: a move with
    // no button down is how it recognises a release that landed somewhere it could not see.
    buttons: 1,
    pointerId: 91,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height * 0.9,
  };
  Object.defineProperty(handle, 'setPointerCapture', { value: (): undefined => undefined });

  // Mounted and measurable *before* anything is carried, which is the point: where a fixed
  // node's coordinates start from depends on the host's ancestors, and that is answered by
  // measuring this element at the grab rather than a frame into the gesture.
  const ghost = screen.container.querySelector<HTMLElement>('[data-testid="drag-ghost"]')!;
  expect(ghost.dataset['carrying']).toBeUndefined();

  handle.dispatchEvent(new PointerEvent('pointerdown', pointer));
  handle.dispatchEvent(new PointerEvent('pointermove', pointer));

  // **The question, drawn by its own renderer** — its title and its control, not a word
  // standing in for them. A canvas exists so a designer works on what they can see, and a
  // drag was the one moment the thing they were working on became a label.
  await expect.element(screen.getByTestId('drag-ghost')).toHaveTextContent('Your name');
  expect(ghost.querySelectorAll('input')).toHaveLength(1);
  expect(ghost.dataset['carrying']).toBe('true');
  // Carried at the width it had, because a copy has left the grid that was giving it one.
  expect(ghost.style.getPropertyValue('--kajay-ghost-width')).toMatch(/^\d+(\.\d+)?px$/u);

  const carriedTo = ghost.style.getPropertyValue('--kajay-ghost-y');
  handle.dispatchEvent(new PointerEvent('pointerup', pointer));

  // Let go on drop — and left exactly where it was, on purpose. The element it was carrying
  // has been invisible for the whole drag, so the ghost's last position is the only record
  // of where that question was on screen, and the settle animation is measured from it.
  // The next drag re-anchors before it measures, so nothing is left stale.
  await expect.poll(() => ghost.dataset['carrying']).toBeUndefined();
  expect(ghost.style.getPropertyValue('--kajay-ghost-y')).toBe(carriedTo);
});

test('parity/K2-ghost: a keyboard drag summons nothing to follow', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');

  // The placement is identical — the model cannot tell these apart, and correctly so. What
  // differs is that there is no pointer, and a ghost parked in the corner of the screen for
  // the length of a keyboard walk would be furniture rather than feedback.
  await expect.element(screen.getByTestId('drop-placeholder')).toBeInTheDocument();
  expect(
    screen.container.querySelector<HTMLElement>('[data-testid="drag-ghost"]')?.dataset['carrying'],
  ).toBeUndefined();
});

test('parity/K2-ghost: the copy does not take the original question ids', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = screen.getByRole('button', { name: 'Move who' }).element() as HTMLElement;
  const target = screen.container.querySelector<HTMLElement>('[data-element-slot="why"]')!;
  const rect = target.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    // A real drag reports the button holding it, and the adapter now checks: a move with
    // no button down is how it recognises a release that landed somewhere it could not see.
    buttons: 1,
    pointerId: 92,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height * 0.9,
  };
  Object.defineProperty(handle, 'setPointerCapture', { value: (): undefined => undefined });

  handle.dispatchEvent(new PointerEvent('pointerdown', pointer));
  handle.dispatchEvent(new PointerEvent('pointermove', pointer));

  // **This is what makes a copy legal**, and the reason a ghost like this could not have
  // been written before `IdScopeProvider`. Two renderings of one question emit one set of
  // ids without it, so the document has duplicates and every `<label for>` in the second
  // resolves to the first — P7's defect, reintroduced by the picture of the question.
  await expect.element(screen.getByTestId('drag-ghost')).toHaveTextContent('Your name');
  const ghosted = [
    ...screen.container.querySelectorAll<HTMLElement>('[data-testid="drag-ghost"] [id]'),
  ];
  const ids = [...screen.container.querySelectorAll<HTMLElement>('[id]')].map((node) => node.id);
  // The ghost has to actually carry ids, or uniqueness below is a claim about nothing.
  expect(ghosted.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);

  // And nothing inside it is reachable: it is a picture, so it takes no focus and answers
  // no pointer, beside a live region that is already narrating the drag.
  const ghost = screen.container.querySelector<HTMLElement>('[data-testid="drag-ghost"]')!;
  expect(ghost.getAttribute('inert')).not.toBeNull();
  expect(ghost.getAttribute('aria-hidden')).toBe('true');
});

test('parity/K2-ghost: a toolbox drag carries the type, which is all there is yet', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const item = screen.getByTestId('toolbox-rating').element() as HTMLElement;
  const target = screen.container.querySelector<HTMLElement>('[data-element-slot="plan"]')!;
  const rect = target.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    // A real drag reports the button holding it, and the adapter now checks: a move with
    // no button down is how it recognises a release that landed somewhere it could not see.
    buttons: 1,
    pointerId: 93,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height * 0.1,
  };
  Object.defineProperty(item, 'setPointerCapture', { value: (): undefined => undefined });

  item.dispatchEvent(new PointerEvent('pointerdown', pointer));
  item.dispatchEvent(new PointerEvent('pointermove', pointer));

  // Not a shortcut: a new element has not been created, so there is no rendered question to
  // copy. What the drag is carrying is the *type*, and its name is what represents it.
  await expect.element(screen.getByTestId('drag-ghost')).toHaveTextContent('Rating');
  expect(
    screen.container.querySelectorAll('[data-testid="drag-ghost"] input'),
  ).toHaveLength(0);
});

test('parity/K2-aim: in a column the halves of an element decide, wherever you are across it', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const handle = screen.getByRole('button', { name: 'Move who' }).element() as HTMLElement;
  const last = screen.container.querySelector<HTMLElement>('[data-element-slot="why"]')!;
  const rect = last.getBoundingClientRect();
  Object.defineProperty(handle, 'setPointerCapture', { value: (): undefined => undefined });

  // **The bottom half of the last element, hard against its left edge.** The axis used to
  // be whichever one the pointer was further out on, and an element is as wide as the
  // canvas — so from here `|dx|` beat `|dy|` and the answer became *left of centre*, which
  // in a single column means nothing at all. Aiming at the end of a list meant dropping far
  // enough below the last question to out-distance however far sideways you happened to be.
  const pointer = {
    bubbles: true,
    // A real drag reports the button holding it, and the adapter now checks: a move with
    // no button down is how it recognises a release that landed somewhere it could not see.
    buttons: 1,
    pointerId: 94,
    clientX: rect.left + 4,
    clientY: rect.top + rect.height * 0.75,
  };
  handle.dispatchEvent(new PointerEvent('pointerdown', pointer));
  handle.dispatchEvent(new PointerEvent('pointermove', pointer));

  await expect.poll(() => designed.placement.snapshot.activeSlot?.index).toBe(3);
  expect(placedOrder(screen.container)).toEqual(['who', 'plan', 'why', '<3>']);
});
