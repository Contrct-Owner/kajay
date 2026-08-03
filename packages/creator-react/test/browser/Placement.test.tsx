/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';
import { DesignSurfacePanel, ToolboxPanel, useDesignerPlacement } from '@kajay/creator-react';
import { userEvent } from '@vitest/browser/context';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Drag and drop — checklist K2.
 *
 * The keyboard half lives here, because it is the half that has to work without a
 * pointer and the half a browser can drive honestly. The pointer half is an E2E
 * scenario, where the mouse is a real mouse.
 */
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
      <ToolboxPanel
        toolbox={new Toolbox()}
        getItemProps={placement.getItemProps}
      />
      <DesignSurfacePanel surface={designed} placement={placement} />
    </>
  );
}

function orderOn(designed: DesignSurface): readonly string[] {
  return (designed.page?.elements ?? []).map((element) => element.name);
}

test('parity/K2-keyboard: grab, move, drop', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{ }');

  // The ranking question's grammar, unchanged: space grabs, arrows move, space drops.
  expect(orderOn(designed)).toEqual(['plan', 'who', 'why']);
});

test('parity/K2-keyboard: the first arrow press moves past a whole element', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');

  // An element sits between two slots that mean the same place — "after who" and
  // "before plan" both put it back. Stepping one slot at a time would make the first
  // press appear to do nothing, which reads as a broken key.
  expect(
    screen.container.querySelector<HTMLElement>('[data-element-index="2"]')?.dataset[
      'dropBefore'
    ],
  ).toBe('true');
});

test('parity/K2-keyboard: escape abandons and changes nothing', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{Escape}');

  // Nothing to undo, because nothing was applied: a Creator drag previews and commits
  // once (ADR-0009 decision 4), unlike the ranking question which applies every move.
  expect(orderOn(designed)).toEqual(['who', 'plan', 'why']);
  expect(screen.container.querySelectorAll('[data-drop-before]')).toHaveLength(0);
});

test('parity/K2-indicator: the end of the list gets its own marker', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await userEvent.keyboard('{End}');

  // The last position is the one place with no element to draw a line above, and the
  // most common place to add a question. Without its own marker it could not be aimed.
  await expect.element(screen.getByTestId('drop-at-end')).toBeInTheDocument();
});

test('parity/K2-announce: every step is spoken', async () => {
  const designed = surface();
  const screen = await render(<Harness designed={designed} />);
  const live = screen.container.querySelector<HTMLElement>('.kajay-designer__announcement');

  await screen.getByRole('button', { name: 'Move who' }).click();
  await userEvent.keyboard('{ }');
  await expect.element(live).toHaveTextContent('who grabbed, position 1 of 3');

  await userEvent.keyboard('{ArrowDown}');
  // The *position*, not the slot: an element moved down lands one slot past the
  // position it ends up in, and only one of those two numbers means anything on screen.
  await expect.element(live).toHaveTextContent('who, position 2 of 3');

  await userEvent.keyboard('{ }');
  await expect.element(live).toHaveTextContent('who dropped at position 2 of 3');
});

test('parity/K2-handle: dragging is on a handle, not on the element', async () => {
  const designed = surface({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'radiogroup', name: 'tier', title: 'Which tier?', choices: ['a', 'b'] },
        ],
      },
    ],
  });
  const screen = await render(<Harness designed={designed} />);

  await screen.getByRole('radio', { name: 'a' }).click();
  await userEvent.keyboard('{ArrowDown}');

  // The arrow keys already mean something inside a radio group, a rating and a ranking
  // list. A grab mode listening on the whole element would fight most of §C.
  expect(screen.container.querySelectorAll('[data-drop-before]')).toHaveLength(0);
  await expect.element(screen.getByRole('button', { name: 'Move tier' })).toBeInTheDocument();
});
